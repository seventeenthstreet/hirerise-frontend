/**
 * @file lib/utils/format.ts
 * @description Shared formatting utilities for numeric display.
 *
 * Centralises formatting logic that was previously inlined across engine files.
 * All functions are pure — no side effects, no external dependencies.
 */

/**
 * Format a fractional value (0–1) as a percentage string.
 *
 * Multiplies by 100, rounds to 1 decimal place, appends "%".
 *
 * @param value  Fractional value (e.g. 0.123 → "12.3%")
 * @returns      Formatted string, e.g. "12.3%"
 *
 * @example
 *   formatPercent(0.183)  // → "18.3%"
 *   formatPercent(0.1)    // → "10.0%"
 *   formatPercent(0)      // → "0.0%"
 *
 * Output is identical to the previous inline form:
 *   (value * 100).toFixed(1) + "%"
 * No rounding changes. No logic changes. Strictly a readability consolidation.
 */
export function formatPercent(value: number): string {
  return (value * 100).toFixed(1) + '%';
}