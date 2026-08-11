/**
 * @file src/shared/utils/mapScoreToExplanationTier.ts
 *
 * @description
 * Standalone, authoritative score-to-explanation-tier utility for the
 * HireRise XAI-1 Explainable AI programme.
 *
 * This is the single canonical source of truth for explanation tier
 * classification. No other module in the explanation pipeline may
 * implement inline threshold logic. All consumers must use this function.
 *
 * Programme context: XAI-1 Sprint 0 / R1-DEV-01
 * Specification:     R1-SPEC-01 (Accepted)
 *
 * @module shared/utils/mapScoreToExplanationTier
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The canonical set of explanation tier values.
 *
 * Only these four values may be returned by `mapScoreToExplanationTier`.
 * No additional values are permitted anywhere in the XAI explanation pipeline.
 */
export type ExplanationTier = 'HIGH' | 'MEDIUM' | 'LOW' | 'NO_DATA';

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Map a numeric score to the canonical ExplanationTier.
 *
 * @param score - A numeric score in the range [0, 100]. Values outside
 *   this range, non-numeric types, null, undefined, NaN, Infinity, and
 *   -Infinity are all treated as invalid and return `'NO_DATA'`.
 *
 * @returns The corresponding `ExplanationTier`:
 *   - `'HIGH'`    when `score >= 80`
 *   - `'MEDIUM'`  when `60 <= score < 80`
 *   - `'LOW'`     when `0  <= score < 60`
 *   - `'NO_DATA'` for any invalid input
 *
 * @example
 * mapScoreToExplanationTier(95)        // 'HIGH'
 * mapScoreToExplanationTier(75)        // 'MEDIUM'
 * mapScoreToExplanationTier(50)        // 'LOW'
 * mapScoreToExplanationTier(0)         // 'LOW'   ← 0 is valid
 * mapScoreToExplanationTier(undefined) // 'NO_DATA'
 * mapScoreToExplanationTier(null)      // 'NO_DATA'
 * mapScoreToExplanationTier(NaN)       // 'NO_DATA'
 * mapScoreToExplanationTier(-1)        // 'NO_DATA'
 * mapScoreToExplanationTier(150)       // 'NO_DATA'
 */
export function mapScoreToExplanationTier(
  score: number | null | undefined,
): ExplanationTier {
  // Guard: must be a finite number. This correctly handles null, undefined,
  // NaN, Infinity, -Infinity, and all non-number types.
  // NOTE: Do NOT use `if (!score)` — 0 is a valid score that must return LOW.
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return 'NO_DATA';
  }

  // Guard: domain constraint [0, 100].
  if (score < 0 || score > 100) {
    return 'NO_DATA';
  }

  // Canonical threshold mapping (R1-SPEC-01).
  if (score >= 80) return 'HIGH';
  if (score >= 60) return 'MEDIUM';
  return 'LOW';
}
