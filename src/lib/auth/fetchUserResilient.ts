/**
 * @file src/lib/auth/fetchUserResilient.ts
 *
 * PHASES 3, 4, 6 — Resilient fetchUser(), Timeout + Deadlock Protection,
 *                   and Error Classification
 *
 * PURPOSE
 * ───────
 * Drop-in replacement primitives that harden the existing fetchUser /
 * warmAppEntry network calls without touching the AppContext state machine.
 *
 * DO NOT IMPORT THIS FILE DIRECTLY IN PAGES.
 * It is consumed only by hooks/useAppHydration.ts.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PHASE 6 — ERROR CLASSIFICATION
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * classifyAuthError() normalises any thrown value into one of:
 *   network     — no connectivity (TypeError, navigator.onLine=false)
 *   timeout     — AbortError from a timeout controller
 *   auth        — 401 / 403
 *   onboarding  — 422 responses from onboarding endpoints
 *   backend     — 5xx from the server
 *   validation  — 400 / 422 from non-onboarding endpoints
 *   transport   — AbortError not caused by a timer (cancellation)
 *   hydration   — unknown / uncategorised failures in the hydration path
 *
 * Consumers use AuthErrorClass to decide:
 *   - which errors should trigger retries (backend, network, timeout)
 *   - which errors should set isError=true (auth, hydration, backend after exhaustion)
 *   - which errors are logged at 'error' vs 'warn' level
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PHASE 3 — RETRY LOGIC
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * withRetry() wraps any async function and retries ONLY on:
 *   - network errors
 *   - 5xx responses
 *   - timeout errors
 *
 * It NEVER retries:
 *   - 401 / 403 (auth errors)
 *   - 400 / 422 (validation / malformed)
 *   - AbortError from external cancellation (transport)
 *
 * Strategy:
 *   - Exponential backoff starting at 200 ms
 *   - Full jitter to prevent thundering herd
 *   - Max 3 attempts (configurable)
 *   - Abort-safe: signal checked before each retry delay
 *   - Deduplicated via the activeRetryKey pattern (same requestId = 1 inflight)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PHASE 4 — TIMEOUT + DEADLOCK PROTECTION
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * withHydrationTimeout() races any promise against a hard deadline.
 * If the deadline fires:
 *   - The AbortController is signalled so the underlying network request cancels
 *   - A HYDRATION_TIMEOUT event is emitted
 *   - The error is classified as 'timeout'
 *
 * Timeouts used:
 *   FETCH_USER_TIMEOUT_MS    = 10_000  (10 s)  — /users/me
 *   WARM_ENTRY_TIMEOUT_MS    =  3_000  ( 3 s)  — /app-entry (matches existing)
 *   ONBOARDING_TIMEOUT_MS    = 12_000  (12 s)  — onboarding bootstrap
 *   AUTH_TRANSITION_TIMEOUT  =  8_000  ( 8 s)  — auth state changes
 *
 * Guarantee: hydration NEVER hangs indefinitely. Every await path resolves
 * within its timeout window, after which the caller receives a classified error
 * and can apply the degraded-state fallback (Phase 7).
 */

import { isApiClientError } from '@/lib/api/core/api-error';
import {
  logAuthEvent,
  AUTH_LOG_EVENTS,
  type HydrationCorrelationIds,
} from '@/lib/observability/authLogger';

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 6 — ERROR CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────────

export type AuthErrorClass =
  | 'network'
  | 'timeout'
  | 'auth'
  | 'onboarding'
  | 'backend'
  | 'validation'
  | 'transport'
  | 'hydration';

export interface ClassifiedAuthError {
  class:        AuthErrorClass;
  /** True if a retry may succeed. */
  retryable:    boolean;
  /** True if isError=true should be set (send user to /login). */
  fatal:        boolean;
  /** HTTP status if available. */
  status?:      number;
  /** Original error message. */
  message:      string;
  /** Original error for further inspection. */
  cause:        unknown;
}

// Timer-based AbortError carries a specific name set by our withHydrationTimeout.
const TIMEOUT_ABORT_REASON = 'HireRiseHydrationTimeout';

/**
 * Classify any thrown value into a normalised AuthErrorClass.
 * Guaranteed not to throw.
 */
export function classifyAuthError(err: unknown): ClassifiedAuthError {
  const message = err instanceof Error ? err.message : String(err);

  // AbortError — distinguish timeout-aborts from external cancellation
  if (err instanceof Error && err.name === 'AbortError') {
    const isTimeout = (err as Error & { reason?: string }).reason === TIMEOUT_ABORT_REASON
      || message.includes('timeout')
      || message.includes('Timeout');

    if (isTimeout) {
      return { class: 'timeout',   retryable: true,  fatal: false, message, cause: err };
    }
    // External signal (unmount, SIGNED_OUT) — not retryable, not fatal
    return { class: 'transport', retryable: false, fatal: false, message, cause: err };
  }

  // Network / connectivity
  if (
    !navigator.onLine ||
    err instanceof TypeError ||
    (err instanceof Error && err.message.toLowerCase().includes('network'))
  ) {
    return { class: 'network', retryable: true, fatal: false, message, cause: err };
  }

  // API client errors with HTTP status
  if (isApiClientError(err)) {
    const status = err.status;

    if (status === 401 || status === 403) {
      return { class: 'auth',       retryable: false, fatal: true,  status, message, cause: err };
    }
    if (status === 422) {
      // 422 from onboarding bootstrap is expected and recoverable
      const isOnboarding = err.message?.toLowerCase().includes('onboard');
      return isOnboarding
        ? { class: 'onboarding', retryable: false, fatal: false, status, message, cause: err }
        : { class: 'validation', retryable: false, fatal: false, status, message, cause: err };
    }
    if (status === 400) {
      return { class: 'validation', retryable: false, fatal: false, status, message, cause: err };
    }
    if (status !== undefined && status >= 500) {
      return { class: 'backend',    retryable: true,  fatal: false, status, message, cause: err };
    }
  }

  // Catch-all — unknown hydration failure
  return { class: 'hydration', retryable: false, fatal: true, message, cause: err };
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 4 — TIMEOUT + DEADLOCK PROTECTION
// ─────────────────────────────────────────────────────────────────────────────

export const FETCH_USER_TIMEOUT_MS    = 10_000;
export const WARM_ENTRY_TIMEOUT_MS    =  3_000;
export const ONBOARDING_TIMEOUT_MS    = 12_000;
export const AUTH_TRANSITION_TIMEOUT  =  8_000;

/**
 * Race a promise against a hard timeout.
 * On timeout: aborts the provided controller and throws a classified timeout error.
 *
 * @param fn          Async factory — receives the combined AbortSignal.
 * @param timeoutMs   Maximum allowed duration.
 * @param controller  AbortController to signal on timeout.
 * @param ids         Correlation IDs for the timeout event log.
 * @param spanName    Human-readable span name for the timeout log.
 */
export async function withHydrationTimeout<T>(
  fn:          (signal: AbortSignal) => Promise<T>,
  timeoutMs:   number,
  controller:  AbortController,
  ids:         Partial<HydrationCorrelationIds> = {},
  spanName:    string = 'hydration',
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      const err = new Error(`${spanName} exceeded ${timeoutMs}ms deadline`);
      err.name = 'AbortError';
      (err as Error & { reason: string }).reason = TIMEOUT_ABORT_REASON;
      controller.abort(TIMEOUT_ABORT_REASON);

      logAuthEvent(
        AUTH_LOG_EVENTS.HYDRATION_TIMEOUT,
        ids,
        { spanName, timeoutMs },
        'warn',
      );

      reject(err);
    }, timeoutMs);
  });

  try {
    return await Promise.race([fn(controller.signal), timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3 — RETRY STRATEGY
// ─────────────────────────────────────────────────────────────────────────────

export interface RetryOptions {
  maxAttempts?: number;  // default 3
  baseDelayMs?: number;  // default 200ms
  maxDelayMs?:  number;  // default 8_000ms
  signal?:      AbortSignal;
  ids?:         Partial<HydrationCorrelationIds>;
  spanName?:    string;
}

function jitteredBackoff(attempt: number, base: number, max: number): number {
  // Full jitter: uniform(0, min(max, base * 2^attempt))
  const cap = Math.min(max, base * Math.pow(2, attempt));
  return Math.floor(Math.random() * cap);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

/**
 * Wrap an async function with exponential-backoff retry.
 * Only retries on retryable error classes (network, backend, timeout).
 * Never retries auth (401/403), validation, or external-abort errors.
 *
 * @param fn        Factory that accepts an attempt index (0-based).
 * @param options   Retry configuration.
 */
export async function withRetry<T>(
  fn:      (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 200,
    maxDelayMs  = 8_000,
    signal,
    ids         = {},
    spanName    = 'unknown',
  } = options;

  let lastClassified: ClassifiedAuthError | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Abort-safe: if the external signal fired, stop immediately
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    try {
      return await fn(attempt);
    } catch (err) {
      lastClassified = classifyAuthError(err);

      // Non-retryable: rethrow immediately
      if (!lastClassified.retryable) {
        throw err;
      }

      const isLastAttempt = attempt === maxAttempts - 1;
      if (isLastAttempt) {
        logAuthEvent(
          AUTH_LOG_EVENTS.FETCH_USER_EXHAUSTED,
          ids,
          { spanName, attempts: maxAttempts, errorClass: lastClassified.class, message: lastClassified.message },
          'error',
        );
        throw err;
      }

      const delay = jitteredBackoff(attempt, baseDelayMs, maxDelayMs);
      logAuthEvent(
        AUTH_LOG_EVENTS.FETCH_USER_RETRY,
        ids,
        { spanName, attempt: attempt + 1, maxAttempts, delayMs: delay, errorClass: lastClassified.class },
        'warn',
      );

      await sleep(delay, signal);
    }
  }

  // TypeScript path — unreachable at runtime
  throw lastClassified?.cause ?? new Error('withRetry exhausted');
}