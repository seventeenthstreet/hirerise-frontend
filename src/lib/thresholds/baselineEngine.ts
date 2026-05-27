/**
 * @file lib/thresholds/baselineEngine.ts
 * @description Dynamic baseline computation from historical metric values.
 *
 * Provides pure functions to derive a reference baseline from a window of
 * historical observations. The baseline is then used by the threshold engine
 * to evaluate deltas (relative change from expected) rather than raw values.
 *
 * RULES:
 *  - Pure functions — no external storage, no side effects
 *  - Deterministic — same input always produces same output
 *  - No imports from React, hooks, UI, or API layers
 *  - Always returns a finite number — never undefined, never NaN
 *
 * Architecture position: utility consumed by thresholdEngine only
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Default number of historical periods used in moving-average baseline. */
export const DEFAULT_BASELINE_WINDOW = 7;

/**
 * Drift guard floor factor.
 *
 * Prevents a sliding baseline from following gradual degradation into silence.
 * The guarded baseline is clamped to no worse than (best historical × DRIFT_FLOOR_FACTOR).
 *
 * Example with DRIFT_FLOOR_FACTOR = 0.70:
 *   best conversion rate in history = 0.80
 *   guarded floor                   = 0.80 × 0.70 = 0.56
 *   If the rolling avg drifts to 0.50, it is lifted to 0.56.
 *   This ensures the alert system retains memory of how good things once were.
 *
 * Set conservatively — aggressive values cause alert storms on legitimate regressions.
 */
const DRIFT_FLOOR_FACTOR = 0.70;

/**
 * Epsilon guard for numerical stability.
 *
 * Prevents division by zero and unstable ratio calculations when a metric's
 * historical best is at or near zero (e.g., error rate during a perfect period).
 * Applied via: safeBest = Math.max(Math.abs(best), EPSILON)
 *
 * Has no observable effect on any value that is not pathologically near zero.
 * Value chosen to be well below any real-world metric unit (rates, counts, ms).
 */
const EPSILON = 1e-6;

/**
 * Maximum fractional adjustment the drift guard may apply in a single pass.
 *
 * Limits over-correction in volatile data where the historical best is an outlier
 * and would otherwise snap the baseline to an unreachable anchor.
 *
 * Soft clamp applied AFTER drift guard logic:
 *   baseline = clamp(baseline, best * 0.70, baseline_pre_guard * (1 + MAX_ADJUST_RATIO))
 *
 * At 0.5 this means the guard can raise/lower the baseline by at most 50% of
 * its pre-guard value in a single evaluation — large enough for real drift events,
 * small enough to prevent violent single-step jumps.
 *
 * Does NOT override whether the guard fires — only limits how far it can move.
 */
const MAX_ADJUST_RATIO = 0.5;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All strategies supported by computeBaseline.
 * Expanded to include 'mean' (alias for moving_average) and 'p75'
 * to support per-metric baselineStrategy config.
 */
export type BaselineStrategy =
  | 'moving_average'  // simple rolling average over last N periods (default)
  | 'mean'            // alias for moving_average — used in config for readability
  | 'median'          // robust to outliers; good for high-variance metrics
  | 'percentile_25'   // p25 — anchors to good performance (use for "higher is better")
  | 'p25'             // alias for percentile_25 — used in config
  | 'percentile_75'   // p75 — anchors to worse-case (use for latency, error rates)
  | 'p75';            // alias for percentile_75 — used in config

export interface BaselineResult {
  /** Computed baseline value. */
  value:    number;
  /** Strategy that produced this result. */
  strategy: BaselineStrategy;
  /** Number of data points used. */
  n:        number;
  /**
   * Whether the drift guard was applied.
   * true = rolling baseline was too low/high relative to historical best;
   *        guard clamped it back toward the anchor.
   */
  driftGuarded: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE STRATEGY IMPLEMENTATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Moving average baseline over the last N periods.
 *
 * Best for: stable metrics with slow drift (e.g., conversion rates, p95 latency)
 *
 * @param values  Historical values, oldest first
 * @param n       Window size (default: DEFAULT_BASELINE_WINDOW)
 */
export function movingAverageBaseline(
  values: number[],
  n = DEFAULT_BASELINE_WINDOW,
): number {
  if (values.length === 0) return 0;
  const window = values.slice(-Math.max(1, n));
  const sum = window.reduce((acc, v) => acc + v, 0);
  return sum / window.length;
}

/**
 * Median baseline — robust to outliers and spikes.
 *
 * Best for: metrics with high variance or occasional anomalies that shouldn't
 * shift the baseline (e.g., per-session error counts).
 *
 * @param values  Historical values (order doesn't matter for median)
 */
export function medianBaseline(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Nth-percentile baseline — generalized percentile computation.
 *
 * @param values      Historical values
 * @param percentile  0–100 (e.g., 25 for p25, 75 for p75)
 */
export function percentileBaseline(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  // Nearest-rank method — deterministic, no interpolation.
  const idx = Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1);
  return sorted[idx];
}

/**
 * 25th-percentile baseline — conservative lower-bound reference.
 *
 * Best for: metrics where "higher is better" and you want to anchor the
 * baseline to typical-good performance (e.g., upload success rate).
 * Gradual degradation has to fall a long way below even the bad-day p25
 * before alerts disappear.
 */
export function percentile25Baseline(values: number[]): number {
  return percentileBaseline(values, 25);
}

/**
 * 75th-percentile baseline — upper-bound reference.
 *
 * Best for: metrics where "lower is better" (latency, error rates).
 * Anchors to a typical-bad (but not worst-case) day so the system stays
 * alert-ready even when things are generally fine.
 */
export function percentile75Baseline(values: number[]): number {
  return percentileBaseline(values, 75);
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIFT GUARD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Protect a rolling baseline from silently following gradual degradation.
 *
 * Problem this solves:
 *   If conversion rate declines from 0.80 → 0.65 over 30 days, a pure
 *   moving-average baseline tracks it down to ~0.65. At that point, a
 *   further drop to 0.60 produces only a 7.7% delta — below the warning
 *   threshold — so no alert fires. The system has gone blind.
 *
 * Solution:
 *   Anchor the baseline to a floor derived from the historical "best" reading.
 *   The floor is (best × DRIFT_FLOOR_FACTOR), so the baseline can drift down
 *   naturally but never fall below the floor without forcing a larger delta.
 *
 * Design constraints:
 *   - Conservative: floor is 70% of best, not 100% (avoids constant noise)
 *   - Direction-aware: "best" means max for decrease-sensitive metrics,
 *     min for increase-sensitive ones
 *   - Transparent: BaselineResult.driftGuarded tells the engine what happened
 *   - Does NOT aggressively override — only raises a floor / lowers a ceiling
 *
 * @param currentBaseline  Rolling baseline value to potentially guard
 * @param history          Full historical values for this metric
 * @param direction        'decrease' = lower is bad; 'increase' = higher is bad
 * @returns { guardedBaseline, driftGuarded }
 */
export function applyBaselineGuard(
  currentBaseline: number,
  history:         number[],
  direction:       'increase' | 'decrease',
): { guardedBaseline: number; driftGuarded: boolean } {
  // No history → nothing to anchor to → pass through unchanged
  if (history.length === 0) {
    return { guardedBaseline: currentBaseline, driftGuarded: false };
  }

  if (direction === 'decrease') {
    // "Higher is better" metrics (e.g., conversion rate, upload success rate).
    // Best = historical maximum. Floor = best × DRIFT_FLOOR_FACTOR.
    const best     = Math.max(...history);
    // Epsilon guard: stabilises floor calculation when best is pathologically
    // near zero (e.g., all-zero history edge case). Has no effect on any
    // real-world metric value — only protects the numerical computation.
    const safeBest = Math.max(Math.abs(best), EPSILON);
    const floor    = safeBest * DRIFT_FLOOR_FACTOR;

    if (currentBaseline < floor) {
      // Soft clamp: the guard may not raise the baseline by more than
      // MAX_ADJUST_RATIO (50%) above its current value in a single pass.
      // Prevents a single historical outlier from causing a violent snap.
      // The existing drift guard logic still determines whether to fire;
      // this only limits the magnitude of the correction.
      const softCeiling     = currentBaseline * (1 + MAX_ADJUST_RATIO);
      const guardedBaseline = Math.min(floor, softCeiling);
      return { guardedBaseline, driftGuarded: true };
    }
    return { guardedBaseline: currentBaseline, driftGuarded: false };
  } else {
    // "Lower is better" metrics (e.g., error rate, latency).
    // Best = historical minimum. Ceiling = best / DRIFT_FLOOR_FACTOR
    // (i.e., same proportional protection, but in the opposite direction).
    const best = Math.min(...history);
    // Exact zero: error rate was 0 during a perfect period.
    // No ceiling is derivable — pass through unchanged (preserves original behaviour).
    if (best === 0) {
      return { guardedBaseline: currentBaseline, driftGuarded: false };
    }
    // Epsilon guard: stabilises ceiling calculation for near-zero (but non-zero)
    // best values. safeBest ≈ best for all normal metric ranges.
    const safeBest = Math.max(Math.abs(best), EPSILON);
    const ceiling  = safeBest / DRIFT_FLOOR_FACTOR;

    if (currentBaseline > ceiling) {
      // Soft clamp: the guard may not lower the baseline by more than
      // MAX_ADJUST_RATIO (50%) below its current value in a single pass.
      // Mirrors the decrease-direction soft clamp above.
      const softFloor       = currentBaseline * (1 - MAX_ADJUST_RATIO);
      const guardedBaseline = Math.max(ceiling, softFloor);
      return { guardedBaseline, driftGuarded: true };
    }
    return { guardedBaseline: currentBaseline, driftGuarded: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STRATEGY NORMALISATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Known strategy alias map — maps all config-facing short names and variants
 * to their canonical BaselineStrategy value.
 *
 * Centralised here so that adding a new alias is a single-line change.
 */
const STRATEGY_ALIAS_MAP: Record<string, BaselineStrategy> = {
  mean:           'moving_average',
  avg:            'moving_average',  // common config alias
  average:        'moving_average',  // full-word alias
  moving_average: 'moving_average',
  median:         'median',
  p25:            'percentile_25',
  percentile_25:  'percentile_25',
  p75:            'percentile_75',
  percentile_75:  'percentile_75',
};

/**
 * DEV-only warning flag.
 * `process.env.NODE_ENV` is replaced at build time by Next.js / webpack.
 * In production this branch is dead-code-eliminated entirely.
 */
const DEV = process.env.NODE_ENV === 'development';

/**
 * Normalise and harden a raw strategy string from config.
 *
 * Accepts the full BaselineStrategy union (strict callers) as well as any
 * arbitrary string that may come from config files, environment flags, or
 * feature-flag systems. Returns a canonical BaselineStrategy, defaulting to
 * 'mean' (→ moving_average) for any unrecognised input.
 *
 * Rules:
 *  - No runtime errors — always returns a valid strategy
 *  - Deterministic — same input always produces same output
 *  - Unknown strategies fall through to 'mean'; a dev-only console.warn fires
 *    so misconfiguration is caught during development without affecting production
 *
 * Exported so thresholdEngine can call it directly without duplicating logic.
 *
 * @param raw  Raw strategy string from config (may be undefined)
 * @returns    Canonical BaselineStrategy, never undefined
 */
export function normalizeStrategy(raw: string | undefined): BaselineStrategy {
  if (raw === undefined || raw === null || raw === '') {
    return 'moving_average'; // default
  }

  const normalised = STRATEGY_ALIAS_MAP[raw.toLowerCase().trim()];

  if (normalised !== undefined) {
    return normalised;
  }

  // Unknown strategy — warn in dev, fall back gracefully in all environments.
  if (DEV) {
    console.warn(
      `[thresholdEngine] Unknown baselineStrategy "${raw}". ` +
      `Falling back to "mean" (moving_average). ` +
      `Valid values: ${Object.keys(STRATEGY_ALIAS_MAP).join(', ')}.`,
    );
  }

  return 'moving_average';
}

/**
 * Internal alias kept for backward-compatibility with private call sites.
 * Routes through the hardened public normalizeStrategy.
 */
function normaliseStrategy(s: BaselineStrategy): BaselineStrategy {
  return normalizeStrategy(s);
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSITE BASELINE COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────

export interface ComputeBaselineInput {
  /** Historical values for this metric, oldest first. */
  values:    number[];
  /** Which strategy to use. Defaults to 'moving_average'. */
  strategy?: BaselineStrategy;
  /** Window size for moving_average/mean (ignored for median/percentile). */
  window?:   number;
  /**
   * When provided, the drift guard is applied after computing the raw baseline.
   * Set to the metric's `direction` from ThresholdConfig.
   * Omit to skip drift guard (e.g., in static mode).
   */
  guardDirection?: 'increase' | 'decrease';
}

/**
 * Compute a baseline from historical values using the chosen strategy.
 *
 * Always returns a valid BaselineResult — never throws, never returns undefined.
 * Falls back to 0 with n=0 if values is empty (caller must handle gracefully).
 *
 * When `guardDirection` is supplied, the drift guard is applied after the raw
 * strategy computation, clamping the baseline to a floor/ceiling derived from
 * the historical best. BaselineResult.driftGuarded reports whether clamping occurred.
 *
 * @example
 * const { value: baseline, driftGuarded } = computeBaseline({
 *   values:         [0.82, 0.85, 0.81, 0.84, 0.83, 0.80, 0.86],
 *   strategy:       'mean',
 *   guardDirection: 'decrease',
 * });
 * // baseline ≈ 0.83, driftGuarded: false (rolling avg still above 0.70 × 0.86)
 */
export function computeBaseline(input: ComputeBaselineInput): BaselineResult {
  const {
    values,
    strategy: rawStrategy = 'moving_average',
    window    = DEFAULT_BASELINE_WINDOW,
    guardDirection,
  } = input;

  const strategy = normaliseStrategy(rawStrategy);

  if (values.length === 0) {
    // No history — return sentinel; engine falls back to static thresholds.
    return { value: 0, strategy, n: 0, driftGuarded: false };
  }

  // ── Raw baseline computation ─────────────────────────────────────────────
  let value: number;

  switch (strategy) {
    case 'moving_average':
    case 'mean':           // alias — normaliseStrategy maps this before switch, but TS needs the case
      value = movingAverageBaseline(values, window);
      break;
    case 'median':
      value = medianBaseline(values);
      break;
    case 'percentile_25':
    case 'p25':            // alias
      value = percentile25Baseline(values);
      break;
    case 'percentile_75':
    case 'p75':            // alias
      value = percentile75Baseline(values);
      break;
    default: {
      // Exhaustive guard — all 7 union members are now handled above.
      const _exhaustive: never = strategy;
      value = movingAverageBaseline(values, window);
      void _exhaustive;
    }
  }

  // Guard against NaN / Infinity slipping through (e.g., all-zero history)
  if (!Number.isFinite(value)) {
    value = values[values.length - 1] ?? 0;
  }

  // ── Drift guard (optional) ───────────────────────────────────────────────
  let driftGuarded = false;
  if (guardDirection !== undefined) {
    const guard = applyBaselineGuard(value, values, guardDirection);
    value        = guard.guardedBaseline;
    driftGuarded = guard.driftGuarded;
  }

  return {
    value,
    strategy,
    n: Math.min(values.length, window),
    driftGuarded,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DELTA COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the fractional delta of a current value relative to a baseline.
 *
 * Returns a signed fraction:
 *  - Positive → current is above baseline
 *  - Negative → current is below baseline
 *
 * Special cases:
 *  - baseline = 0 and current = 0 → delta = 0 (no change)
 *  - baseline = 0 and current ≠ 0 → delta = ±1.0 (100% cap — avoids ÷0 explosion)
 *
 * @param current   The latest observed value
 * @param baseline  The reference baseline value
 */
export function computeDelta(current: number, baseline: number): number {
  if (baseline === 0) {
    if (current === 0) return 0;
    return current > 0 ? 1.0 : -1.0;
  }
  return (current - baseline) / Math.abs(baseline);
}