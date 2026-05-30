/**
 * @file lib/thresholds/adaptiveThreshold.ts
 * @description Adaptive threshold computation (Level 2).
 *
 * Adjusts warning/critical boundaries relative to the dynamic baseline,
 * so thresholds tighten or loosen as normal operating ranges shift over time.
 *
 * Key design decisions:
 *  - Thresholds are RELATIVE to baseline, not absolute numbers
 *  - Must always fallback to static config thresholds when history is absent
 *  - Must be deterministic — same history + config always yields same result
 *  - Sensitivity multiplier from ThresholdConfig is applied here
 *
 * RULES:
 *  - Pure functions — no state, no side effects
 *  - No imports from React, hooks, UI, or API layers
 *
 * Architecture position: utility consumed by thresholdEngine only
 */

import type { ThresholdConfig } from '@/lib/config/thresholds';
import { computeBaseline } from './baselineEngine';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface AdaptiveThresholds {
  /** Computed (or fallback) warning boundary as a fractional delta. */
  warning:   number;
  /** Computed (or fallback) critical boundary as a fractional delta. */
  critical:  number;
  /** Baseline value used for delta calculation. */
  baseline:  number;
  /** Whether adaptive computation was used (false = static fallback). */
  adaptive:  boolean;
  /** Number of history points used to compute these thresholds. */
  historyN:  number;
}

export interface AdaptiveThresholdInput {
  /** Metric key — used for logging/debugging only. */
  metricKey:    string;
  /** Static threshold config for this metric. */
  config:       ThresholdConfig;
  /** Historical values for this metric, oldest first. */
  history:      number[];
  /**
   * Override baseline directly (e.g., if caller already computed it).
   * When provided, skips internal baseline computation.
   */
  baseline?:    number;
  /**
   * Minimum number of history points required before adaptive mode activates.
   * Below this count, static thresholds are used unchanged.
   */
  minHistory?:  number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimum data points required to trust adaptive thresholds.
 * With fewer points, variance is too high to safely deviate from static config.
 */
const MIN_HISTORY_FOR_ADAPTIVE = 3;

/**
 * Maximum factor by which adaptive thresholds can deviate from static values.
 * Prevents runaway loosening during prolonged degraded periods.
 */
const MAX_ADAPTATION_FACTOR = 2.0;

/**
 * Minimum factor — prevents thresholds from tightening to the point of
 * generating constant noise alerts on healthy metrics.
 */
const MIN_ADAPTATION_FACTOR = 0.5;

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute adaptive warning/critical thresholds from history.
 *
 * Algorithm:
 *  1. Compute rolling baseline (moving average of recent N periods)
 *  2. Compute rolling variance of history to measure stability
 *  3. Scale static thresholds by a stability factor:
 *     - High variance → loosen thresholds (avoid noise alerts)
 *     - Low variance  → tighten thresholds (high confidence in signal)
 *  4. Apply sensitivity multiplier from static config
 *  5. Clamp result to [MIN, MAX] of static thresholds to prevent drift
 *
 * Falls back to static config if history is insufficient.
 *
 * @example
 * const { warning, critical, baseline } = computeAdaptiveThresholds({
 *   metricKey: 'resume_failure_rate',
 *   config: THRESHOLDS['resume_failure_rate'],
 *   history: [0.03, 0.04, 0.035, 0.032, 0.041, 0.038, 0.036],
 * });
 */
export function computeAdaptiveThresholds(
  input: AdaptiveThresholdInput,
): AdaptiveThresholds {
  const {
    config,
    history,
    baseline: overrideBaseline,
    minHistory = MIN_HISTORY_FOR_ADAPTIVE,
  } = input;

  const sensitivity = config.sensitivity ?? 1.0;

  // ── Insufficient history → static fallback ──────────────────────────────
  if (history.length < minHistory) {
    const baseline = overrideBaseline ?? (history.length > 0 ? history[history.length - 1] : 0);
    return {
      warning:   config.warning * sensitivity,
      critical:  config.critical * sensitivity,
      baseline,
      adaptive:  false,
      historyN:  history.length,
    };
  }

  // ── Compute baseline ─────────────────────────────────────────────────────
  const { value: computedBaseline } = computeBaseline({
    values:   history,
    strategy: 'moving_average',
  });
  const baseline = overrideBaseline ?? computedBaseline;

  // ── Compute rolling variance ─────────────────────────────────────────────
  const variance = computeVariance(history);
  const stdDev   = Math.sqrt(variance);
  const cv       = baseline !== 0 ? stdDev / Math.abs(baseline) : 0; // coefficient of variation

  // ── Stability factor: high CV → loosen thresholds ───────────────────────
  // CV = 0     → factor = 1.0 (perfectly stable, keep static thresholds)
  // CV = 0.10  → factor ≈ 1.5 (10% std-dev relative, loosen by 50%)
  // CV = 0.20+ → factor → MAX_ADAPTATION_FACTOR
  const rawFactor    = 1.0 + cv * 5.0; // linear scale from CV
  const stableClamp  = Math.min(MAX_ADAPTATION_FACTOR, Math.max(MIN_ADAPTATION_FACTOR, rawFactor));

  // ── Apply sensitivity and compute adaptive boundaries ────────────────────
  const adaptiveWarning  = clampToStaticRange(
    config.warning  * stableClamp * sensitivity,
    config.warning  * MIN_ADAPTATION_FACTOR,
    config.warning  * MAX_ADAPTATION_FACTOR,
  );
  const adaptiveCritical = clampToStaticRange(
    config.critical * stableClamp * sensitivity,
    config.critical * MIN_ADAPTATION_FACTOR,
    config.critical * MAX_ADAPTATION_FACTOR,
  );

  return {
    warning:   adaptiveWarning,
    critical:  adaptiveCritical,
    baseline,
    adaptive:  true,
    historyN:  history.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLLING VOLATILITY ASSESSMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assess whether a metric's recent history is stable or volatile.
 *
 * Returns a descriptor that the engine can log or use for tuning decisions.
 */
export type VolatilityLevel = 'stable' | 'moderate' | 'volatile';

export function assessVolatility(history: number[]): VolatilityLevel {
  if (history.length < 2) return 'stable';
  const mean = history.reduce((s, v) => s + v, 0) / history.length;
  if (mean === 0) return 'stable';
  const cv = Math.sqrt(computeVariance(history)) / Math.abs(mean);
  if (cv < 0.05) return 'stable';
  if (cv < 0.15) return 'moderate';
  return 'volatile';
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function computeVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const squaredDiffs = values.map(v => (v - mean) ** 2);
  return squaredDiffs.reduce((s, v) => s + v, 0) / values.length;
}

function clampToStaticRange(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ─────────────────────────────────────────────────────────────────────────────
// ABSOLUTE THRESHOLD HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determine if a raw value breaches an absolute threshold.
 * Used alongside delta-based thresholds — whichever fires first wins.
 *
 * @param value           Current raw metric value
 * @param absoluteLimit   Absolute warning or critical boundary from config
 * @param direction       Whether higher ('increase') or lower ('decrease') is a breach
 */
export function breachesAbsolute(
  value:         number,
  absoluteLimit: number,
  direction:     'increase' | 'decrease',
): boolean {
  if (direction === 'increase') return value >= absoluteLimit;
  return value <= absoluteLimit;
}