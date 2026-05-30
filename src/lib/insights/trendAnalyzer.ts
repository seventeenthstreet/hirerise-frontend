/**
 * @file lib/insights/trendAnalyzer.ts
 * @description Consecutive-period trend detection with flat tolerance and explainability.
 *
 * STRATEGY:
 *   A trend fires when a metric moves consistently in one direction for
 *   ≥ MIN_CONSECUTIVE periods. A flat tolerance window suppresses noise for
 *   metrics that oscillate slightly around a stable value.
 *
 * EXPLAINABILITY:
 *   Each detected trend carries:
 *     reasonType  = 'trend'
 *     confidence  = consecutivePeriods / maxPeriods
 *     drivers     = [metricKey + direction + period count]
 *
 * RULES:
 *   - No throw propagation — returns empty array on any error
 *   - No imports from React, hooks, UI, or alert system
 *   - Pure TypeScript — deterministic given same input
 *   - No randomness
 */

import type { Insight, InsightMetricsInput, InsightSeverity } from './insightTypes';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum consecutive periods to declare a trend. */
const MIN_CONSECUTIVE = 3;

/**
 * Maximum periods used for confidence normalisation.
 * confidence = consecutive / MAX_PERIODS, capped at 1.
 */
const MAX_PERIODS = 6;

/**
 * Flat tolerance: relative change below this threshold is treated as flat (not trending).
 * Prevents minor oscillations (e.g. 0.495 → 0.505) from counting as direction changes.
 */
const FLAT_TOLERANCE = 0.005; // 0.5%

// ─────────────────────────────────────────────────────────────────────────────
// METRIC DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

interface TrendMetricDef {
  key:       string;
  extract:   (m: InsightMetricsInput) => number | null;
  /**
   * Which direction is concerning for operator awareness:
   *   'down_bad' → declining value needs attention (e.g. conversion)
   *   'up_bad'   → rising value needs attention (e.g. error rate)
   *   'both'     → any sustained movement is notable
   */
  direction: 'down_bad' | 'up_bad' | 'both';
  severity:  InsightSeverity;
}

const TREND_METRICS: TrendMetricDef[] = [
  {
    key:       'end_to_end_conversion_rate',
    extract:   m => m.resumeFunnel?.end_to_end_conversion_rate ?? null,
    direction: 'down_bad',
    severity:  'high',
  },
  {
    key:       'resume_failure_rate',
    extract:   m => m.reliability?.resume_failure_rate ?? null,
    direction: 'up_bad',
    severity:  'high',
  },
  {
    key:       'timeout_rate',
    extract:   m => m.reliability?.timeout_rate ?? null,
    direction: 'up_bad',
    severity:  'high',
  },
  {
    key:       'onboarding_completion_rate',
    extract:   m => m.onboarding?.onboarding_completion_rate ?? null,
    direction: 'down_bad',
    severity:  'medium',
  },
  {
    key:       'processing_p95_ms',
    extract:   m => m.performance?.processing_p95_ms ?? null,
    direction: 'up_bad',
    severity:  'medium',
  },
  {
    key:       'upload_success_rate',
    extract:   m => m.resumeFunnel?.upload_success_rate ?? null,
    direction: 'down_bad',
    severity:  'medium',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// CORE ALGORITHM
// ─────────────────────────────────────────────────────────────────────────────

type TrendDirection = 'up' | 'down' | 'flat';

/**
 * Count consecutive same-direction steps at the tail of a history array,
 * respecting the flat tolerance window.
 *
 * @returns { consecutive, direction } where consecutive ≥ 0
 */
function countConsecutiveTrend(
  history: number[],
  flatTolerance: number,
): { consecutive: number; direction: TrendDirection } {
  if (history.length < 2) return { consecutive: 0, direction: 'flat' };

  // Determine the direction of the most recent step
  const last  = history[history.length - 1];
  const prev  = history[history.length - 2];
  const relChange = prev !== 0 ? (last - prev) / Math.abs(prev) : 0;

  let tailDirection: TrendDirection;
  if (Math.abs(relChange) < flatTolerance) {
    tailDirection = 'flat';
  } else {
    tailDirection = relChange > 0 ? 'up' : 'down';
  }

  if (tailDirection === 'flat') return { consecutive: 0, direction: 'flat' };

  // Walk backwards counting consecutive same-direction steps
  let count = 1;
  for (let i = history.length - 2; i >= 1; i--) {
    const cur  = history[i];
    const prv  = history[i - 1];
    const rc   = prv !== 0 ? (cur - prv) / Math.abs(prv) : 0;

    if (Math.abs(rc) < flatTolerance) break; // flat step breaks the streak
    const stepDir: TrendDirection = rc > 0 ? 'up' : 'down';
    if (stepDir !== tailDirection) break;

    count++;
  }

  return { consecutive: count, direction: tailDirection };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyze trends across all registered metrics.
 *
 * For each metric:
 *   1. Extract current value — skip if null (section not loaded)
 *   2. Build full history including current value
 *   3. Count consecutive tail trend with flat tolerance
 *   4. Emit Insight only when consecutive ≥ MIN_CONSECUTIVE and direction matches concern
 *
 * @returns Array of trend Insights (empty if no trends or on error).
 */
export function analyzeTrends(metrics: InsightMetricsInput): Insight[] {
  try {
    const now     = metrics.nowMs ?? Date.now();
    const history = metrics.history ?? {};
    const results: Insight[] = [];

    for (const def of TREND_METRICS) {
      try {
        const value = def.extract(metrics);
        if (value === null) continue;

        const hist    = history[def.key] ?? [];
        const fullHist = [...hist, value]; // include current point

        if (fullHist.length < MIN_CONSECUTIVE + 1) continue;

        const { consecutive, direction } = countConsecutiveTrend(fullHist, FLAT_TOLERANCE);

        if (consecutive < MIN_CONSECUTIVE) continue;

        // Check if this direction is concerning for this metric
        const isConcerning =
          def.direction === 'both' ||
          (def.direction === 'down_bad' && direction === 'down') ||
          (def.direction === 'up_bad'   && direction === 'up');

        if (!isConcerning) continue;

        // ── Explainability ────────────────────────────────────────────────
        const dirLabel    = direction === 'up' ? '↑' : '↓';
        const confidence  = Math.min(consecutive / MAX_PERIODS, 1);
        const driverLabel = `${def.key}${dirLabel} for ${consecutive} consecutive periods`;

        const severityWeight: Record<InsightSeverity, number> = {
          critical: 1.0,
          high:     0.8,
          medium:   0.6,
          low:      0.4,
        };
        const score = Math.round(confidence * (severityWeight[def.severity] ?? 0.5) * 100);

        const trendVerb   = direction === 'up' ? 'rising' : 'declining';
        const message     = `${def.key} has been ${trendVerb} for ${consecutive} consecutive periods`;

        results.push({
          type:       'trend',
          metric:     def.key,
          message,
          score,
          firedAt:    now,
          severity:   def.severity,
          reasonType: 'trend',
          confidence: parseFloat(confidence.toFixed(3)),
          drivers:    [driverLabel],
        });
      } catch {
        continue;
      }
    }

    return results;
  } catch {
    return [];
  }
}