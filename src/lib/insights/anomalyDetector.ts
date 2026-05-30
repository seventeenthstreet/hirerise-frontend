/**
 * @file lib/insights/anomalyDetector.ts
 * @description Statistical anomaly detection with structured explainability.
 *
 * STRATEGY:
 *   Primary:  z-score against historical mean/stddev. Fires when |z| ≥ Z_THRESHOLD.
 *   Fallback: percentage deviation from the last known value when history < MIN_SAMPLES.
 *             Fires when |delta%| ≥ FALLBACK_THRESHOLD.
 *
 * EXPLAINABILITY:
 *   Each detected anomaly carries:
 *     reasonType  = 'anomaly'
 *     confidence  = min(|z| / Z_MAX, 1)   — normalised z-score
 *     drivers     = [metricKey + direction label]
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

/** Minimum history samples required to use z-score path. */
const MIN_SAMPLES = 5;

/** z-score magnitude at which we declare an anomaly. */
const Z_THRESHOLD = 2.0;

/** Maximum z-score used for confidence normalisation (avoids values > 1). */
const Z_MAX = 4.0;

/** Fallback: % deviation threshold when history is insufficient. */
const FALLBACK_THRESHOLD = 0.20; // 20%

// ─────────────────────────────────────────────────────────────────────────────
// METRIC EXTRACTION MAP
// Each entry maps a metricKey → extractor fn + severity hint + direction
// ─────────────────────────────────────────────────────────────────────────────

interface AnomalyMetricDef {
  key:      string;
  extract:  (m: InsightMetricsInput) => number | null;
  /**
   * 'low_bad'  → below-average value is the concern (e.g. conversion rate)
   * 'high_bad' → above-average value is the concern (e.g. error rate, latency)
   */
  direction: 'low_bad' | 'high_bad';
  severity:  InsightSeverity;
}

const ANOMALY_METRICS: AnomalyMetricDef[] = [
  {
    key:       'end_to_end_conversion_rate',
    extract:   m => m.resumeFunnel?.end_to_end_conversion_rate ?? null,
    direction: 'low_bad',
    severity:  'high',
  },
  {
    key:       'upload_success_rate',
    extract:   m => m.resumeFunnel?.upload_success_rate ?? null,
    direction: 'low_bad',
    severity:  'medium',
  },
  {
    key:       'resume_failure_rate',
    extract:   m => m.reliability?.resume_failure_rate ?? null,
    direction: 'high_bad',
    severity:  'high',
  },
  {
    key:       'timeout_rate',
    extract:   m => m.reliability?.timeout_rate ?? null,
    direction: 'high_bad',
    severity:  'high',
  },
  {
    key:       'monitoring_error_rate',
    extract:   m => m.reliability?.monitoring_error_rate ?? null,
    direction: 'high_bad',
    severity:  'medium',
  },
  {
    key:       'processing_p95_ms',
    extract:   m => m.performance?.processing_p95_ms ?? null,
    direction: 'high_bad',
    severity:  'medium',
  },
  {
    key:       'onboarding_completion_rate',
    extract:   m => m.onboarding?.onboarding_completion_rate ?? null,
    direction: 'low_bad',
    severity:  'medium',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MATH HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stddev(values: number[], avg: number): number {
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect anomalies across all registered metrics.
 *
 * For each metric:
 *   1. Extract current value — skip if null (section not loaded)
 *   2. Retrieve history — use z-score if ≥ MIN_SAMPLES, else fallback
 *   3. Determine if anomalous; compute confidence
 *   4. Emit Insight with structured explainability fields
 *
 * @returns Array of anomaly Insights (empty if none detected or on error).
 */
export function detectAnomalies(metrics: InsightMetricsInput): Insight[] {
  try {
    const now     = metrics.nowMs ?? Date.now();
    const history = metrics.history ?? {};
    const results: Insight[] = [];

    for (const def of ANOMALY_METRICS) {
      try {
        const value = def.extract(metrics);
        if (value === null) continue;

        const hist = history[def.key] ?? [];
        let isAnomaly  = false;
        let confidence = 0;
        let method     = 'fallback';

        if (hist.length >= MIN_SAMPLES) {
          // ── z-score path ─────────────────────────────────────────────────
          const avg = mean(hist);
          const sd  = stddev(hist, avg);

          if (sd === 0) {
            // Zero variance — any deviation is anomalous
            isAnomaly  = value !== avg;
            confidence = isAnomaly ? 1 : 0;
          } else {
            const z   = (value - avg) / sd;
            isAnomaly = Math.abs(z) >= Z_THRESHOLD;
            confidence = Math.min(Math.abs(z) / Z_MAX, 1);
          }
          method = 'zscore';
        } else if (hist.length >= 1) {
          // ── Fallback: % deviation from last known ─────────────────────
          const last   = hist[hist.length - 1];
          if (last !== 0) {
            const pctDelta = Math.abs((value - last) / last);
            isAnomaly  = pctDelta >= FALLBACK_THRESHOLD;
            confidence = Math.min(pctDelta / (FALLBACK_THRESHOLD * 2), 1);
          }
        }

        if (!isAnomaly) continue;

        // ── Direction label for drivers ───────────────────────────────────
        const directionSymbol =
          hist.length >= 1
            ? (value < (hist[hist.length - 1] ?? value) ? '↓' : '↑')
            : '';
        const driverLabel = `${def.key}${directionSymbol} (${method})`;

        // ── Score: confidence × severity weight ───────────────────────────
        const severityWeight: Record<InsightSeverity, number> = {
          critical: 1.0,
          high:     0.8,
          medium:   0.6,
          low:      0.4,
        };
        const score = Math.round(confidence * (severityWeight[def.severity] ?? 0.5) * 100);

        const directionLabel =
          def.direction === 'high_bad'
            ? `Abnormally high ${def.key} detected`
            : `Abnormally low ${def.key} detected`;

        results.push({
          type:       'anomaly',
          metric:     def.key,
          message:    directionLabel,
          score,
          firedAt:    now,
          severity:   def.severity,
          reasonType: 'anomaly',
          confidence: parseFloat(confidence.toFixed(3)),
          drivers:    [driverLabel],
        });
      } catch {
        // Per-metric errors must never abort the whole detector
        continue;
      }
    }

    return results;
  } catch {
    return [];
  }
}