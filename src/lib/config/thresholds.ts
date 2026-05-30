/**
 * @file lib/config/thresholds.ts
 * @description Static threshold configuration — the single source of truth for
 *              all metric warning/critical boundaries.
 *
 * RULES:
 *  - NO imports from React, hooks, UI, or API layers
 *  - NO runtime logic — pure static data
 *  - Always serves as fallback when adaptive/dynamic thresholds are unavailable
 *  - Add new metric thresholds here; the engine picks them up automatically
 *
 * Architecture position: config layer, consumed by thresholdEngine only
 *   Config → ThresholdEngine → alerts.ts → Hooks
 */

import type { BaselineStrategy } from '@/lib/thresholds/baselineEngine';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration for a single metric's threshold boundaries.
 *
 * `direction` controls how breaches are evaluated:
 *  - 'decrease' → going lower is bad (e.g., conversion rate dropping)
 *  - 'increase' → going higher is bad (e.g., error rate climbing)
 *
 * `warning` and `critical` are expressed as fractional deltas from baseline:
 *  - For direction='decrease': warning=0.10 means 10% below baseline → warning
 *  - For direction='increase': warning=0.10 means 10% above baseline → warning
 *
 * For absolute-value metrics (no baseline comparison), use `absoluteWarning`
 * and `absoluteCritical` in addition — both checks are run and the most severe wins.
 */
export type ThresholdConfig = {
  /** Schema metric key — must match the key used in AlertMetricsInput. */
  metric: string;
  /**
   * Fractional delta from baseline that triggers a warning.
   * E.g. 0.10 = 10% deviation from baseline.
   */
  warning: number;
  /**
   * Fractional delta from baseline that triggers a critical alert.
   * E.g. 0.20 = 20% deviation from baseline.
   */
  critical: number;
  /** Which direction of change is considered a breach. */
  direction: 'increase' | 'decrease';
  /**
   * Baseline computation strategy for this metric.
   *
   * Choosing the right strategy per metric prevents the baseline from being
   * polluted by the wrong statistical anchor:
   *
   *   'mean'   / 'moving_average' — default; good for stable, slowly-drifting metrics
   *   'median'                    — robust to spikes; good for high-variance metrics
   *   'p25'    / 'percentile_25'  — anchors to good-performance days (higher-is-better)
   *   'p75'    / 'percentile_75'  — anchors to typical-bad days (lower-is-better, e.g. latency)
   *
   * Defaults to 'mean' if omitted — no existing metrics are broken.
   */
  baselineStrategy?: BaselineStrategy;
  /**
   * Optional: absolute value (not baseline-relative) for warning threshold.
   * When present, both absolute and relative thresholds are checked; the
   * more sensitive one (whichever fires first) takes precedence.
   */
  absoluteWarning?: number;
  /**
   * Optional: absolute value (not baseline-relative) for critical threshold.
   */
  absoluteCritical?: number;
  /**
   * Optional: minimum meaningful change below which fluctuations are ignored.
   * Overrides the global MIN_CHANGE_FRACTION in noiseFilter for this metric.
   */
  minChangeFraction?: number;
  /**
   * Sensitivity multiplier applied to adaptive thresholds.
   * > 1.0 = more sensitive (tighter thresholds)
   * < 1.0 = less sensitive (looser thresholds)
   * Defaults to 1.0.
   */
  sensitivity?: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// THRESHOLD REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Central registry of all metric thresholds.
 *
 * Key  = the metric name string used in AlertRule.metric
 * Value = ThresholdConfig describing boundaries for that metric
 *
 * How to add a new metric:
 *   1. Add an entry here with metric, warning, critical, direction, baselineStrategy
 *   2. Add a corresponding AlertRule in alerts.ts
 *   3. Done — the engine picks it up automatically
 *
 * NOTE:
 * baselineStrategy is optional but recommended.
 * If omitted, system defaults to 'mean' safely.
 * Future metrics should explicitly define it for accuracy.
 */
export const THRESHOLDS: Record<string, ThresholdConfig> = {

  // ── Conversion Metrics ───────────────────────────────────────────────────
  //
  // "Higher is better" → direction: 'decrease'
  // p25 strategy: anchors baseline to the typical good-performance day,
  // so the drift guard retains memory of healthy operation even when
  // recent history has been degraded.

  resume_end_to_end_conversion_rate: {
    metric:            'resume_end_to_end_conversion_rate',
    warning:           0.10,   // 10% drop from baseline → warning
    critical:          0.20,   // 20% drop from baseline → critical
    direction:         'decrease',
    baselineStrategy:  'p25',  // anchor to good-performance days
    absoluteWarning:   0.60,
    absoluteCritical:  0.40,
    minChangeFraction: 0.03,
    sensitivity:       1.0,
  },

  upload_success_rate: {
    metric:            'upload_success_rate',
    warning:           0.05,
    critical:          0.15,
    direction:         'decrease',
    baselineStrategy:  'p25',  // anchor high — this should stay near 100%
    absoluteWarning:   0.90,
    absoluteCritical:  0.75,
    minChangeFraction: 0.02,
    sensitivity:       1.2,
  },

  onboarding_completion_rate: {
    metric:            'onboarding_completion_rate',
    warning:           0.10,
    critical:          0.25,
    direction:         'decrease',
    baselineStrategy:  'mean', // mean is fine here — inherently noisy, no outlier risk
    absoluteWarning:   0.50,
    absoluteCritical:  0.30,
    minChangeFraction: 0.03,
    sensitivity:       0.9,
  },

  // ── Reliability Metrics ──────────────────────────────────────────────────
  //
  // "Lower is better" → direction: 'increase'
  // p25 strategy: anchors to the best (lowest) error days, so the baseline
  // doesn't drift upward during a prolonged bad period and silently stop alerting.

  resume_failure_rate: {
    metric:            'resume_failure_rate',
    warning:           0.30,
    critical:          1.00,
    direction:         'increase',
    baselineStrategy:  'p25',  // anchor to best (lowest) error periods
    absoluteWarning:   0.05,
    absoluteCritical:  0.15,
    minChangeFraction: 0.01,
    sensitivity:       1.5,
  },

  timeout_rate: {
    metric:            'timeout_rate',
    warning:           0.30,
    critical:          0.80,
    direction:         'increase',
    baselineStrategy:  'p25',
    absoluteWarning:   0.08,
    absoluteCritical:  0.20,
    minChangeFraction: 0.01,
    sensitivity:       1.3,
  },

  monitoring_error_rate: {
    metric:            'monitoring_error_rate',
    warning:           0.50,
    critical:          1.50,
    direction:         'increase',
    baselineStrategy:  'median', // median — occasional monitoring blips are expected
    absoluteWarning:   0.03,
    absoluteCritical:  0.10,
    minChangeFraction: 0.005,
    sensitivity:       1.0,
  },

  resume_errors_per_session: {
    metric:            'resume_errors_per_session',
    warning:           0.40,
    critical:          1.00,
    direction:         'increase',
    baselineStrategy:  'p25',
    absoluteWarning:   0.10,
    absoluteCritical:  0.25,
    minChangeFraction: 0.01,
    sensitivity:       1.2,
  },

  // ── Performance Metrics ──────────────────────────────────────────────────
  //
  // Latency: "lower is better" → direction: 'increase'
  // p75 strategy: anchors to the typical-bad day (not the best day).
  // This is intentional for latency — the baseline represents a realistic
  // upper bound of acceptable performance, not a best-case ideal.
  // If p95 regularly runs at 25s and we anchor to p25 of history (say 18s),
  // normal variation would trigger constant alerts.

  'avg / p50 / p95 / p99 processing time': {
    metric:            'avg / p50 / p95 / p99 processing time',
    warning:           0.20,
    critical:          0.50,
    direction:         'increase',
    baselineStrategy:  'p75',  // anchor to typical-bad, not best-case
    absoluteWarning:   30_000,
    absoluteCritical:  60_000,
    minChangeFraction: 0.05,
    sensitivity:       1.0,
  },

  time_to_value: {
    metric:            'time_to_value',
    warning:           0.20,
    critical:          0.50,
    direction:         'increase',
    baselineStrategy:  'p75',
    absoluteWarning:   20_000,
    absoluteCritical:  45_000,
    minChangeFraction: 0.05,
    sensitivity:       0.9,
  },

  avg_attempts_per_resume: {
    metric:            'avg_attempts_per_resume',
    warning:           0.25,
    critical:          0.75,
    direction:         'increase',
    baselineStrategy:  'median', // median — retry counts are step-functions with outliers
    absoluteWarning:   3,
    absoluteCritical:  5,
    minChangeFraction: 0.10,
    sensitivity:       0.8,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Look up the threshold config for a metric key.
 * Always returns a config — falls back to a safe default if key is unknown.
 * Guarantees the engine never receives undefined.
 */
export function getThresholdConfig(metricKey: string): ThresholdConfig {
  return THRESHOLDS[metricKey] ?? FALLBACK_THRESHOLD;
}

/**
 * Safe fallback used when a metric has no explicit config entry.
 * Conservative settings avoid false positives on unknown metrics.
 * Defaults to 'mean' baseline strategy.
 */
const FALLBACK_THRESHOLD: ThresholdConfig = {
  metric:           '__fallback__',
  warning:          0.15,
  critical:         0.30,
  direction:        'increase',
  baselineStrategy: 'mean',
  sensitivity:      1.0,
};