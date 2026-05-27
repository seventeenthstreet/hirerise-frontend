/**
 * @file lib/metricsTransform.ts
 * @description Pure helper functions for formatting and computing metric values.
 *
 * RULES (non-negotiable):
 *  - NO imports — zero dependencies, fully portable
 *  - NO state, NO side effects — pure input → output
 *  - NO API calls, NO React — this file has no awareness of the app layer
 *  - All functions are exported and individually testable
 *
 * Used by:
 *  - hooks/useMetrics.ts  → applies formatting before returning `formattedDerived`
 *
 * NOT used by:
 *  - UI components — they receive pre-formatted strings from the hook
 *  - pages         — same; all formatting happens in the hook layer
 *
 * Architecture position: lib utility (shared across layers, owned by no layer)
 *   API → Hooks → UI → Pages → Guards → Context
 *          ↑
 *     metricsTransform.ts feeds into the Hooks layer only
 */

// ─────────────────────────────────────────────────────────────────────────────
// computeDelta
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the absolute difference between a current value and a reference value.
 *
 * Returns `current - previous` (signed).
 * Positive → current is higher than reference.
 * Negative → current is lower than reference.
 *
 * Use cases:
 *  - Period-over-period change: computeDelta(thisWeek, lastWeek)
 *  - Distance from target:      computeDelta(overallHealthScore, 1.0)
 *  - Funnel drop-off:           computeDelta(conversionRate, uploadSuccessRate)
 *
 * @param current   - The value being evaluated
 * @param previous  - The reference / baseline value
 * @returns Signed delta: current − previous
 *
 * @example
 * computeDelta(0.82, 0.78)  // → 0.04  (improved by 4 pp)
 * computeDelta(0.72, 1.0)   // → -0.28 (28 pp below perfect health)
 */
export function computeDelta(current: number, previous: number): number {
  return current - previous;
}

// ─────────────────────────────────────────────────────────────────────────────
// computeTrend
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classify the direction of change between two values.
 *
 * Returns:
 *  'up'      → current is meaningfully higher than previous (delta > threshold)
 *  'down'    → current is meaningfully lower than previous  (delta < -threshold)
 *  'neutral' → change is within the noise threshold
 *
 * Threshold default (0.001) treats sub-0.1pp moves as neutral, preventing
 * spurious trend arrows on stable metrics due to floating-point rounding.
 * Pass a custom threshold for metrics with different sensitivity requirements
 * (e.g. latency in ms needs a larger threshold than 0–1 rates).
 *
 * Pure function — no side effects. Safe to call in useMemo.
 *
 * @param current   - Current period value
 * @param previous  - Previous period / baseline value
 * @param threshold - Minimum absolute delta to register as up/down (default 0.001)
 * @returns 'up' | 'down' | 'neutral'
 *
 * @example
 * computeTrend(0.82, 0.78)   // → 'up'    (+0.04, above threshold)
 * computeTrend(0.72, 0.80)   // → 'down'  (-0.08, below -threshold)
 * computeTrend(0.82, 0.8201) // → 'neutral' (delta < 0.001)
 */
export function computeTrend(
  current:   number,
  previous:  number,
  threshold = 0.001,
): 'up' | 'down' | 'neutral' {
  const delta = current - previous;
  if (delta >  threshold) return 'up';
  if (delta < -threshold) return 'down';
  return 'neutral';
}

// ─────────────────────────────────────────────────────────────────────────────
// formatPercentage
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a 0–1 decimal fraction as a percentage string with one decimal place.
 *
 * Behaviour:
 *  - Multiplies by 100 before formatting
 *  - Always shows exactly one decimal place for scan-consistency in tables
 *  - Does NOT add a leading "+" for positive values — callers add sign if needed
 *  - Clamps display to 0.0%–100.0% (raw value may exceed bounds due to floating
 *    point; clamping is cosmetic only and does not mutate the input)
 *
 * @param value - A 0–1 decimal fraction (e.g. 0.843 → "84.3%")
 * @returns Formatted percentage string including the "%" symbol
 *
 * @example
 * formatPercentage(0.843)  // → "84.3%"
 * formatPercentage(0)      // → "0.0%"
 * formatPercentage(1)      // → "100.0%"
 * formatPercentage(0.0035) // → "0.4%"  (rounds to 1 dp)
 */
export function formatPercentage(value: number): string {
  const clamped = Math.min(100, Math.max(0, value * 100));
  return `${clamped.toFixed(1)}%`;
}

// ─────────────────────────────────────────────────────────────────────────────
// formatDuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a duration in milliseconds as a compact human-readable string.
 *
 * Scale thresholds (chosen to match the range of observed analytics metrics):
 *  < 1 000 ms   → "Xms"         (e.g. "450ms")
 *  < 60 000 ms  → "X.Xs"        (e.g. "4.2s")
 *  < 3 600 000  → "Xm Ys"       (e.g. "2m 15s")
 *  ≥ 3 600 000  → "Xh Ym"       (e.g. "1h 4m")
 *
 * Rules:
 *  - Negative values are treated as 0 (guard against inverted timestamps)
 *  - Values are NOT rounded to avoid masking meaningful latency differences
 *    at the p95/p99 level — truncation used below the seconds boundary
 *
 * @param ms - Duration in milliseconds (must be ≥ 0)
 * @returns Human-readable duration string
 *
 * @example
 * formatDuration(320)        // → "320ms"
 * formatDuration(4_200)      // → "4.2s"
 * formatDuration(135_000)    // → "2m 15s"
 * formatDuration(3_840_000)  // → "1h 4m"
 * formatDuration(-50)        // → "0ms"  (negative guard)
 */
export function formatDuration(ms: number): string {
  const safe = Math.max(0, ms);

  if (safe < 1_000) {
    return `${Math.floor(safe)}ms`;
  }
  if (safe < 60_000) {
    return `${(safe / 1_000).toFixed(1)}s`;
  }
  if (safe < 3_600_000) {
    const minutes = Math.floor(safe / 60_000);
    const seconds = Math.floor((safe % 60_000) / 1_000);
    return `${minutes}m ${seconds}s`;
  }
  const hours   = Math.floor(safe / 3_600_000);
  const minutes = Math.floor((safe % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}
