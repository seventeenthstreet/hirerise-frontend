/**
 * @file lib/utils/retry.ts
 * @description Exponential-backoff retry wrapper for network operations.
 *
 * PURPOSE:
 *   Channel delivery calls (Slack, webhook, email) can fail transiently due to
 *   network timeouts, brief 503s, or rate-limit responses from external APIs.
 *   This utility wraps those calls with a bounded retry loop so transient
 *   failures resolve automatically without intervention.
 *
 * BACKOFF SCHEDULE (base delays, before jitter):
 *   Attempt 1 — immediate (no delay before first try)
 *   Attempt 2 — wait 1 000ms base + 0–500ms jitter
 *   Attempt 3 — wait 5 000ms base + 0–500ms jitter
 *   Attempt 4 — wait 15 000ms base + 0–500ms jitter → give up
 *
 *   Worst-case wall time: ~21.5 seconds per alert delivery attempt.
 *   Acceptable for async fire-and-forget alert delivery.
 *
 * WHY JITTER?
 *   Without jitter, every concurrent alert that trips a retry fires its second
 *   attempt at exactly T+1 000ms, its third at T+6 000ms, and so on. When N
 *   alerts fail simultaneously (e.g. a Slack outage recovers), this creates a
 *   synchronised retry spike — all N requests hit the channel at the same
 *   instant, which can re-trigger the very rate-limit or overload that caused
 *   the failure. Jitter desynchronises those retries across a 500ms window so
 *   the channel sees a smooth ramp, not a thundering herd.
 *
 *   The jitter window (JITTER_MAX_MS = 500) is deliberately small relative
 *   to the base delays (1 000 / 5 000 / 15 000ms) so that:
 *     1. The retry schedule remains predictable for logging and debugging.
 *     2. Tests can inject a deterministic delayFn and bypass jitter entirely.
 *     3. Worst-case latency increases by at most 500ms per attempt — negligible
 *        for fire-and-forget delivery that already tolerates 21-second windows.
 *
 * RETRY DISCRIMINATION:
 *   Retry is only appropriate for NETWORK errors (fetch failures, timeouts,
 *   5xx responses). Validation errors, auth failures (401/403), and malformed
 *   payloads (400) will not succeed on retry — retrying them wastes time and
 *   inflates external rate limits.
 *
 *   isRetryable() classifies errors. The classifier is exported so channels
 *   can extend it with their own error types.
 *
 * SCOPE:
 *   General utility — may be imported by any lib layer.
 *   Must NOT be imported by hooks, UI, or pages.
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum number of attempts (including the initial call). */
export const MAX_ATTEMPTS = 4;

/**
 * Base delay in milliseconds before each retry attempt.
 * Index 0 = delay before attempt 2, index 1 = before attempt 3, etc.
 * Length must be MAX_ATTEMPTS - 1.
 *
 * Actual delay = BACKOFF_DELAYS_MS[i] + random(0, JITTER_MAX_MS).
 * The base values are unchanged from the original schedule.
 */
export const BACKOFF_DELAYS_MS: readonly number[] = [
  1_000,   // before attempt 2
  5_000,   // before attempt 3
  15_000,  // before attempt 4
] as const;

/**
 * Jitter scale factor applied proportionally to each base delay.
 *
 * Actual jitter added = base * random(0, JITTER_SCALE_FACTOR).
 *
 * WHY PROPORTIONAL vs FLAT:
 *   The original flat jitter (0–500ms) was a fixed window regardless of the
 *   base delay. At a 1 000ms base this was a meaningful 50% spread. At a
 *   15 000ms base it was only 3.3% — every 15-second retry arrived at nearly
 *   the same instant, offering little thundering-herd protection at the most
 *   critical (longest) backoff stage.
 *
 *   Proportional jitter scales with the base, so:
 *     Attempt 2 (base=1 000ms):  jitter = 0–500ms   (0–50% of base) — same as before
 *     Attempt 3 (base=5 000ms):  jitter = 0–2 500ms (0–50% of base) — wider spread
 *     Attempt 4 (base=15 000ms): jitter = 0–7 500ms (0–50% of base) — maximum spread
 *
 *   This gives better desynchronisation exactly where it matters most —
 *   the later retries that cluster around a recovery window.
 *
 * FORMULA: delay = base * (1 + random(0, JITTER_SCALE_FACTOR))
 *   JITTER_SCALE_FACTOR = 0.5 → jitter up to 50% above base.
 *
 * BACKWARDS COMPATIBILITY:
 *   - Attempt 2 worst-case changes from 1 500ms to 1 500ms (identical ceiling).
 *   - Attempt 3 worst-case changes from 5 500ms to 7 500ms (+2 000ms).
 *   - Attempt 4 worst-case changes from 15 500ms to 22 500ms (+7 000ms).
 *   All values remain well within the fire-and-forget tolerance window.
 *   Tests injecting delayFn:()=>Promise.resolve() are completely unaffected.
 *
 * Set to 0 in tests (via delayFn override) to keep tests deterministic.
 */
export const JITTER_SCALE_FACTOR = 0.5;

/**
 * Absolute ceiling on any computed jitter delay, in milliseconds.
 *
 * WHY A CAP?
 *   _jitteredDelay() is formula-driven: delay = base * (1 + random * 0.5).
 *   With the current schedule (max base = 15 000ms), the ceiling is 22 500ms —
 *   well within acceptable range. However if BACKOFF_DELAYS_MS is ever extended
 *   with a larger base (e.g. a 60 000ms stage for a future slow channel), the
 *   formula would produce delays up to 90 000ms without this cap.
 *
 *   MAX_DELAY_CAP_MS acts as a hard guard that prevents runaway delay growth
 *   independent of how the base schedule evolves. It does not change current
 *   output — 22 500ms < 30 000ms — but it protects future scaling.
 *
 * CURRENT SCHEDULE IMPACT (none):
 *   Attempt 2: max 1 500ms   < 30 000ms — uncapped
 *   Attempt 3: max 7 500ms   < 30 000ms — uncapped
 *   Attempt 4: max 22 500ms  < 30 000ms — uncapped
 *
 * The cap is exported so it can be asserted in tests alongside jitter bounds.
 */
export const MAX_DELAY_CAP_MS = 30_000;

// ─────────────────────────────────────────────────────────────────────────────
// ERROR CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retryable error categories:
 *
 *   'network'    — fetch() threw (DNS failure, TCP reset, CORS block)
 *   'timeout'    — AbortController timed out the request
 *   'server'     — HTTP 5xx response (server-side transient failure)
 *   'rate_limit' — HTTP 429 (back off and retry)
 *
 * Non-retryable (caller should log and give up):
 *   'validation' — HTTP 400 (our payload is malformed — retrying won't help)
 *   'auth'       — HTTP 401/403 (wrong credentials — retrying won't help)
 *   'not_found'  — HTTP 404 (endpoint missing — retrying won't help)
 *   'unknown'    — anything else
 */
export type RetryableCategory =
  | 'network'
  | 'timeout'
  | 'server'
  | 'rate_limit';

export type NonRetryableCategory =
  | 'validation'
  | 'auth'
  | 'not_found'
  | 'unknown';

export type ErrorCategory = RetryableCategory | NonRetryableCategory;

/**
 * Classifies a caught error or HTTP status into a retry category.
 *
 * @param errorOrStatus - A caught Error object, or an HTTP status code number.
 * @returns             The error category.
 */
export function classifyError(errorOrStatus: unknown): ErrorCategory {
  // Numeric HTTP status codes.
  if (typeof errorOrStatus === 'number') {
    if (errorOrStatus === 429)                          return 'rate_limit';
    if (errorOrStatus >= 500)                          return 'server';
    if (errorOrStatus === 400)                         return 'validation';
    if (errorOrStatus === 401 || errorOrStatus === 403) return 'auth';
    if (errorOrStatus === 404)                         return 'not_found';
    return 'unknown';
  }

  // Error objects from fetch() or AbortController.
  if (errorOrStatus instanceof Error) {
    if (errorOrStatus.name === 'AbortError')              return 'timeout';
    if (errorOrStatus.name === 'TypeError')               return 'network';  // fetch network failure
    if (errorOrStatus.message.includes('network'))        return 'network';
    if (errorOrStatus.message.includes('fetch'))          return 'network';
  }

  return 'unknown';
}

/**
 * Returns true if the error category should trigger a retry.
 */
export function isRetryable(errorOrStatus: unknown): boolean {
  const category = classifyError(errorOrStatus);
  const retryable: ErrorCategory[] = ['network', 'timeout', 'server', 'rate_limit'];
  return retryable.includes(category);
}

// ─────────────────────────────────────────────────────────────────────────────
// DELAY PRIMITIVE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Promise-based sleep. Replaceable in tests via the `delayFn` option.
 * @internal
 */
export function _sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Compute jittered delay for a given retry attempt index.
 *
 * delay = Math.min(base * (1 + Math.random() * JITTER_SCALE_FACTOR), MAX_DELAY_CAP_MS)
 *
 * This is a proportional jitter formula with an absolute safety ceiling.
 * Unlike the previous additive approach (base + flat_random), the jitter
 * window scales with the base delay:
 *   - Short base delays → small absolute jitter (low extra latency)
 *   - Long base delays  → large absolute jitter (better thundering-herd spread)
 *
 * At JITTER_SCALE_FACTOR=0.5, the uncapped range per attempt is:
 *   Attempt 2 (1 000ms base): 1 000–1 500ms   (cap at 30 000ms — no effect)
 *   Attempt 3 (5 000ms base): 5 000–7 500ms   (cap at 30 000ms — no effect)
 *   Attempt 4 (15 000ms base): 15 000–22 500ms (cap at 30 000ms — no effect)
 *
 * MAX_DELAY_CAP_MS has zero effect on the current schedule. It guards against
 * formula overflow if BACKOFF_DELAYS_MS is extended with larger base values in
 * the future (e.g. a 60 000ms stage would produce up to 90 000ms uncapped).
 *
 * Math.random() is sufficient — we need desynchronisation, not cryptographic
 * unpredictability. Tests inject delayFn:()=>Promise.resolve() and are
 * completely unaffected by jitter magnitude.
 *
 * Exported so unit tests can assert jitter bounds (and cap behaviour) without
 * calling withRetry() end-to-end.
 *
 * @param attemptIndex - 0-based index into BACKOFF_DELAYS_MS (attempt 2 → 0).
 * @returns            Jittered delay in ms, capped at MAX_DELAY_CAP_MS.
 *                     Always >= base (for base values within cap). Never negative.
 * @internal
 */
export function _jitteredDelay(attemptIndex: number): number {
  const base      = BACKOFF_DELAYS_MS[attemptIndex] ?? BACKOFF_DELAYS_MS.at(-1)!;
  const uncapped  = base * (1 + Math.random() * JITTER_SCALE_FACTOR);
  // Safety cap: prevents runaway delays if base schedule is extended later.
  // Has no effect on the current three-stage schedule (max uncapped = 22 500ms).
  return Math.min(uncapped, MAX_DELAY_CAP_MS);
}

// ─────────────────────────────────────────────────────────────────────────────
// RETRY RESULT TYPE
// ─────────────────────────────────────────────────────────────────────────────

export interface RetryResult<T> {
  /** true if the operation ultimately succeeded. */
  success:  boolean;
  /** The value returned by the operation on success. */
  value?:   T;
  /** The last error thrown. Present on failure. */
  error?:   unknown;
  /** Number of attempts made (1 = no retries needed). */
  attempts: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

export interface RetryOptions {
  /**
   * Override the maximum number of attempts (default: MAX_ATTEMPTS = 4).
   * Useful for unit tests that want fewer iterations.
   */
  maxAttempts?: number;

  /**
   * Override the delay function for tests.
   * Default: _sleep (real setTimeout-based delay).
   *
   * When overriding in tests, you bypass jitter automatically because the
   * delayFn receives the already-computed jittered value. To test deterministic
   * delays, pass `delayFn: () => Promise.resolve()` — the delay argument is
   * ignored and the test controls timing explicitly.
   */
  delayFn?: (ms: number) => Promise<void>;

  /**
   * Override the retryability classifier.
   * Default: isRetryable.
   * Use this to treat additional error types as retryable for specific channels.
   */
  retryableFn?: (err: unknown) => boolean;

  /**
   * Optional label used in dev-mode console logs to identify the operation.
   */
  label?: string;
}

/**
 * Wraps an async operation with exponential-backoff retry and per-attempt jitter.
 *
 * Guarantees:
 *  - Never throws — always returns a RetryResult (caller decides how to handle failure).
 *  - At most MAX_ATTEMPTS total calls to the operation.
 *  - Non-retryable errors abort immediately (no wasted delay).
 *  - Retry delays are jittered ([base, base + 500ms)) to prevent thundering-herd
 *    spikes when multiple concurrent deliveries fail at the same instant.
 *  - Tests can inject `delayFn: () => Promise.resolve()` to skip all delays;
 *    jitter is applied to the ms value passed to delayFn but has no wall-time
 *    effect when the function is a no-op.
 *
 * @param operation - The async function to call. Should be idempotent (safe to re-call).
 * @param options   - Optional configuration overrides.
 * @returns         RetryResult with success flag, value or error, and attempt count.
 *
 * @example
 * const result = await withRetry(() => sendSlackAlert(alert), { label: 'slack' });
 * if (!result.success) {
 *   analytics.track('alert.delivery.failed', { channel: 'slack', error: String(result.error) });
 * }
 */
export async function withRetry<T>(
  operation:  () => Promise<T>,
  options:    RetryOptions = {},
): Promise<RetryResult<T>> {
  const maxAttempts = options.maxAttempts  ?? MAX_ATTEMPTS;
  const delayFn     = options.delayFn      ?? _sleep;
  const retryableFn = options.retryableFn  ?? isRetryable;
  const label       = options.label        ?? 'operation';

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const value = await operation();
      return { success: true, value, attempts: attempt };
    } catch (err) {
      lastError = err;

      if (!retryableFn(err)) {
        // Non-retryable error — abort immediately, no delay.
        if (process.env.NODE_ENV === 'development') {
          console.warn(
            `[retry:${label}] Non-retryable error on attempt ${attempt}/${maxAttempts} — aborting.`,
            err,
          );
        }
        return { success: false, error: err, attempts: attempt };
      }

      if (attempt < maxAttempts) {
        // ── Proportional jitter backoff ───────────────────────────────────
        // _jitteredDelay() computes base * (1 + random(0, 0.5)) so jitter
        // scales with the base delay — longer waits get wider spread, giving
        // better desynchronisation at the retries that matter most.
        // The delayFn override in tests receives this value but is typically
        // a no-op, keeping test timing deterministic regardless of jitter.
        const delay = _jitteredDelay(attempt - 1);

        if (process.env.NODE_ENV === 'development') {
          console.warn(
            `[retry:${label}] Attempt ${attempt}/${maxAttempts} failed. ` +
            `Retrying in ${Math.round(delay)}ms (base=${BACKOFF_DELAYS_MS[attempt - 1]}ms × (1+jitter)).`,
            err,
          );
        }
        await delayFn(delay);
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.error(
            `[retry:${label}] All ${maxAttempts} attempts failed.`,
            err,
          );
        }
      }
    }
  }

  return { success: false, error: lastError, attempts: maxAttempts };
}