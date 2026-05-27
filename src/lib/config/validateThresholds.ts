/**
 * @file lib/config/validateThresholds.ts
 * @description Development/test-only config validation for THRESHOLDS entries.
 *
 * PURPOSE:
 *   Surface misconfigured or incomplete threshold entries early — during
 *   development or CI — before they silently affect production alert behavior.
 *
 * RULES:
 *  - NEVER throws — warn only. Callers are never disrupted.
 *  - NEVER imported by runtime paths (thresholdEngine, alerts, hooks).
 *  - Runs only when NODE_ENV is 'development' or 'test'.
 *  - Zero production overhead: the guard at the top of the function makes it
 *    a no-op in any other environment, even if accidentally imported.
 *  - No side effects beyond console.warn.
 *  - Does NOT modify the config it receives.
 *
 * USAGE:
 *   // In a test file or dev bootstrap:
 *   import { validateThresholdConfig } from '@/lib/config/validateThresholds';
 *   import { THRESHOLDS } from '@/lib/config/thresholds';
 *   validateThresholdConfig(THRESHOLDS);
 *
 * Architecture position: dev/test utility only — never in the runtime call chain
 *   Config → ThresholdEngine → alerts.ts → Hooks  (validateThresholds NOT here)
 */

import type { ThresholdConfig } from './thresholds';

// ─────────────────────────────────────────────────────────────────────────────
// VALID VALUES
// ─────────────────────────────────────────────────────────────────────────────

const VALID_DIRECTIONS = new Set<string>(['increase', 'decrease']);

const VALID_STRATEGIES = new Set<string>([
  'moving_average',
  'mean',
  'median',
  'p25',
  'percentile_25',
  'p75',
  'percentile_75',
]);

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate all entries in a THRESHOLDS record.
 *
 * Checks performed per entry:
 *  1. `baselineStrategy` is present (optional warning — not an error)
 *  2. `baselineStrategy`, when present, is a recognised strategy string
 *  3. `direction` is 'increase' or 'decrease'
 *  4. `warning` and `critical` are finite numbers
 *  5. `warning` < `critical` (inverted thresholds cause silent non-alerts)
 *  6. `absoluteWarning` / `absoluteCritical`, when present, are finite numbers
 *
 * All findings are emitted as `console.warn` — never `console.error` or `throw`.
 * This ensures the function is purely advisory and never blocks execution.
 *
 * @param thresholds - The THRESHOLDS registry to validate.
 *
 * IMPORTANT: This function is a no-op outside 'development' and 'test' environments.
 */
export function validateThresholdConfig(
  thresholds: Record<string, ThresholdConfig>
): void {
  // ── Environment gate — hard no-op in production ──────────────────────────
  const env = process.env.NODE_ENV;
  if (env !== 'development' && env !== 'test') return;

  const prefix = '[validateThresholdConfig]';

  for (const [key, config] of Object.entries(thresholds)) {
    // ── 1. baselineStrategy present? ──────────────────────────────────────
    if (config.baselineStrategy === undefined) {
      console.warn(
        `${prefix} "${key}": missing baselineStrategy — system defaults to 'mean'. ` +
        `Add an explicit strategy to document intent and prevent silent misconfiguration.`
      );
    }

    // ── 2. baselineStrategy is a known value (when present) ───────────────
    if (
      config.baselineStrategy !== undefined &&
      !VALID_STRATEGIES.has(config.baselineStrategy)
    ) {
      console.warn(
        `${prefix} "${key}": unknown baselineStrategy "${config.baselineStrategy}". ` +
        `normalizeStrategy() will fall back to 'mean'. ` +
        `Valid values: ${[...VALID_STRATEGIES].join(', ')}`
      );
    }

    // ── 3. direction is valid ─────────────────────────────────────────────
    if (!VALID_DIRECTIONS.has(config.direction)) {
      console.warn(
        `${prefix} "${key}": invalid direction "${config.direction}". ` +
        `Must be 'increase' or 'decrease'. Threshold evaluation will be incorrect.`
      );
    }

    // ── 4. warning and critical are finite numbers ────────────────────────
    if (typeof config.warning !== 'number' || !isFinite(config.warning)) {
      console.warn(
        `${prefix} "${key}": warning is not a finite number (got ${config.warning}). ` +
        `Threshold evaluation may produce unexpected results.`
      );
    }

    if (typeof config.critical !== 'number' || !isFinite(config.critical)) {
      console.warn(
        `${prefix} "${key}": critical is not a finite number (got ${config.critical}). ` +
        `Threshold evaluation may produce unexpected results.`
      );
    }

    // ── 5. warning < critical (sanity check — inverted = silent alerts) ───
    if (
      typeof config.warning  === 'number' && isFinite(config.warning) &&
      typeof config.critical === 'number' && isFinite(config.critical) &&
      config.warning >= config.critical
    ) {
      console.warn(
        `${prefix} "${key}": warning (${config.warning}) >= critical (${config.critical}). ` +
        `Warning will never fire before critical. Swap the values if this is unintentional.`
      );
    }

    // ── 6. absoluteWarning / absoluteCritical are finite when present ─────
    if (
      config.absoluteWarning !== undefined &&
      (typeof config.absoluteWarning !== 'number' || !isFinite(config.absoluteWarning))
    ) {
      console.warn(
        `${prefix} "${key}": absoluteWarning is not a finite number ` +
        `(got ${config.absoluteWarning}). Absolute threshold check will be skipped.`
      );
    }

    if (
      config.absoluteCritical !== undefined &&
      (typeof config.absoluteCritical !== 'number' || !isFinite(config.absoluteCritical))
    ) {
      console.warn(
        `${prefix} "${key}": absoluteCritical is not a finite number ` +
        `(got ${config.absoluteCritical}). Absolute threshold check will be skipped.`
      );
    }
  }
}
