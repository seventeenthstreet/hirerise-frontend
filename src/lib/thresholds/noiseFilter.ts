/**
 * @file lib/thresholds/noiseFilter.ts
 * @description Noise reduction for threshold evaluation.
 *
 * Three techniques, applied in order:
 *  1. Minimum change gate  — ignore tiny fluctuations below a noise floor
 *  2. Smoothing            — moving average to reduce point-in-time spikes
 *  3. Cooldown check       — suppress rapidly flipping alerts
 *
 * RULES:
 *  - Pure functions — no side effects, no state, deterministic
 *  - No imports from React, hooks, UI, or API layers
 *  - All state (cooldown tracking, history) is passed in, never stored here
 *
 * Architecture position: utility consumed by thresholdEngine only
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default minimum fractional change required before a delta is considered
 * meaningful. Below this floor, changes are treated as noise.
 *
 * Example: MIN_CHANGE_FRACTION = 0.02 means a 1.5% delta is ignored even if it
 * crosses a threshold boundary, but a 3% delta is evaluated normally.
 */
export const MIN_CHANGE_FRACTION = 0.02;

/**
 * Default window size (number of data points) for the smoothing moving average.
 * Larger = smoother signal, slower to react to real changes.
 */
export const SMOOTHING_WINDOW = 5;

/**
 * Default cooldown period in milliseconds.
 * If a metric fired an alert within this window, suppress re-evaluation
 * to prevent rapid alert flipping on a metric oscillating around a threshold.
 */
export const DEFAULT_COOLDOWN_MS = 5 * 60 * 1_000; // 5 minutes

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Result from the noise filter decision. */
export type NoiseFilterResult =
  | { pass: true;  smoothedValue: number }
  | { pass: false; reason: NoiseFilterReason };

export type NoiseFilterReason =
  | 'below_min_change'   // delta too small to be meaningful
  | 'in_cooldown';       // alert fired recently — suppress until window expires

/** Cooldown state for a single metric. Passed in — never stored here. */
export interface CooldownEntry {
  /** Unix timestamp (ms) when the most recent alert fired for this metric. */
  lastFiredAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SMOOTHING — moving average
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Smooth an array of historical values with a simple moving average.
 *
 * Returns the average of the last `windowSize` values (or all values if fewer
 * than windowSize are available). The returned value is the "smoothed current"
 * reading — use it in place of the raw latest value.
 *
 * @param values    Time-ordered array of observed values (oldest first)
 * @param windowSize  Number of trailing periods to average (default: SMOOTHING_WINDOW)
 * @returns Smoothed value, or the single value if the array has one entry
 */
export function smoothMovingAverage(
  values: number[],
  windowSize = SMOOTHING_WINDOW,
): number {
  if (values.length === 0) {
    return 0;
  }
  const window = values.slice(-Math.max(1, windowSize));
  return window.reduce((sum, v) => sum + v, 0) / window.length;
}

/**
 * Smooth with exponential weighting (more recent values carry more weight).
 * Alpha controls recency bias: 0 = flat average, 1 = only latest value.
 *
 * Useful for metrics that react quickly to real changes (e.g., error rates)
 * while still dampening one-off spikes.
 *
 * @param values  Time-ordered array (oldest first)
 * @param alpha   Smoothing factor 0–1 (default: 0.3)
 */
export function smoothExponential(
  values: number[],
  alpha = 0.3,
): number {
  if (values.length === 0) return 0;
  let ema = values[0];
  for (let i = 1; i < values.length; i++) {
    ema = alpha * values[i] + (1 - alpha) * ema;
  }
  return ema;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. MINIMUM CHANGE GATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return true if the fractional delta is above the minimum change floor.
 *
 * A delta below the floor is considered noise — even if it technically crosses
 * a threshold boundary, it should not trigger an alert.
 *
 * @param delta              Fractional change (positive or negative)
 * @param minChangeFraction  Minimum meaningful change (default: MIN_CHANGE_FRACTION)
 */
export function isAboveMinChange(
  delta: number,
  minChangeFraction = MIN_CHANGE_FRACTION,
): boolean {
  return Math.abs(delta) >= minChangeFraction;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. COOLDOWN CHECK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return true if a metric is NOT in cooldown — i.e., it's safe to evaluate.
 *
 * A metric is in cooldown if it fired an alert within the cooldown window.
 * This prevents a metric oscillating around a threshold from generating a
 * storm of alerts.
 *
 * @param entry        Cooldown entry for this metric (undefined = never fired)
 * @param nowMs        Current timestamp in ms (pass Date.now() from caller)
 * @param cooldownMs   Cooldown window duration in ms (default: DEFAULT_COOLDOWN_MS)
 */
export function isNotInCooldown(
  entry: CooldownEntry | undefined,
  nowMs: number,
  cooldownMs = DEFAULT_COOLDOWN_MS,
): boolean {
  if (!entry) return true; // never fired — always pass
  return nowMs - entry.lastFiredAt >= cooldownMs;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSITE FILTER
// ─────────────────────────────────────────────────────────────────────────────

export interface NoiseFilterInput {
  /** Raw observed values for this metric, oldest first. At least 1 required. */
  history:            number[];
  /** Fractional delta between current (smoothed) value and baseline. */
  delta:              number;
  /** Per-metric minimum change override (optional; falls back to global). */
  minChangeFraction?: number;
  /** Cooldown state for this metric (undefined = never fired). */
  cooldownEntry?:     CooldownEntry;
  /** Current time — pass Date.now() from the engine; keeps this fn pure. */
  nowMs:              number;
  /** Cooldown window override in ms (optional). */
  cooldownMs?:        number;
  /** Smoothing window size override (optional). */
  smoothingWindow?:   number;
}

/**
 * Composite noise filter: runs smoothing → min-change gate → cooldown check.
 *
 * Call this before evaluating any threshold. If `pass` is false, suppress the
 * alert regardless of the threshold result.
 *
 * Returns `smoothedValue` on pass so the engine uses the smoothed signal,
 * not the raw latest value, for threshold comparison.
 */
export function applyNoiseFilter(input: NoiseFilterInput): NoiseFilterResult {
  const {
    history,
    delta,
    minChangeFraction,
    cooldownEntry,
    nowMs,
    cooldownMs,
    smoothingWindow,
  } = input;

  // Step 1: smooth the history to get the signal value
  const smoothedValue = smoothMovingAverage(history, smoothingWindow);

  // Step 2: minimum change gate — ignore sub-noise deltas
  if (!isAboveMinChange(delta, minChangeFraction)) {
    return { pass: false, reason: 'below_min_change' };
  }

  // Step 3: cooldown check — suppress rapid re-fires
  if (!isNotInCooldown(cooldownEntry, nowMs, cooldownMs)) {
    return { pass: false, reason: 'in_cooldown' };
  }

  return { pass: true, smoothedValue };
}