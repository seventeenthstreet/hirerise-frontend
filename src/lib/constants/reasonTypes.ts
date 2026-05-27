/**
 * @file lib/constants/reasonTypes.ts
 * @description Canonical string constants for ThresholdResult.reason prefixes.
 *
 * These are the structured type-prefixes that appear at the start of every
 * reason string produced by thresholdEngine.ts. Centralising them here:
 *   - prevents silent divergence if a prefix is edited in one place but not another
 *   - makes grep/search for a reason type reliable across the codebase
 *   - documents the complete set of possible reason types in a single location
 *
 * RULES:
 *   - Values MUST NOT be changed — they are surfaced in logs, observability
 *     tooling, and optionally in Alert.message. Changing a value is a
 *     breaking change to any downstream consumer parsing reason strings.
 *   - Do NOT add new entries here without a corresponding code path in
 *     thresholdEngine.ts that actually emits the prefix.
 *   - This file has no runtime dependencies. Import cost is zero.
 *
 * Usage:
 *   import { ReasonType } from '@/lib/constants/reasonTypes';
 *   const reason = `${ReasonType.RELATIVE_BREACH}: ${metricKey} ...`;
 */
export const ReasonType = {
  /**
   * Smoothed delta exceeded the relative warning or critical threshold.
   * The breach is expressed as a % change from baseline.
   */
  RELATIVE_BREACH: 'RELATIVE_BREACH',

  /**
   * Smoothed value crossed a configured absolute boundary (absoluteWarning
   * or absoluteCritical), independent of baseline delta.
   */
  ABSOLUTE_BREACH: 'ABSOLUTE_BREACH',

  /**
   * The evaluation was suppressed by the noise filter — either because the
   * delta was below the minimum-change floor, or the metric is within its
   * cooldown window. level is forced to 'normal'.
   */
  NOISE_FILTERED: 'NOISE_FILTERED',

  /**
   * History was below MIN_SAMPLE_SIZE; the engine fell back to static
   * thresholds. Adaptive/dynamic computation was skipped.
   */
  COLD_START: 'COLD_START',

  /**
   * No threshold was breached. Metric is within its normal operating range.
   */
  NORMAL: 'NORMAL',
} as const;

/** Union of all valid ReasonType string values. */
export type ReasonTypeValue = typeof ReasonType[keyof typeof ReasonType];