/**
 * @file lib/alertDedup.ts
 * @description In-memory alert deduplication cache.
 *
 * PURPOSE:
 *   Prevents the same alert from being dispatched to external channels
 *   repeatedly when metrics are polled on an interval. Without dedup,
 *   a sustained threshold breach would flood Slack/email every N seconds.
 *
 * STRATEGY:
 *   Each alert is keyed by { type (id), metric, timeWindow bucket }.
 *   The timeWindow bucket collapses all evaluations within the cooldown
 *   period to a single dispatch slot. Once an alert fires, subsequent
 *   identical alerts are suppressed until the cooldown expires.
 *
 * SEVERITY-BASED COOLDOWNS:
 *   critical — 10 min  (re-alert quickly; critical issues need fast loops)
 *   high     — 20 min
 *   medium   — 30 min
 *   low      — 60 min  (low-priority noise reduction)
 *
 * STORAGE ABSTRACTION (v2):
 *   Storage is now delegated to a DedupStore (see alertDedupStore.ts).
 *   The PUBLIC API of this module is UNCHANGED — isDuplicate, flushDedupCache,
 *   dedupCacheSize all have the same signatures and semantics as before.
 *
 *   The default store is InMemoryDedupStore — behaviourally identical to the
 *   original private Map. No call-site changes are required. The abstraction
 *   is purely internal to this file and alertDedupStore.ts.
 *
 *   To inject a persistent store (Redis, etc.), call setDedupStore() once
 *   at application bootstrap. See alertDedupStore.ts for details.
 *
 * SCOPE:
 *   Internal — consumed only by alertDispatcher.ts.
 *   Must NOT be imported by hooks, UI, or pages.
 */

import type { Alert, AlertSeverity } from '@/lib/alerts';
import { getDedupStore }             from '@/lib/alertDedupStore';

// ─────────────────────────────────────────────────────────────────────────────
// COOLDOWN CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimum milliseconds between two dispatches of the same alert.
 * Keyed by severity so critical alerts re-fire sooner than low-priority ones.
 *
 * Rationale per tier:
 *   critical — 10 min: responders need to know if the condition persists
 *   high     — 20 min: fast follow-up, but avoids instant re-spam
 *   medium   — 30 min: standard SaaS ops window
 *   low      — 60 min: informational; daily digest cadence is fine
 */
export const COOLDOWN_MS: Record<AlertSeverity, number> = {
  critical:  10 * 60 * 1000,   // 10 min
  high:      20 * 60 * 1000,   // 20 min
  medium:    30 * 60 * 1000,   // 30 min
  low:       60 * 60 * 1000,   // 60 min
};

// ─────────────────────────────────────────────────────────────────────────────
// TTL REFINEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Severity-aware dedup TTL map.
 *
 * The TTL controls how long the dedup cache suppresses re-fires of the same
 * alert. It is deliberately SHORTER than COOLDOWN_MS for critical alerts so
 * that persistent critical conditions re-surface quickly without having to
 * wait the full cooldown window.
 *
 * Rationale per tier:
 *   critical —  5 min: fast re-alert loop; operators need to know it persists
 *   high     — 15 min: noticeable but not constant
 *   medium   — 25 min: standard ops cadence, slightly under cooldown
 *   low      — 55 min: near-cooldown; low alerts are informational
 *
 * RELATIONSHIP TO COOLDOWN_MS:
 *   COOLDOWN_MS controls the TIME WINDOW bucket in the dedup key (how long
 *   the same clock-slot key stays active). DEDUP_TTL_MS controls how long
 *   the store entry is considered live. For persistent stores (e.g. Redis),
 *   this is the expiry passed to SET EX — ensuring entries auto-expire even
 *   if flushDedupCache() is never called.
 *
 *   In the default InMemoryDedupStore, TTL is enforced on get() via timestamp
 *   comparison — the store rejects stale entries and the dedup falls through.
 *
 * CENTRALIZATION NOTE:
 *   All TTL values live in DEDUP_TTL_BY_SEVERITY. getDedupTTL() is the single
 *   read path — no call-site needs to know severity names or ms values.
 *   Adding a new severity (or renaming one) requires editing only this map.
 */
const DEDUP_TTL_BY_SEVERITY: Partial<Record<AlertSeverity, number>> & { [key: string]: number } = {
  critical:  5  * 60_000,   //  5 min — shorter than cooldown (10 min); fast re-alert for incidents
  high:      15 * 60_000,   // 15 min — shorter than cooldown (20 min)
  medium:    25 * 60_000,   // 25 min — shorter than cooldown (30 min)
  low:       55 * 60_000,   // 55 min — near cooldown     (60 min)
  // 'warning' maps to the same bucket as 'high' for forward-compatibility if
  // the Alert type gains a 'warning' severity tier in a future schema revision.
  warning:   15 * 60_000,   // alias → same as 'high'
};

/**
 * Fallback TTL used when alert.severity is not found in DEDUP_TTL_BY_SEVERITY.
 *
 * This should never trigger for well-formed alerts (all four current severities
 * are present in the map). It is a defensive guard against future schema changes
 * or misconfigured alert rules producing an unrecognised severity string.
 *
 * Value: 15 min — conservative middle-ground that avoids both flood and silence.
 */
const DEDUP_TTL_FALLBACK_MS = 15 * 60_000;

/**
 * Returns the dedup store TTL (in ms) appropriate for the given alert.
 *
 * Reads from DEDUP_TTL_BY_SEVERITY — the single source of truth for all TTL
 * values. Falls back to DEDUP_TTL_FALLBACK_MS if the severity is unrecognised,
 * ensuring the function never returns undefined or 0.
 *
 * The TTL is passed to store.set() so that persistent stores (future Redis,
 * IndexedDB) can express expiry natively. For InMemoryDedupStore, the store
 * uses this value to validate entries on read.
 *
 * DESIGN INVARIANTS:
 *   - Public API of isDuplicate() is UNCHANGED — this is purely internal.
 *   - TTL is always shorter than or equal to the corresponding COOLDOWN_MS,
 *     so entries expire before the cooldown window boundary — never after.
 *   - Critical alerts get the shortest TTL: fast re-alert loop for incidents.
 *   - Unrecognised severities get DEDUP_TTL_FALLBACK_MS — never undefined.
 *
 * @param alert - The alert being evaluated.
 * @returns     TTL in milliseconds. Always a positive integer.
 */
export function getDedupTTL(alert: Alert): number {
  return DEDUP_TTL_BY_SEVERITY[alert.severity] ?? DEDUP_TTL_FALLBACK_MS;
}

// ─────────────────────────────────────────────────────────────────────────────
// KEY CONSTRUCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a stable dedup key for an alert.
 *
 * Format: "<alert.id>:<alert.metric>:<timeWindow>"
 *
 * The timeWindow bucket is derived by flooring the current timestamp to the
 * nearest cooldown boundary for this alert's severity. This means two calls
 * within the same cooldown window always produce the same key — the second
 * is identified as a duplicate and suppressed.
 *
 * WHY include timeWindow in the key?
 *   Without it, an alert that fired at 09:00 would suppress the 09:45 alert
 *   forever (until the cache is manually cleared). With the bucket, the key
 *   for the 09:45 evaluation uses a different bucket value, so it passes dedup
 *   as a new occurrence. This gives predictable, clock-relative re-alert
 *   windows instead of open-ended suppression.
 *
 * @internal
 */
export function _buildDedupKey(alert: Alert, now: number = Date.now()): string {
  const cooldown   = COOLDOWN_MS[alert.severity];
  const timeWindow = Math.floor(now / cooldown);
  return `${alert.id}:${alert.metric}:${timeWindow}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if this alert has already been dispatched within its cooldown window.
 *
 * Side-effect: on a cache HIT the entry is left unchanged (suppressed).
 *              On a cache MISS the entry is written (alert will be dispatched).
 *
 * Storage delegation: all state lives in the active DedupStore (default:
 * InMemoryDedupStore). Behaviour is identical to the original Map-based
 * implementation. The TTL passed to store.set() matches the severity cooldown
 * so that persistent stores (future Redis) can express expiry natively.
 *
 * @param alert - The alert to check.
 * @param now   - Optional override for current time (enables deterministic tests).
 * @returns     true → suppress; false → dispatch allowed.
 */
export function isDuplicate(alert: Alert, now: number = Date.now()): boolean {
  const store = getDedupStore();
  const key   = _buildDedupKey(alert, now);

  if (store.has(key)) {
    // Already dispatched within this time window — suppress.
    return true;
  }

  // First occurrence in this window — record with severity-aware TTL.
  // getDedupTTL() returns a TTL shorter than the cooldown for critical alerts,
  // ensuring cache entries expire promptly so persistent critical conditions
  // can re-surface without manual intervention.
  store.set(key, getDedupTTL(alert));
  return false;
}

/**
 * Force-clear the dedup cache.
 *
 * USE CASES:
 *  1. Unit tests — reset state between test cases.
 *  2. Explicit "re-notify" action triggered by an operator.
 *
 * Must NOT be called automatically by the dispatcher — that would defeat dedup.
 */
export function flushDedupCache(): void {
  getDedupStore().clear();
}

/**
 * Returns the number of entries currently in the dedup cache.
 * Intended for diagnostics and tests only.
 */
export function dedupCacheSize(): number {
  return getDedupStore().size();
}