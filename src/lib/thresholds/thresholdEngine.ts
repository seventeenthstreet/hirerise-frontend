/**
 * @file lib/thresholds/thresholdEngine.ts
 * @description Core threshold evaluation engine.
 *
 * Wires together:
 *   Config (static thresholds) → Baseline Engine → Adaptive Thresholds
 *   → Noise Filter → Threshold Evaluation → Result + Reason
 *
 * Supports three modes via THRESHOLD_MODE environment variable:
 *   'static'   — use static config thresholds only (fastest, least adaptive)
 *   'adaptive' — static + rolling variance adjustment (default)
 *   'dynamic'  — static + adaptive + dynamic baselines from history
 *
 * Gap fixes in this version (additive only):
 *   1. Cold-start protection — history below MIN_SAMPLE_SIZE → static fallback
 *   2. Drift guard — applied to baseline during dynamic/adaptive computation
 *   3. Per-metric baselineStrategy — read from ThresholdConfig
 *   4. reason field — human-readable explanation added to ThresholdResult
 *
 * RULES:
 *  - Pure function entry point: evaluateThreshold()
 *  - NEVER returns undefined — always falls back to static thresholds
 *  - No side effects — all state (history, cooldowns) passed in by caller
 *  - No imports from React, hooks, or UI layers
 *  - Deterministic given the same inputs
 *
 * Architecture position: lib utility, called from alerts.ts only
 *   Config → ThresholdEngine → alerts.ts → useMetrics → UI
 */

import { getThresholdConfig } from '@/lib/config/thresholds';
import { computeBaseline, computeDelta, normalizeStrategy } from './baselineEngine';
import { computeAdaptiveThresholds, breachesAbsolute } from './adaptiveThreshold';
import { applyNoiseFilter } from './noiseFilter';
import type { CooldownEntry } from './noiseFilter';
import { formatPercent } from '@/lib/utils/format';
import { ReasonType } from '@/lib/constants/reasonTypes';
import { isDevelopment } from '@/lib/utils/env';

// ─────────────────────────────────────────────────────────────────────────────
// ENVIRONMENT MODE
// ─────────────────────────────────────────────────────────────────────────────

type ThresholdMode = 'static' | 'adaptive' | 'dynamic';

function resolveMode(): ThresholdMode {
  const raw = (
    (typeof process !== 'undefined' ? process.env.THRESHOLD_MODE : undefined) ?? 'adaptive'
  ).toLowerCase();
  if (raw === 'static' || raw === 'adaptive' || raw === 'dynamic') {
    return raw;
  }
  return 'adaptive';
}

// ─────────────────────────────────────────────────────────────────────────────
// COLD-START PROTECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimum number of historical data points required before dynamic or
 * adaptive baseline computation is trusted.
 *
 * Rationale: with fewer samples the rolling variance is meaningless and
 * adaptive threshold scaling would produce erratic results. Below this
 * sample count, the engine forces static mode regardless of THRESHOLD_MODE.
 *
 * Value chosen to balance responsiveness (don't wait forever) with
 * statistical reliability (enough data for variance to be meaningful).
 * Tune via environment if needed; code path is unchanged.
 */
export const MIN_SAMPLE_SIZE = 5;

/**
 * Determine the effective mode given history length.
 * This is the cold-start protection gate — explicit, not partial.
 *
 * If history.length < MIN_SAMPLE_SIZE:
 *   → force 'static' regardless of THRESHOLD_MODE env var
 *   → ThresholdResult.mode will be 'static' and coldStart will be true
 *
 * No partial dynamic behavior: the engine either runs full adaptive/dynamic
 * or it runs static. Never a half-computed baseline from 2 data points.
 */
function effectiveMode(configuredMode: ThresholdMode, historyLength: number): {
  mode:      ThresholdMode;
  coldStart: boolean;
} {
  if (configuredMode !== 'static' && historyLength < MIN_SAMPLE_SIZE) {
    return { mode: 'static', coldStart: true };
  }
  return { mode: configuredMode, coldStart: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULT TYPE
// ─────────────────────────────────────────────────────────────────────────────

export type ThresholdLevel = 'normal' | 'warning' | 'critical';

export interface ThresholdResult {
  /** Evaluation outcome. */
  level:         ThresholdLevel;
  /**
   * Fractional delta of the (smoothed) value relative to the baseline.
   * Positive = above baseline, negative = below baseline.
   * 0 when baseline is unavailable or history is empty.
   */
  delta:         number;
  /** The smoothed value used for evaluation (after noise filtering). */
  smoothedValue: number;
  /** The baseline against which delta was measured. */
  baseline:      number;
  /** Whether adaptive thresholds were applied. */
  adaptive:      boolean;
  /**
   * Whether the noise filter suppressed this evaluation.
   * When true, `level` is forced to 'normal' regardless of raw value.
   */
  filtered:      boolean;
  /** The mode that produced this result. */
  mode:          ThresholdMode;
  /**
   * Cold-start flag.
   * true = history was below MIN_SAMPLE_SIZE; static fallback was forced.
   * Callers can use this to annotate alerts with "insufficient data" context.
   */
  coldStart:     boolean;
  /**
   * Whether the drift guard was applied to the baseline.
   * true = rolling baseline had drifted too far from historical best;
   *        the engine anchored it back. Alerts are therefore relative to a
   *        healthier reference point than recent history alone would suggest.
   */
  driftGuarded:  boolean;
  /**
   * Human-readable explanation of why this level was reached (or not).
   *
   * Format: "<metric> <direction> <delta%> <context> (threshold <threshold%>)"
   * Examples:
   *   "conversion_rate fell 18.3% below baseline (warning threshold: 10%)"
   *   "resume_failure_rate is within normal range (delta: +2.1%)"
   *   "timeout_rate suppressed by noise filter (delta 0.8% below min-change floor of 1%)"
   *   "upload_success_rate: cold-start — static threshold applied (< 5 samples)"
   *
   * Internal field — NOT part of the Alert type.
   * alerts.ts may optionally surface it in Alert.message; UI never reads it directly.
   */
  reason:        string;
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUT TYPE
// ─────────────────────────────────────────────────────────────────────────────

export interface EvaluateThresholdInput {
  /** Schema metric key — must match a THRESHOLDS entry (falls back to default). */
  metricKey:      string;
  /** The latest observed value for this metric. */
  value:          number;
  /**
   * Historical values for this metric, oldest first.
   * Required for adaptive and dynamic modes.
   * If fewer than MIN_SAMPLE_SIZE entries, engine forces static mode.
   */
  history:        number[];
  /**
   * Precomputed baseline. When provided, skips internal baseline computation
   * AND the drift guard (caller takes responsibility for baseline integrity).
   */
  baseline?:      number;
  /**
   * Cooldown state for this metric (from the alert dedup layer).
   * When provided, the noise filter suppresses rapid re-fires.
   */
  cooldownEntry?: CooldownEntry;
  /**
   * Current timestamp in ms.
   * Passed in (not Date.now() inside) to keep this function pure/testable.
   */
  nowMs:          number;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EVALUATION FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluate a single metric against its configured thresholds.
 *
 * Pipeline:
 *  1.  Resolve config (static fallback for unknown metrics)
 *  2.  Cold-start gate (< MIN_SAMPLE_SIZE → force static)
 *  3.  Compute baseline using per-metric strategy + drift guard
 *  4.  Compute adaptive threshold boundaries
 *  5.  Compute raw delta
 *  6.  Apply noise filter (min-change gate → cooldown → smoothing)
 *  7.  Evaluate smoothed delta against relative thresholds
 *  8.  Evaluate smoothed value against absolute thresholds
 *  9.  Take the more severe result
 *  10. Build reason string
 *
 * NEVER throws. NEVER returns undefined.
 */
export function evaluateThreshold(input: EvaluateThresholdInput): ThresholdResult {
  const { metricKey, value, history, baseline: overrideBaseline, cooldownEntry, nowMs } = input;

  const configuredMode = resolveMode();
  const config         = getThresholdConfig(metricKey);

  // ── 1. Cold-start gate ───────────────────────────────────────────────────
  const { mode, coldStart } = effectiveMode(configuredMode, history.length);

  // ── 2. Resolve baseline ──────────────────────────────────────────────────
  let baseline:     number;
  let driftGuarded: boolean = false;

  if (overrideBaseline !== undefined) {
    // Caller-supplied baseline — accepted as-is, no guard applied.
    baseline = overrideBaseline;
  } else if (mode === 'static') {
    // Static mode (or cold-start forced static): delta will be 0;
    // only absolute thresholds can fire.
    baseline = value;
  } else {
    // Adaptive / dynamic — use per-metric strategy from config.
    // normalizeStrategy hardens the raw config value: handles unknown aliases,
    // undefined, and arbitrary strings — always returns a valid BaselineStrategy.
    // Single default source: 'mean' (→ moving_average) for all modes.
    // Per-metric overrides are set in thresholds.ts; no secondary fallback needed here.
    //
    // DEV GUARD: warn when baselineStrategy is absent so future developers
    // know an explicit value is recommended. No-op in production.
    if (!config.baselineStrategy && isDevelopment) {
      console.warn(
        `[ThresholdEngine] Missing baselineStrategy for metric "${metricKey}", defaulting to 'mean'`
      );
    }
    const strategy = normalizeStrategy(config.baselineStrategy ?? 'mean');
    const result      = computeBaseline({
      values:         history,
      strategy,
      guardDirection: config.direction, // enable drift guard
    });
    baseline     = result.value;
    driftGuarded = result.driftGuarded;
  }

  // ── 3. Compute adaptive threshold boundaries ─────────────────────────────
  const adaptive = mode !== 'static'
    ? computeAdaptiveThresholds({ metricKey, config, history, baseline })
    : {
        warning:  config.warning  * (config.sensitivity ?? 1.0),
        critical: config.critical * (config.sensitivity ?? 1.0),
        baseline,
        adaptive: false,
        historyN: 0,
      };

  // ── 4. Compute raw delta ─────────────────────────────────────────────────
  const rawDelta = computeDelta(value, baseline);

  // ── 5. Apply noise filter ────────────────────────────────────────────────
  const fullHistory  = history.length > 0 ? [...history, value] : [value];
  const noiseResult  = applyNoiseFilter({
    history:           fullHistory,
    delta:             rawDelta,
    minChangeFraction: config.minChangeFraction,
    cooldownEntry,
    nowMs,
  });

  if (!noiseResult.pass) {
    const pct = formatPercent(Math.abs(rawDelta));
    // Structured prefix: NOISE_FILTERED — signals this result was suppressed
    // before threshold evaluation, not because thresholds weren't breached.
    const reason = noiseResult.reason === 'in_cooldown'
      ? `${ReasonType.NOISE_FILTERED}: ${metricKey} suppressed by cooldown window (last alert too recent)`
      : `${ReasonType.NOISE_FILTERED}: ${metricKey} delta ${pct} below minimum-change floor — treated as noise`;

    return {
      level:         'normal',
      delta:         rawDelta,
      smoothedValue: value,
      baseline,
      adaptive:      adaptive.adaptive,
      filtered:      true,
      mode,
      coldStart,
      driftGuarded,
      reason,
    };
  }

  const smoothedValue = noiseResult.smoothedValue;

  // ── 6. Evaluate thresholds ───────────────────────────────────────────────
  const smoothedDelta  = computeDelta(smoothedValue, baseline);
  const isDecrease     = config.direction === 'decrease';
  const effectiveDelta = isDecrease ? -smoothedDelta : smoothedDelta;

  let relativeLevel: ThresholdLevel = 'normal';
  let breachedThreshold             = 0;
  if (effectiveDelta >= adaptive.critical) {
    relativeLevel     = 'critical';
    breachedThreshold = adaptive.critical;
  } else if (effectiveDelta >= adaptive.warning) {
    relativeLevel     = 'warning';
    breachedThreshold = adaptive.warning;
  }

  let absoluteLevel: ThresholdLevel = 'normal';
  let absoluteBreachValue           = 0;
  if (config.absoluteCritical !== undefined &&
      breachesAbsolute(smoothedValue, config.absoluteCritical, config.direction)) {
    absoluteLevel       = 'critical';
    absoluteBreachValue = config.absoluteCritical;
  } else if (config.absoluteWarning !== undefined &&
      breachesAbsolute(smoothedValue, config.absoluteWarning, config.direction)) {
    absoluteLevel       = 'warning';
    absoluteBreachValue = config.absoluteWarning;
  }

  const level = severityMax(relativeLevel, absoluteLevel);

  // ── 7. Build reason string ───────────────────────────────────────────────
  const reason = buildReason({
    metricKey,
    level,
    smoothedDelta,
    effectiveDelta,
    breachedThreshold,
    absoluteLevel,
    absoluteBreachValue,
    smoothedValue,
    baseline,
    direction: config.direction,
    adaptive:  adaptive.adaptive,
    coldStart,
    driftGuarded,
    mode,
  });

  return {
    level,
    delta:         smoothedDelta,
    smoothedValue,
    baseline,
    adaptive:      adaptive.adaptive,
    filtered:      false,
    mode,
    coldStart,
    driftGuarded,
    reason,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// REASON BUILDER
// ─────────────────────────────────────────────────────────────────────────────

interface ReasonInput {
  metricKey:          string;
  level:              ThresholdLevel;
  smoothedDelta:      number;
  effectiveDelta:     number;
  breachedThreshold:  number;
  absoluteLevel:      ThresholdLevel;
  absoluteBreachValue: number;
  smoothedValue:      number;
  baseline:           number;
  direction:          'increase' | 'decrease';
  adaptive:           boolean;
  coldStart:          boolean;
  driftGuarded:       boolean;
  mode:               string;
}

/**
 * Build a human-readable reason string explaining the evaluation result.
 *
 * Included in ThresholdResult.reason — NOT in Alert type.
 * alerts.ts may optionally surface it; UI never reads it directly.
 *
 * Format: "${TYPE}: ${human readable message} [${context flags}]"
 *
 * Structured prefixes (deterministic — one prefix per code path):
 *   COLD_START      — history below MIN_SAMPLE_SIZE; static fallback applied
 *   RELATIVE_BREACH — smoothed delta exceeded relative warning/critical threshold
 *   ABSOLUTE_BREACH — smoothed value crossed an absolute boundary
 *   NORMAL          — all checks passed; no threshold breached
 *
 * Note: NOISE_FILTERED is applied upstream (before buildReason is called)
 * in the noiseResult.pass early-return block.
 *
 * All existing message content is preserved — only the TYPE: prefix is added.
 * The Alert type is unaffected; ThresholdResult.reason is an internal field.
 */
function buildReason(r: ReasonInput): string {
  const deltaSign  = r.smoothedDelta >= 0 ? '+' : '';
  const deltaPct   = `${deltaSign}${formatPercent(r.smoothedDelta)}`;
  const effPct     = formatPercent(r.effectiveDelta);
  const dirWord    = r.direction === 'decrease' ? 'fell' : 'rose';
  const baselineFmt = r.baseline.toFixed(4);

  const suffixParts: string[] = [];
  if (r.adaptive)      suffixParts.push('adaptive');
  if (r.driftGuarded)  suffixParts.push('drift-guarded');
  if (r.coldStart)     suffixParts.push('cold-start');
  const suffix = suffixParts.length > 0 ? ` [${suffixParts.join(', ')}]` : '';

  // ── COLD_START path ─────────────────────────────────────────────────────
  if (r.coldStart && r.level === 'normal') {
    return `${ReasonType.COLD_START}: ${r.metricKey} static thresholds applied (fewer than ${MIN_SAMPLE_SIZE} samples)`;
  }

  // ── NORMAL path ──────────────────────────────────────────────────────────
  if (r.level === 'normal') {
    return (
      `${ReasonType.NORMAL}: ${r.metricKey} within normal range: ${dirWord} ${effPct} ` +
      `from baseline ${baselineFmt} ` +
      `(delta ${deltaPct}, warning threshold: ${formatPercent(r.breachedThreshold)})` +
      suffix
    );
  }

  // ── BREACH paths (warning | critical) ───────────────────────────────────
  // Determine primary breach path (relative vs absolute).
  // r.level is already narrowed to 'warning' | 'critical' by the guard above.
  const relFired = r.breachedThreshold > 0;
  const absFired = r.absoluteLevel !== 'normal';

  if (absFired && (!relFired || SEVERITY_ORDER[r.absoluteLevel] >= SEVERITY_ORDER[r.level])) {
    return (
      `${ReasonType.ABSOLUTE_BREACH}: ${r.metricKey} absolute value ${r.smoothedValue.toFixed(4)} ` +
      `breached ${r.absoluteLevel} boundary ${r.absoluteBreachValue} ` +
      `(delta ${deltaPct} from baseline ${baselineFmt})` +
      suffix
    );
  }

  return (
    `${ReasonType.RELATIVE_BREACH}: ${r.metricKey} ${dirWord} ${effPct} from baseline ${baselineFmt} — ` +
    `${r.level} (threshold: ${formatPercent(r.breachedThreshold)}, delta: ${deltaPct})` +
    suffix
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<ThresholdLevel, number> = {
  normal:   0,
  warning:  1,
  critical: 2,
};

function severityMax(a: ThresholdLevel, b: ThresholdLevel): ThresholdLevel {
  return SEVERITY_ORDER[a] >= SEVERITY_ORDER[b] ? a : b;
}