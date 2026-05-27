/**
 * @file lib/insights/insightMemory.ts
 * @description Insight stability layer — suppresses repeated insights across runs.
 *
 * PURPOSE:
 *   Prevents the same insight from flooding consumers on every evaluation cycle.
 *   Mirrors the pattern in alertDedup.ts but is scoped exclusively to insights
 *   so the alert system remains completely untouched.
 *
 * STRATEGY:
 *   Each insight is keyed by `${type}:${metric}:${reasonType ?? 'base'}`. Once an insight emits, its
 *   key is stored with a timestamp. Subsequent calls to shouldEmitInsight()
 *   return false until the cooldown window expires.
 *
 * SEVERITY-BASED COOLDOWNS:
 *   critical — 10 min  (urgent; short loop so persistent problems resurface)
 *   high     — 15 min
 *   medium   — 20 min
 *   low      — 30 min  (informational; noise reduction)
 *
 * DESIGN RULES:
 *   - In-memory Map only — no external storage, no persistence
 *   - No throw propagation — all ops are guarded
 *   - No imports from React, hooks, or UI
 *   - Pure TypeScript — deterministic given same input + time
 *   - Additive only — no existing code modified
 */

import type { Insight } from './insightTypes';

// ─────────────────────────────────────────────────────────────────────────────
// COOLDOWN CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Severity-based cooldown windows (ms).
 *
 * Critical insights get the shortest cooldown so persistent critical conditions
 * keep re-surfacing for operators. Low-severity insights are suppressed longer
 * to reduce informational noise.
 */
export const INSIGHT_COOLDOWN_MS: Record<string, number> = {
  critical:  10 * 60_000,   // 10 min
  high:      15 * 60_000,   // 15 min
  medium:    20 * 60_000,   // 20 min
  low:       30 * 60_000,   // 30 min
};

/** Fallback cooldown when severity is unrecognised. Conservative middle-ground. */
const COOLDOWN_FALLBACK_MS = 20 * 60_000; // 20 min

// ─────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * In-memory record of the last emission time per insight key.
 * Module-level singleton — same lifecycle as alertDedupStore's InMemoryDedupStore.
 * Map is never reassigned; only entries are mutated.
 */
const _memoryStore = new Map<string, number>();

// ─────────────────────────────────────────────────────────────────────────────
// KEY CONSTRUCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize a key segment to prevent casing or whitespace variations from
 * producing phantom cache misses.
 *
 * Rules:
 *   - undefined/null → 'base'  (safe fallback, same as before)
 *   - any string     → lowercased + trimmed
 *
 * Normal clean inputs (e.g. 'anomaly', 'trend', 'correlation') are unchanged
 * by this transform — it only protects against edge-case dirty data from
 * upstream producers.
 *
 * @internal
 */
function _normalizeKeyPart(value?: string): string {
  return (value ?? 'base').toLowerCase().trim();
}

/**
 * Build a stable memory key for an insight.
 *
 * Format: `${type}:${metric}:${normalizeKeyPart(reasonType)}`
 *
 * Including reasonType prevents different production paths on the same metric
 * (e.g. a z-score anomaly vs a fallback anomaly) from collapsing to one
 * cooldown slot and silencing each other.
 *
 * normalizeKeyPart() guards against casing/whitespace edge cases without
 * affecting normal clean inputs. Cooldown logic is completely unchanged.
 *
 * @internal — exported only for unit tests
 */
export function _buildInsightKey(insight: Insight): string {
  return `${insight.type}:${insight.metric}:${_normalizeKeyPart(insight.reasonType)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// COOLDOWN RESOLUTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the cooldown window (ms) for the given insight.
 *
 * Reads from INSIGHT_COOLDOWN_MS keyed by `insight.severity` (when present)
 * or falls back to COOLDOWN_FALLBACK_MS. The Insight type carries an optional
 * `severity` field — correlation insights that lack it receive the fallback.
 *
 * @internal
 */
function _getCooldown(insight: Insight): number {
  const sev = (insight as { severity?: string }).severity;
  if (sev && INSIGHT_COOLDOWN_MS[sev] !== undefined) {
    return INSIGHT_COOLDOWN_MS[sev];
  }
  return COOLDOWN_FALLBACK_MS;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines whether an insight should be emitted.
 *
 * Returns `true`  → insight is new or cooldown expired → emit it
 * Returns `false` → insight was emitted recently → suppress
 *
 * Side-effect: on a PASS (return true), records the current timestamp so the
 *              next call within the cooldown window will be suppressed.
 *
 * This function never throws — all Map operations are safe.
 *
 * @param insight - The candidate insight.
 * @param nowMs   - Current time override (enables deterministic tests). Defaults to Date.now().
 * @returns       true when the insight should be emitted.
 */
export function shouldEmitInsight(insight: Insight, nowMs: number = Date.now()): boolean {
  try {
    const key      = _buildInsightKey(insight);
    const lastSeen = _memoryStore.get(key);
    const cooldown = _getCooldown(insight);

    if (lastSeen !== undefined && nowMs - lastSeen < cooldown) {
      // Within cooldown window — suppress
      return false;
    }

    // Outside window (or first emission) — record and allow
    _memoryStore.set(key, nowMs);
    return true;
  } catch {
    // Never block emission on a storage error
    return true;
  }
}

/**
 * Filter an array of insights through the memory layer.
 *
 * Convenience wrapper: applies shouldEmitInsight() to every element and
 * returns only those that pass. Order is preserved.
 *
 * @param insights - Candidate insights from the scoring stage.
 * @param nowMs    - Current time override (for deterministic tests).
 * @returns        Filtered array (may be empty if all are suppressed).
 */
export function filterByMemory(insights: Insight[], nowMs: number = Date.now()): Insight[] {
  try {
    return insights.filter(i => shouldEmitInsight(i, nowMs));
  } catch {
    // On any unexpected error, return full list so insights are never
    // silently swallowed by the memory layer.
    return insights;
  }
}

/**
 * Force-clear the memory store.
 *
 * USE CASES:
 *  1. Unit tests — reset state between test cases.
 *  2. Explicit operator "re-notify" trigger.
 *
 * Must NOT be called automatically during normal evaluation cycles.
 */
export function flushInsightMemory(): void {
  _memoryStore.clear();
}

/**
 * Returns the number of keys currently in the memory store.
 * Intended for diagnostics and tests only.
 */
export function insightMemorySize(): number {
  return _memoryStore.size;
}