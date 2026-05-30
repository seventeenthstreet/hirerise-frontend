/**
 * @file lib/actions/actionPolicy.ts
 * @description Execution policy layer for alert-triggered actions.
 *
 * PURPOSE:
 *   Prevents unsafe repeated execution of side-effectful actions before they
 *   reach the dispatcher. This is a pure in-memory gate — it never mutates
 *   alert or insight state and has no network I/O.
 *
 * POSITION IN PIPELINE:
 *
 *   alertDispatcher.ts
 *        ↓
 *   actionPolicy.ts  ← YOU ARE HERE (called BEFORE dedup + rate limit)
 *        ↓
 *   alertDedup / alertRateLimiter
 *        ↓
 *   channel delivery (slack / email / webhook)
 *
 * GUARANTEES:
 *   - shouldExecuteAction() NEVER throws — returns true (allow) on any error
 *   - No modification to Alert or Insight fields
 *   - Deterministic: same inputs + same window state → same output
 *   - In-memory only — no persistence, no I/O
 *   - Idempotent: calling with the same action twice within a window → false
 *
 * POLICIES:
 *   1. rapid-repeat guard   — blocks same (type, metric) pair within window
 *   2. escalation-loop guard — blocks critical alert bursts (> N within window)
 *
 * RULES:
 *   - Additive only — does not modify alertDispatcher.ts or any existing file
 *   - All new state lives in this module's private Map
 *   - No imports from React, hooks, UI, or pages
 *   - No randomness — decisions are fully deterministic
 *
 * INTEGRATION (in alertDispatcher.ts, before isDuplicate):
 *
 *   import { shouldExecuteAction } from '@/lib/actions/actionPolicy';
 *
 *   // Inside the per-alert loop, BEFORE isDuplicate:
 *   if (!shouldExecuteAction(alert)) {
 *     continue; // policy blocked — safe to skip
 *   }
 */

import type { Alert }   from '@/lib/alerts';
import { safeTrack }    from '@/lib/actions/utils/safeTrack';

// ─────────────────────────────────────────────────────────────────────────────
// POLICY BLOCK REASON
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Machine-readable reason code emitted when shouldExecuteAction returns false.
 *
 * Carried in the 'action.policy.blocked' analytics event payload so operators
 * can distinguish suppression causes in dashboards without parsing log strings.
 *
 * 'rapid_repeat'      — same (alert.id, metric) pair fired within its severity window.
 * 'escalation_loop'   — critical burst limit exceeded within the burst window.
 * 'unknown'           — reserved for future policies; never emitted by current code.
 */
type PolicyBlockReason =
  | 'rapid_repeat'
  | 'escalation_loop'
  | 'unknown';

// ─────────────────────────────────────────────────────────────────────────────
// POLICY CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimum milliseconds between two executions of the same (type, metric) pair.
 *
 * Deliberately longer than the dedup cooldowns: policy is about preventing
 * unsafe action escalation, not just suppressing duplicate notifications.
 *
 * critical — 5 min  (fast incident loops need re-checks, but 5 min is safe)
 * high     — 10 min
 * medium   — 15 min
 * low      — 30 min
 */
const POLICY_WINDOW_MS: Record<string, number> = {
  critical: 5  * 60 * 1000,   //  5 min
  high:     10 * 60 * 1000,   // 10 min
  medium:   15 * 60 * 1000,   // 15 min
  low:      30 * 60 * 1000,   // 30 min
};

/** Default window when severity is absent or unrecognised. */
const DEFAULT_WINDOW_MS = 10 * 60 * 1000; // 10 min

/**
 * Maximum number of critical alerts allowed within CRITICAL_BURST_WINDOW_MS
 * before the escalation-loop guard activates.
 *
 * A sustained burst beyond this threshold indicates a feedback loop
 * (e.g. an action that re-triggers its own alert) and should be suppressed.
 */
const CRITICAL_BURST_LIMIT  = 5;
const CRITICAL_BURST_WINDOW = 5 * 60 * 1000; // 5 min rolling window

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY STATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tracks the last execution timestamp per (type, metric) pair.
 * Key format: `${alert.id}:${alert.metric}`
 *
 * Private to this module — not exported, not shared with other layers.
 */
const _executionTimestamps = new Map<string, number>();

/**
 * Tracks critical alert execution timestamps for the escalation-loop guard.
 * Stores the rolling list of timestamps within the burst window.
 */
const _criticalBurstLog: number[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the policy key for a given alert.
 * Combines the alert type ID and metric to scope the window per rule.
 *
 * @internal
 */
function _policyKey(alert: Alert): string {
  return `${alert.id}:${alert.metric}`;
}

/**
 * Check whether the rapid-repeat guard should block this alert.
 *
 * Returns true (blocked) if the same (id, metric) pair was executed
 * within the configured policy window for this severity.
 *
 * @internal
 */
function _isRapidRepeat(alert: Alert, nowMs: number): boolean {
  const key      = _policyKey(alert);
  const lastMs   = _executionTimestamps.get(key);

  if (lastMs === undefined) return false; // first execution — allow

  const windowMs = POLICY_WINDOW_MS[alert.severity] ?? DEFAULT_WINDOW_MS;
  return (nowMs - lastMs) < windowMs;
}

/**
 * Check whether the escalation-loop guard should block a critical alert.
 *
 * Prunes stale entries from _criticalBurstLog before evaluating.
 * Returns true (blocked) if CRITICAL_BURST_LIMIT has been reached.
 *
 * @internal
 */
function _isCriticalEscalationLoop(nowMs: number): boolean {
  // Prune entries older than the burst window (mutates in-place)
  const cutoff = nowMs - CRITICAL_BURST_WINDOW;
  let i = 0;
  while (i < _criticalBurstLog.length && _criticalBurstLog[i]! < cutoff) {
    i++;
  }
  if (i > 0) _criticalBurstLog.splice(0, i);

  return _criticalBurstLog.length >= CRITICAL_BURST_LIMIT;
}

/**
 * Record a successful policy decision (allow) so subsequent calls can gate.
 *
 * Must only be called AFTER shouldExecuteAction() returns true.
 *
 * @internal
 */
function _recordExecution(alert: Alert, nowMs: number): void {
  _executionTimestamps.set(_policyKey(alert), nowMs);

  if (alert.severity === 'critical') {
    _criticalBurstLog.push(nowMs);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Optional metadata forwarded from the dispatcher for richer policy decisions.
 *
 * All fields are optional so callers don't need to construct a full object —
 * the function degrades gracefully when meta is absent.
 */
export interface ActionPolicyMeta {
  /**
   * Monotonic timestamp (ms) for this evaluation cycle.
   * Defaults to Date.now() when absent — override in tests for determinism.
   */
  nowMs?: number;
}

/**
 * Determine whether an alert should proceed to dispatch.
 *
 * This is the single policy gate — call it in the dispatcher BEFORE dedup
 * and rate limiting. A false return means the action is policy-blocked and
 * should be skipped silently (no channel delivery, no dedup record update).
 *
 * Policies evaluated (in order):
 *   1. Rapid-repeat guard: same (id, metric) within severity window → false
 *   2. Critical escalation-loop guard: > N criticals in burst window → false
 *
 * Side effects on ALLOW:
 *   Records the execution timestamp for future rapid-repeat checks.
 *
 * Side effects on DENY:
 *   None — no state is mutated when blocking.
 *
 * SAFETY:
 *   Wrapped in try/catch — any internal error returns true (allow) so as
 *   not to silently drop alerts due to a policy bug.
 *
 * @param alert - The alert being evaluated for dispatch.
 * @param meta  - Optional metadata (nowMs override for tests).
 * @returns     true → proceed to dispatch; false → policy blocked.
 */
export function shouldExecuteAction(
  alert: Alert,
  meta:  ActionPolicyMeta = {},
): boolean {
  try {
    const nowMs = meta.nowMs ?? Date.now();

    // reason accumulates the FIRST block reason found.
    // Evaluated in policy priority order: rapid_repeat before escalation_loop.
    let reason: PolicyBlockReason | null = null;

    // ── Policy 1: Rapid-repeat guard ──────────────────────────────────────
    if (_isRapidRepeat(alert, nowMs)) {
      reason = 'rapid_repeat';
    }

    // ── Policy 2: Critical escalation-loop guard ──────────────────────────
    // Only evaluated for critical severity; only sets reason if not already set.
    if (reason === null && alert.severity === 'critical' && _isCriticalEscalationLoop(nowMs)) {
      reason = 'escalation_loop';
    }

    // ── Block path — emit observability event and return false ─────────────
    if (reason !== null) {
      // Emit analytics with reason code — safeTrack never throws.
      safeTrack('action.policy.blocked', {
        action_id:   alert.id,
        action_type: alert.id,
        metric:      alert.metric,
        reason,
      });

      if (process.env.NODE_ENV === 'development') {
        console.debug(
          `[actionPolicy] Blocked (${reason}): alert=${alert.id} ` +
          `metric=${alert.metric} severity=${alert.severity}`,
        );
      }
      return false;
    }

    // ── All policies passed — record execution and allow ──────────────────
    _recordExecution(alert, nowMs);
    return true;

  } catch (err) {
    // Policy must never block delivery due to an internal error.
    // Log and allow through — the dedup/rate-limit layers still protect.
    if (process.env.NODE_ENV === 'development') {
      console.error('[actionPolicy] Unexpected error — defaulting to allow.', err);
    }
    return true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DIAGNOSTICS / TESTING UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Flush all policy state.
 *
 * Intended for:
 *   - Unit tests that need a clean slate between cases.
 *   - Operator reset (e.g. after a false-alarm escalation).
 *
 * Has no effect on the dispatcher or alert state.
 */
export function flushActionPolicy(): void {
  _executionTimestamps.clear();
  _criticalBurstLog.length = 0;
}

/**
 * Current number of tracked (id, metric) pairs in the rapid-repeat store.
 * Useful for diagnostics and test assertions.
 */
export function actionPolicySize(): number {
  return _executionTimestamps.size;
}

/**
 * Current number of critical alerts tracked in the burst window.
 * Useful for diagnostics and test assertions.
 */
export function criticalBurstCount(): number {
  return _criticalBurstLog.length;
}