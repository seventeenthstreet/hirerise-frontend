/**
 * @file src/modules/student-onboarding/domain/scoring.ts
 *
 * SCORING DOMAIN
 * ──────────────
 * Canonical types for onboarding scoring, confidence, and readiness signals.
 *
 * These types serve as the stable contract between:
 *   - The adaptive assessment engine
 *   - The AI recommendation engine
 *   - The scoring orchestration layer
 *   - Analytics and career intelligence
 *
 * PHASE 2D NOTE:
 * Scoring logic is currently distributed across hooks and api types.
 * This file establishes the domain contract. Implementation consolidation
 * is Phase 3 work — do NOT move logic here until hooks are audited.
 */

/**
 * Confidence tier for a scored signal or recommendation.
 * Mirrors backend ConfidenceTier enum.
 */
export type ConfidenceTier = 'high' | 'medium' | 'low' | 'insufficient';

export const CONFIDENCE_TIERS: readonly ConfidenceTier[] = [
  'high',
  'medium',
  'low',
  'insufficient',
] as const;

/**
 * A scored signal from the onboarding assessment.
 */
export interface ScoredSignal {
  /** Signal category (e.g. 'academics', 'activities', 'cognitive'). */
  category: string;
  /** Normalized score 0–1. */
  score: number;
  /** Confidence tier for this signal. */
  confidence: ConfidenceTier;
  /** Number of data points contributing to this score. */
  sampleSize: number;
}

/**
 * Aggregate readiness score across all onboarding dimensions.
 */
export interface ReadinessScore {
  /** Overall readiness score 0–100. */
  overall: number;
  /** Per-dimension breakdown. */
  dimensions: Record<string, ScoredSignal>;
  /** Confidence tier of the aggregate. */
  confidence: ConfidenceTier;
  /** ISO timestamp of when this score was computed. */
  computedAt: string;
}
