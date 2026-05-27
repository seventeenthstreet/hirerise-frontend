/**
 * @file lib/alertBurstControl.ts
 * @description Group-level alert burst controller.
 *
 * POSITION IN THE PIPELINE:
 *
 *   Alert Engine (evaluateAlerts())
 *           ↓
 *   Alert Dispatcher (dispatchAlerts())
 *           ↓
 *   ► Burst Control  ← YOU ARE HERE
 *           ↓
 *   Per-alert: Dedup → Rate Limit → Channel Delivery
 *
 * PURPOSE:
 *   alertDedup.ts and alertRateLimiter.ts protect individual alerts from
 *   being repeated or flooding a single channel. They do not protect against
 *   a spike where N *different* alerts all fire at the same instant — for
 *   example, a brief backend degradation that simultaneously breaches resume
 *   failure rate, session duration, onboarding completion, and CHI score
 *   thresholds. Without burst control, that single event would dispatch up to
 *   N × 3 channel calls concurrently.
 *
 *   Burst control is a group-level gate: it looks at the batch as a whole and
 *   answers "should we throttle this group before per-alert processing begins?"
 *
 * STRATEGY — Fixed Window Counter:
 *   Track total alert dispatches across all alerts in the current 60-second
 *   window. If the window count exceeds BURST_THRESHOLD:
 *
 *     Option A (default): suppress low-severity alerts (low, medium) — let
 *       critical and high alerts through regardless. Operators get the most
 *       actionable signal; low-priority noise is absorbed by the burst window.
 *
 *     Option B (shouldThrottleGroup): return a simple boolean that the
 *       dispatcher can use to decide whether to skip the batch entirely or
 *       filter it. The dispatcher owns the final decision; this module only
 *       provides the data.
 *
 * CRITICAL ALERT GUARANTEE:
 *   'critical' severity alerts are NEVER suppressed by burst control.
 *   They bypass the window check unconditionally. This is the most important
 *   invariant in this module — see filterAlertsForBurst() below.
 *
 * WHY NOT QUEUE?
 *   Queuing delayed delivery requires either a timer or a persistent store
 *   (Redis/BullMQ). Both are external dependencies and violate the "no external
 *   deps" constraint. Drop (with analytics logging) is the correct degraded
 *   behaviour for an in-process, fire-and-forget system. Operators can tune
 *   BURST_THRESHOLD to reduce drops if needed.
 *
 * SCOPE:
 *   Internal — consumed only by alertDispatcher.ts.
 *   Must NOT be imported by hooks, UI, or pages.
 */

import type { Alert, AlertSeverity } from '@/lib/alerts';
import type { MetricsMeta }          from '@/types/internal/mappedMetrics';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

/** Duration of one burst-control window in milliseconds. */
export const BURST_WINDOW_MS = 60_000; // 1 minute

/**
 * Maximum number of alerts allowed across all severities per window
 * before burst throttling kicks in.
 *
 * Rationale: the system has ~20 alert rules. A simultaneous breach of all
 * rules is the worst-case burst. A threshold of 10 allows half the rule set
 * to fire per minute without triggering suppression — enough headroom for
 * real degradation scenarios, tight enough to catch runaway spikes.
 *
 * Tune this upward if legitimate multi-alert scenarios are being suppressed.
 */
export const BURST_THRESHOLD = 10;

/**
 * Severities that are NEVER suppressed by burst control, regardless of window count.
 *
 * 'critical' is the only unconditional pass-through. 'high' is intentionally
 * excluded so that a burst of high-severity alerts (e.g. 15 different high-
 * severity rule fires) can still be throttled. Operators who want 'high' to
 * also bypass can add it here without touching the dispatcher.
 */
export const BURST_EXEMPT_SEVERITIES: ReadonlySet<AlertSeverity> = new Set([
  'critical',
]);

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW STATE
// ─────────────────────────────────────────────────────────────────────────────

interface BurstWindow {
  /** Total alert dispatches recorded in the current window. */
  count:       number;
  /** Start of the current window (Unix ms). */
  windowStart: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE KEY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derive a burst-control scope key from the alert meta context.
 *
 * CURRENT BEHAVIOUR (v1):
 *   Always returns 'global'. The burst window is shared across all alerts
 *   regardless of source, mode, or tenant. This is identical to the previous
 *   implicit singleton behaviour — no change in observable result.
 *
 * FUTURE MULTI-TENANT READINESS:
 *   When tenant or environment identifiers are available in MetricsMeta, this
 *   function is the single place to add scoping logic. For example:
 *
 *     if (meta.tenantId) return `tenant:${meta.tenantId}`;
 *     if (meta.env)      return `env:${meta.env}`;
 *
 *   Each scope gets an independent counter and window, so a burst from one
 *   tenant cannot starve alerts from another. No other code needs to change.
 *
 * WHY HERE, NOT IN THE DISPATCHER?
 *   Scope derivation is a burst-control concern. The dispatcher should not
 *   need to know how scoping works — it passes meta through opaquely.
 *
 * @param meta - The _meta object from MappedMetrics. Currently only used
 *               for future extensibility; all fields are optional reads.
 * @returns    A stable string key used to isolate burst windows.
 */
export function getBurstScope(meta: MetricsMeta): string {
  // Build a composite scope key from the fields available in MetricsMeta v1.
  //
  // CURRENT BEHAVIOUR:
  //   With a single source + single mode, all alerts map to the same key —
  //   functionally equivalent to the previous 'global' singleton. No change
  //   in burst-window accounting for existing deployments.
  //
  // FUTURE MULTI-TENANT / MULTI-ENV READINESS:
  //   When MetricsMeta carries tenant or environment fields, add them to this
  //   array so each context gets an isolated burst counter. For example:
  //
  //     meta.tenantId ? `t:${meta.tenantId}` : null,
  //     meta.env      ? `e:${meta.env}`       : null,
  //
  //   Each scope key maps to an independent BurstWindow in _windows — no
  //   cross-tenant starvation is possible.
  //
  // WHY ENCODE mode AND posthog?
  //   'mode' distinguishes single/hybrid/mock execution contexts. A burst in
  //   hybrid mode should not consume the quota of a single-source deployment
  //   when they co-exist in a multi-tenant future. Encoding it now costs
  //   nothing and makes the key more semantically precise.
  //
  //   Posthog availability ('ph' vs 'no-ph') flags partial-source states.
  //   Together with mode, this gives operators a queryable dimension in
  //   burst-window diagnostics (getBurstWindowState) at no runtime cost.
  //
  // SAFETY:
  //   All fields are read with nullish fallbacks — undefined meta.sources
  //   is guarded by the '?.' operator. The join produces a non-empty string
  //   in all cases because 'global' is always the first segment.
  const posthogSegment = meta.sources?.posthog ? 'ph' : 'no-ph';
  return ['global', meta.mode, posthogSegment].join(':');
}

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW STATE  (scope-keyed)
// ─────────────────────────────────────────────────────────────────────────────

/** One burst window per scope key. Replaces the previous module singleton. */
const _windows = new Map<string, BurstWindow>();

/**
 * Get or initialise the BurstWindow for a given scope key.
 * @internal
 */
function _getWindow(scopeKey: string, now: number): BurstWindow {
  let w = _windows.get(scopeKey);
  if (!w) {
    w = { count: 0, windowStart: now };
    _windows.set(scopeKey, w);
  }
  return w;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Roll over the window counter if the current time has passed the window boundary.
 * Operates on a passed-in BurstWindow reference (scope-aware).
 * @internal
 */
function _maybeRollOver(w: BurstWindow, now: number): void {
  if (now - w.windowStart >= BURST_WINDOW_MS) {
    w.count       = 0;
    w.windowStart = now;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the current batch would push the window counter past the
 * burst threshold, indicating that throttling should be applied.
 *
 * This is a READ-ONLY check — it does NOT update the window counter.
 * Call recordBurstWindow() after filtering to record the alerts that will
 * actually be dispatched.
 *
 * The dispatcher uses this to decide whether to run filterAlertsForBurst().
 * If the batch is below threshold, alerts proceed without any filtering.
 *
 * @param alertCount - Number of alerts in the current batch.
 * @param now        - Optional time override for deterministic tests.
 * @returns          true → burst detected, apply filterAlertsForBurst().
 *                   false → within threshold, dispatch all alerts normally.
 */
export function shouldThrottleGroup(
  alertCount: number,
  now: number = Date.now(),
  scopeKey: string = 'global',
): boolean {
  const w = _getWindow(scopeKey, now);
  _maybeRollOver(w, now);
  return (w.count + alertCount) > BURST_THRESHOLD;
}

/**
 * Filter an alert batch for burst conditions.
 *
 * Returns a subset of the input array where:
 *   - BURST_EXEMPT_SEVERITIES ('critical') are always included.
 *   - Non-exempt alerts are included only up to the remaining burst budget.
 *
 * The returned array preserves the original sort order (critical → low),
 * which means critical alerts always appear first and are selected first.
 *
 * CALLER CONTRACT:
 *   Call this only when shouldThrottleGroup() returns true.
 *   After calling this, call recordBurstWindow(filtered.length) to account
 *   for the alerts that will actually be dispatched.
 *
 * @param alerts - The full alert batch, already sorted by severity.
 * @param now    - Optional time override for deterministic tests.
 * @returns      Filtered alert array. Never empty if any critical alert exists.
 */
export function filterAlertsForBurst(
  alerts: Alert[],
  now: number = Date.now(),
  scopeKey: string = 'global',
): Alert[] {
  const w = _getWindow(scopeKey, now);
  _maybeRollOver(w, now);

  const remaining = Math.max(0, BURST_THRESHOLD - w.count);

  const exempt:     Alert[] = [];
  const nonExempt:  Alert[] = [];

  for (const alert of alerts) {
    if (BURST_EXEMPT_SEVERITIES.has(alert.severity)) {
      exempt.push(alert);
    } else {
      nonExempt.push(alert);
    }
  }

  // Critical alerts pass through unconditionally.
  // Non-exempt alerts fill the remaining budget (first-come = highest severity
  // because evaluateAlerts() already sorts critical → high → medium → low).
  const allowedNonExempt = nonExempt.slice(0, remaining);
  const dropped          = nonExempt.length - allowedNonExempt.length;

  if (dropped > 0 && process.env.NODE_ENV === 'development') {
    console.warn(
      `[alertBurstControl] Burst threshold exceeded. ` +
      `Dropped ${dropped} non-critical alert(s). ` +
      `window=${w.count}/${BURST_THRESHOLD} remaining=${remaining}`,
    );
  }

  return [...exempt, ...allowedNonExempt];
}

/**
 * Record that N alerts were dispatched in the current window.
 *
 * CALL PATTERN:
 *   After filtering (or after confirming no filtering is needed), call this
 *   once with the final dispatch count so the window stays accurate.
 *
 *   // No burst:
 *   recordBurstWindow(alerts.length);
 *
 *   // With burst filtering:
 *   const filtered = filterAlertsForBurst(alerts);
 *   recordBurstWindow(filtered.length);
 *
 * @param count - Number of alerts being dispatched this cycle.
 * @param now   - Optional time override for deterministic tests.
 */
export function recordBurstWindow(
  count: number,
  now: number = Date.now(),
  scopeKey: string = 'global',
): void {
  const w = _getWindow(scopeKey, now);
  _maybeRollOver(w, now);
  w.count += count;
}

/**
 * Returns a snapshot of the current burst window state.
 * Intended for diagnostics, analytics logging, and tests only.
 *
 * @param now - Optional time override.
 */
export function getBurstWindowState(
  now: number = Date.now(),
  scopeKey: string = 'global',
): { count: number; remaining: number; windowStart: number } {
  const w = _getWindow(scopeKey, now);
  _maybeRollOver(w, now);
  return {
    count:       w.count,
    remaining:   Math.max(0, BURST_THRESHOLD - w.count),
    windowStart: w.windowStart,
  };
}

/**
 * Reset burst window state for a specific scope, or all scopes.
 * For unit tests and manual operator resets only.
 * Must NOT be called automatically — that would defeat burst control.
 *
 * @param scopeKey - If provided, resets only that scope. If omitted, resets all.
 */
export function resetBurstWindow(scopeKey?: string): void {
  if (scopeKey !== undefined) {
    _windows.delete(scopeKey);
  } else {
    _windows.clear();
  }
}