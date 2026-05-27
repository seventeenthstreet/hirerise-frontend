/**
 * @file lib/insights/scoring.ts
 * @description Deterministic scoring and deduplication for insights.
 *
 * SCORING RULES:
 *   Base score:         from the detector (0–100)
 *   Severity modifier:  critical+20, high+10, medium+0, low-10
 *   Confidence boost:   +round(confidence * 15) when confidence is present
 *   Score is clamped to [0, 100] after all modifiers.
 *
 * DEDUPLICATION:
 *   Key: `${type}:${metric}`
 *   When two insights share a key, keep the one with the higher final score.
 *   This prevents both a 'high' and 'critical' anomaly on the same metric
 *   from appearing simultaneously — the stronger one wins.
 *
 * SORTING:
 *   Final output is sorted descending by score so the most important
 *   insights appear first.
 *
 * RULES:
 *   - No throw propagation — returns empty array on any error
 *   - No randomness — deterministic given same input
 *   - No imports from React, hooks, UI, or alert system
 */

import type { Insight, InsightSeverity } from './insightTypes';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

/** Score modifier applied per severity level. */
const SEVERITY_MODIFIER: Partial<Record<InsightSeverity, number>> & { default: number } = {
  critical: 20,
  high:     10,
  medium:   0,
  low:      -10,
  default:  0,
};

/** Maximum confidence boost. Applied as: floor(confidence * CONFIDENCE_BOOST_MAX). */
const CONFIDENCE_BOOST_MAX = 15;

/**
 * Minimum normalizedConfidence value.
 *
 * Prevents very low raw confidence values (e.g. 0.01) from producing
 * near-zero normalizedConfidence after type weighting. A floor of 0.05
 * ensures all insights that reach the scoring stage carry a meaningful,
 * non-degenerate confidence signal.
 *
 * Only affects insights with baseConfidence * typeWeight < 0.05 — a
 * rare edge case in normal operation (0.05 / 0.7 ≈ 0.07 raw threshold
 * for trend insights; lower for anomaly/correlation).
 *
 * Does NOT affect the original `confidence` field or `computeScore`.
 */
const CONFIDENCE_FLOOR = 0.05;

/**
 * Type-based confidence weight.
 *
 * Reflects the inherent signal strength of each insight type:
 *   anomaly / correlation — statistically or rule-grounded → full weight (1.0)
 *   risk                  — domain-derived heuristic       → 0.9
 *   trend                 — directional, not conclusive    → 0.7
 *   opportunity           — speculative upside             → 0.6
 *
 * Applied as: normalizedConfidence = baseConfidence * typeWeight
 * The original `confidence` field is preserved; `normalizedConfidence` is
 * added as an optional field so downstream consumers can opt-in without
 * breaking existing callers that read only `confidence`.
 */
const TYPE_WEIGHT: Record<string, number> = {
  anomaly:     1.0,
  risk:        0.9,
  trend:       0.7,
  opportunity: 0.6,
  correlation: 1.0,
};

// ─────────────────────────────────────────────────────────────────────────────
// SCORING LOGIC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the final score for a single insight.
 *
 * Formula:
 *   finalScore = clamp(base + severityModifier + confidenceBoost, 0, 100)
 *
 * @internal
 */
export function computeScore(insight: Insight): number {
  try {
    const base      = insight.score ?? 0;
    const sevKey    = (insight as { severity?: InsightSeverity }).severity;
    const sevMod    = sevKey ? (SEVERITY_MODIFIER[sevKey] ?? SEVERITY_MODIFIER.default) : SEVERITY_MODIFIER.default;
    const confBoost = insight.confidence != null
      ? Math.round(insight.confidence * CONFIDENCE_BOOST_MAX)
      : 0;

    return Math.max(0, Math.min(100, base + sevMod + confBoost));
  } catch {
    return insight.score ?? 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DEDUPLICATION LOGIC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a stable dedup key for an insight.
 * Format: `${type}:${metric}`
 *
 * @internal
 */
function _buildDedupKey(insight: Insight): string {
  return `${insight.type}:${insight.metric}`;
}

/**
 * Deduplicate insights: when two share the same key, keep the higher-scored one.
 *
 * This is O(n) using a single Map pass — appropriate for the expected
 * small number of insights per evaluation cycle (typically 3–15).
 *
 * @internal
 */
function _dedup(scored: Array<{ insight: Insight; finalScore: number }>): Array<{ insight: Insight; finalScore: number }> {
  const best = new Map<string, { insight: Insight; finalScore: number }>();

  for (const entry of scored) {
    const key      = _buildDedupKey(entry.insight);
    const existing = best.get(key);

    if (!existing || entry.finalScore > existing.finalScore) {
      best.set(key, entry);
    }
  }

  return Array.from(best.values());
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Score, deduplicate, and sort an array of insights.
 *
 * Pipeline:
 *   1. Compute final score for each insight (base + severity + confidence)
 *   2. Deduplicate by key (keep highest-scored per key)
 *   3. Mutate insight.score to the final score (in-place — same object refs)
 *   4. Sort descending by final score
 *
 * @param insights - Raw insights from detectors
 * @returns        Scored, deduped, sorted insights
 */
export function scoreAndDedup(insights: Insight[]): Insight[] {
  try {
    if (insights.length === 0) return [];

    // ── Step 1: Score + normalise confidence ──────────────────────────────
    const scored = insights.map(insight => {
      // Attach normalizedConfidence (additive optional field — never overwrites
      // the original confidence that detectors depend on).
      if (insight.confidence != null) {
        const weight = TYPE_WEIGHT[insight.type] ?? 1.0;
        // Floor at CONFIDENCE_FLOOR so near-zero raw values don't produce
        // degenerate normalizedConfidence outputs. Clamp upper bound to 1.
        // Round to 4 dp for stable deterministic output across float ops.
        const raw = Math.max(CONFIDENCE_FLOOR, Math.min(1, insight.confidence * weight));
        (insight as Insight & { normalizedConfidence?: number }).normalizedConfidence =
          Math.round(raw * 10_000) / 10_000;
      }

      return {
        insight,
        finalScore: computeScore(insight),
      };
    });

    // ── Step 2: Dedup ─────────────────────────────────────────────────────
    const deduped = _dedup(scored);

    // ── Step 3 & 4: Apply final score + sort ──────────────────────────────
    for (const entry of deduped) {
      entry.insight.score = entry.finalScore;
    }

    deduped.sort((a, b) => b.finalScore - a.finalScore);

    return deduped.map(e => e.insight);
  } catch {
    return insights;
  }
}