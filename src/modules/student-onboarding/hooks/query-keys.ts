/**
 * @file src/modules/student-onboarding/hooks/query-keys.ts
 *
 * STUDENT ONBOARDING — QUERY KEY FACTORY
 * ───────────────────────────────────────
 * Centralized React Query cache key definitions for the Student Onboarding module.
 *
 * ARCHITECTURE POSITION (HireRise Blueprint):
 *   API Layer (student-onboarding.api.ts)
 *     ↓
 *   [THIS FILE: cache key definitions]
 *     ↓
 *   Hooks (useStudentOnboardingSession, useEducationProfile, ...)
 *     ↓
 *   UI / Pages
 *
 * KEY HIERARCHY:
 *   React Query uses array prefix-matching for invalidation. The hierarchy is
 *   designed so targeted and broad invalidations are both possible:
 *
 *   ['student-onboarding']
 *     ↳ root — invalidates ALL student onboarding queries for ALL users
 *   ['student-onboarding', 'session', userId]
 *     ↳ session state for a specific user (currentStep, completedSteps, etc.)
 *   ['student-onboarding', 'education-profile', userId]
 *     ↳ education profile for a specific user (Step 1 data)
 *
 *   FUTURE KEYS (reserved, document here before implementing):
 *   ['student-onboarding', 'academics-profile', userId]    ← Step 2
 *   ['student-onboarding', 'activities-profile', userId]   ← Step 3
 *   ['student-onboarding', 'cognitive-profile', userId]    ← Step 4
 *   ['student-onboarding', 'aspiration-profile', userId]   ← Step 5
 *   ['student-onboarding', 'scoring-result', userId]       ← AI engine result
 *
 * USER-SCOPED KEYS:
 *   All leaf keys include userId to ensure:
 *     1. Different users on the same device/browser get separate cache entries.
 *     2. On account switch, invalidating the old user's root key does not bleed
 *        into the new session.
 *     3. Targeted invalidation (invalidate one user's session without touching
 *        another's) is possible in future multi-account scenarios.
 *
 * INVALIDATION PATTERNS:
 *   Invalidate all student onboarding queries:
 *     queryClient.invalidateQueries({ queryKey: studentOnboardingQueryKeys.all() })
 *
 *   Invalidate only the session for a specific user:
 *     queryClient.invalidateQueries({ queryKey: studentOnboardingQueryKeys.session(userId) })
 *
 *   Invalidate only the education profile for a specific user:
 *     queryClient.invalidateQueries({ queryKey: studentOnboardingQueryKeys.educationProfile(userId) })
 *
 * GLOBAL REGISTRY:
 *   This module's keys are NOT registered in lib/query/queryKeys.ts because
 *   studentOnboarding is a self-contained module with its own domain boundary.
 *   The lib/query keys file is for cross-cutting infrastructure concerns.
 *   Module-owned query keys belong with the module that owns them.
 *
 *   If future orchestration (e.g. a boot sequence hook or a global cache-warm)
 *   needs to invalidate student onboarding from outside this module, import
 *   studentOnboardingQueryKeys directly:
 *
 *     import { studentOnboardingQueryKeys }
 *       from '@/modules/student-onboarding/hooks';
 *
 * RULES:
 *  ✅  All keys are plain readonly arrays — no magic strings scattered across hooks.
 *  ✅  All leaf keys are user-scoped (include userId).
 *  ✅  All factory functions are defined as module-level constants (not inline lambdas).
 *  ❌  No business logic here. No imports from the API layer.
 *  ❌  No React imports.
 */

// ─────────────────────────────────────────────────────────────────────────────
// KEY FACTORY
// ─────────────────────────────────────────────────────────────────────────────

export const studentOnboardingQueryKeys = {

  /**
   * Root key — invalidates ALL student onboarding queries across ALL users.
   *
   * USE CASES:
   *  - Post-logout cleanup (clear all onboarding state for security).
   *  - Full module cache bust during development / debugging.
   *  - Future: orchestrated reset when a student's account is reprovisioned.
   *
   * PREFER narrower keys (session, educationProfile) for per-operation invalidation.
   */
  all: () => ['student-onboarding'] as const,

  /**
   * Session key for a specific authenticated user.
   *
   * Scopes: currentStep, completedSteps, completionPct, isComplete, updatedAt.
   *
   * INVALIDATED BY:
   *  - useUpdateOnboardingStep (on successful step advance)
   *  - useSaveEducationProfile (on successful profile save — session also advances)
   *
   * NEVER invalidated by:
   *  - Read-only queries (useStudentOnboardingSession, useEducationProfile)
   *
   * @param userId  Supabase Auth UID of the authenticated user.
   */
  session: (userId: string) =>
    ['student-onboarding', 'session', userId] as const,

  /**
   * Education profile key for a specific authenticated user.
   *
   * Scopes: educationLevel, boardType, schoolType, updatedAt.
   *
   * INVALIDATED BY:
   *  - useSaveEducationProfile (on successful upsert)
   *
   * NEVER invalidated by:
   *  - useUpdateOnboardingStep (session-only mutation — profile untouched)
   *  - useStudentOnboardingSession (read-only query)
   *
   * @param userId  Supabase Auth UID of the authenticated user.
   */
  educationProfile: (userId: string) =>
    ['student-onboarding', 'education-profile', userId] as const,

  // ─────────────────────────────────────────────────────────────────────────
  // RESERVED KEYS — Phase 2C+ (document before implementing)
  // These are not yet wired to any query. They are listed here so:
  //   1. The hierarchy is visible to all future contributors.
  //   2. The naming convention is locked in before multiple implementers diverge.
  //   3. Invalidation patterns can be designed before the features ship.
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @reserved Phase 2C — Academics step profile.
   * Will scope: subjects, marks, performance metrics from Step 2.
   */
  // academicsProfile: (userId: string) =>
  //   ['student-onboarding', 'academics-profile', userId] as const,

  /**
   * @reserved Phase 2D — Activities step profile.
   * Will scope: extracurricular activities, leadership, clubs from Step 3.
   */
  // activitiesProfile: (userId: string) =>
  //   ['student-onboarding', 'activities-profile', userId] as const,

  /**
   * Phase 3C — Cognitive assessment profile.
   * Scopes: cognitive question responses from Step 4.
   *
   * NOTE: NOT used by Phase 3C hooks directly. Reserved for future cross-module
   * use (e.g. boot sequence, global cache warm). See COGNITIVE_QUERY_KEY in
   * use-cognitive.ts for the module-owned, non-user-scoped key used by hooks.
   *
   * @param userId  Supabase Auth UID of the authenticated user.
   */
  cognitiveProfile: (userId: string) =>
    ['student-onboarding', 'cognitive-profile', userId] as const,

  /**
   * @reserved Phase 2F — Aspiration profile.
   * Will scope: career goals, preferred fields from Step 5.
   */
  // aspirationProfile: (userId: string) =>
  //   ['student-onboarding', 'aspiration-profile', userId] as const,

  /**
   * @reserved Phase 3+ — AI Scoring Engine result.
   * Will scope: career stream recommendations, readiness scores.
   * Invalidated when the AI engine re-scores a completed session.
   */
  // scoringResult: (userId: string) =>
  //   ['student-onboarding', 'scoring-result', userId] as const,

} as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPE EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All possible student onboarding query key tuples.
 *
 * Used for typed hook signatures and typed queryClient.setQueryData() calls.
 * Ensures invalidateQueries and setQueryData never accept malformed keys.
 *
 * @example
 * // Typed cache pre-seeding (optimistic update support):
 * queryClient.setQueryData<OnboardingSession | null>(
 *   studentOnboardingQueryKeys.session(userId),
 *   previousSession,
 * );
 */
export type StudentOnboardingQueryKey =
  | ReturnType<typeof studentOnboardingQueryKeys.all>
  | ReturnType<typeof studentOnboardingQueryKeys.session>
  | ReturnType<typeof studentOnboardingQueryKeys.educationProfile>
  | ReturnType<typeof studentOnboardingQueryKeys.cognitiveProfile>; // ← Phase 3C