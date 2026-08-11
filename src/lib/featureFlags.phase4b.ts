/**
 * @file src/lib/featureFlags.phase4b.ts
 *
 * Phase 4B Feature Flag Extensions
 *
 * PURPOSE:
 *   Declares and documents the feature flags added in Phase 4B for AI
 *   augmentation. These additions extend (do not replace) featureFlags.ts.
 *
 * HOW TO APPLY:
 *   1. Add the fields from AugmentedFeatureFlags into the FeatureFlags
 *      interface in featureFlags.ts
 *   2. Add the defaults from FLAG_DEFAULTS_4B into FLAG_DEFAULTS in
 *      featureFlags.ts
 *   3. Add the targeting rules from USER_TARGETING_RULES_4B into
 *      USER_TARGETING_RULES in featureFlags.ts
 *
 * GOVERNANCE:
 *   All flags default to false (fail-closed).
 *   Emergency killswitch: ai_augmentation_enabled = false suppresses all AI
 *   augmentation instantly via remote config — no deployment required.
 *
 * FLAG HIERARCHY:
 *   ai_augmentation_enabled      — master switch (all Phase 4B)
 *   ├── ai_resume_extraction     — Phase 4B-4 only
 *   └── ai_conversational        — Phase 4B-5 only
 *
 *   ai_experimental_mode         — internal users only
 *   ai_research_mode             — engineering team only
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPE EXTENSION
// Add these fields to FeatureFlags interface in featureFlags.ts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Phase 4B additions to FeatureFlags.
 * Merge into the main FeatureFlags interface.
 */
export interface Phase4BFlags {
  /**
   * Master switch for all AI augmentation (Phase 4B).
   * Setting this false instantly disables all AI narrative rendering.
   * Default: false (fail-closed).
   */
  ai_augmentation_enabled: boolean;

  /**
   * AI-assisted resume signal extraction (Phase 4B-4).
   * Requires ai_augmentation_enabled = true.
   * Default: false.
   */
  ai_resume_extraction: boolean;

  /**
   * Session-scoped conversational AI (Phase 4B-5).
   * Highest risk capability — enabled only after 4B-1 through 4B-3 stable.
   * Requires ai_augmentation_enabled = true.
   * Default: false.
   */
  ai_conversational: boolean;

  /**
   * Experimental AI mode — internal users only.
   * Relaxed validation for prompt iteration and capability testing.
   * MUST NOT evaluate true for non-internal users.
   * Default: false.
   */
  ai_experimental_mode: boolean;

  /**
   * Research mode — engineering team only.
   * AI active with full logging for observability calibration.
   * MUST NOT evaluate true for non-internal users.
   * Default: false.
   */
  ai_research_mode: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT VALUES
// Merge into FLAG_DEFAULTS in featureFlags.ts
// All Phase 4B flags default false (fail-closed governance)
// ─────────────────────────────────────────────────────────────────────────────

export const FLAG_DEFAULTS_4B: Phase4BFlags = {
  ai_augmentation_enabled: false,
  ai_resume_extraction:    false,
  ai_conversational:       false,
  ai_experimental_mode:    false,
  ai_research_mode:        false,
};

// ─────────────────────────────────────────────────────────────────────────────
// TARGETING RULES
// Merge into USER_TARGETING_RULES in featureFlags.ts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Internal-user guard for experimental and research modes.
 * Evaluates against the existing FlagUserContext shape.
 */
export const USER_TARGETING_RULES_4B = [
  // ai_experimental_mode: internal users only
  {
    flag:      'ai_experimental_mode' as const,
    value:     true,
    condition: (ctx: { isInternal?: boolean }) => ctx.isInternal === true,
  },
  // ai_research_mode: engineering team only
  {
    flag:      'ai_research_mode' as const,
    value:     true,
    condition: (ctx: { isEngineeringTeam?: boolean }) => ctx.isEngineeringTeam === true,
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// GOVERNANCE HELPER
// Safe evaluation — returns false on any error (fail-closed)
// ─────────────────────────────────────────────────────────────────────────────

import { evaluateFlag } from './featureFlags';

/**
 * Returns true if AI augmentation is active for the current context.
 * This is the single canonical check — use this in hooks and API handlers.
 *
 * Fail-closed: any error or missing flag returns false.
 */
export function isAIAugmentationEnabled(): boolean {
  try {
    // R2 (XAI-1 Sprint 0): ai_augmentation_enabled is now registered in
    // FeatureFlags — typed call, no cast required.
    return evaluateFlag('ai_augmentation_enabled') ?? false;
  } catch {
    return false;
  }
}

/**
 * Returns true if the experimental AI mode is active.
 * Guards prompt iteration and relaxed-validation testing.
 * Will not be true for non-internal users even if flag is misconfigured,
 * because targeting rules guard it.
 */
export function isExperimentalAIMode(): boolean {
  try {
    // ai_experimental_mode is not yet in FeatureFlags — retained cast
    // until Phase4B flags are merged into the canonical registry.
    return (evaluateFlag as (flag: string) => boolean)('ai_experimental_mode') ?? false;
  } catch {
    return false;
  }
}
