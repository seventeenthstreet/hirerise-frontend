/**
 * @file src/features/onboarding/queries/queryKeys.ts
 * @description Canonical onboarding query key factory.
 *
 * OWNERSHIP
 * ─────────
 * This module is the single source of truth for all onboarding cache keys.
 * Previously the keys lived in `lib/query/queryKeys.ts` under the shared
 * `queryKeys.onboarding` namespace. That location was correct for early
 * development, but as the onboarding feature has grown its own domain
 * boundary, the keys belong with the feature that owns them.
 *
 * `lib/query/queryKeys.ts` re-exports `onboardingQueryKeys` via the
 * `queryKeys.onboarding` namespace so all existing call sites continue
 * to work without modification (see backward-compat note below).
 *
 * KEY HIERARCHY
 * ─────────────
 * React Query uses prefix-matching for invalidation. The hierarchy here is
 * designed so that:
 *   - `all()` busts everything onboarding-related (use sparingly)
 *   - `progress(userId)` busts a specific user's progress without affecting
 *     other users' cached data (important for account-switch safety)
 *   - `status(userId)` is a narrower key for status-only checks that don't
 *     need full progress data
 *   - `step(userId, stepId)` reserves space for future leaf-level optimistic
 *     updates — not yet used in any query, but present in the hierarchy
 *
 * Example invalidation scopes:
 *   invalidateQueries(['onboarding'])                          → all onboarding
 *   invalidateQueries(['onboarding', 'progress', userId])      → one user's progress
 *   invalidateQueries(['onboarding', 'progress', userId, 'step', stepId])  → one step
 *
 * USER-SCOPED KEYS
 * ────────────────
 * WHY scope progress and status keys by userId:
 *   Without userId scoping, all users share the same cache entry for
 *   `['onboarding']`. On account switch (or when multiple tabs are open
 *   with different sessions), the cache from the previous user bleeds into
 *   the new session. User-scoped keys give each user their own cache entry
 *   and allow targeted invalidation on logout/switch without busting
 *   unrelated users' cached data.
 *
 * BACKWARD COMPATIBILITY
 * ──────────────────────
 * `lib/query/queryKeys.ts` exposes `queryKeys.onboarding` which delegates
 * to this module. Call sites that use `queryKeys.onboarding.all()` or
 * `queryKeys.onboarding.status(userId)` continue to work unchanged.
 * Only sites that need the new `progress` or `step` keys need to import
 * from this module directly (or via the re-export).
 */

// ─────────────────────────────────────────────────────────────────────────────
// KEY FACTORY
// ─────────────────────────────────────────────────────────────────────────────

export const onboardingQueryKeys = {

  /**
   * Root key — invalidates ALL onboarding queries for ALL users.
   * Use for post-logout cache clearing or direction reset.
   * Prefer narrower keys (progress, status) for per-user invalidation.
   */
  all: () => ['onboarding'] as const,

  /**
   * Full progress document for a specific user.
   * Contains: steps[], currentStep, completedSteps, restoredData.
   *
   * This is the primary read key — used by useOnboarding's useQuery call.
   * Invalidated by: saveProgress, submitOnboarding, useSubmitOnboardingStep.
   */
  progress: (userId: string) =>
    ['onboarding', 'progress', userId] as const,

  /**
   * Status-only key for a specific user.
   * Narrower than progress — for guard checks that only need
   * onboarding_completed / user_type, not full step data.
   *
   * Currently maps to the same backend endpoint as progress (the server
   * returns the full document regardless). The key distinction is semantic:
   * a status-only consumer shouldn't trigger a progress refetch and vice versa.
   */
  status: (userId: string) =>
    ['onboarding', 'status', userId] as const,

  /**
   * Leaf key for a single step's cached data.
   * Reserved for future optimistic step patching — not yet wired to any query.
   *
   * When used: after a step is saved optimistically, the leaf key can be
   * updated directly without invalidating the full progress document.
   * This avoids a full refetch on every intermediate step save.
   */
  step: (userId: string, stepId: string) =>
    ['onboarding', 'progress', userId, 'step', stepId] as const,

  /**
   * Direction selection state.
   * Reserved for a potential direction-query extraction.
   * Currently direction is stored in AppContext user state, not React Query.
   */
  direction: () => ['onboarding', 'direction'] as const,

} as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPE EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

/** All possible onboarding query key tuples — for typed hook signatures. */
export type OnboardingQueryKey =
  | ReturnType<typeof onboardingQueryKeys.all>
  | ReturnType<typeof onboardingQueryKeys.progress>
  | ReturnType<typeof onboardingQueryKeys.status>
  | ReturnType<typeof onboardingQueryKeys.step>
  | ReturnType<typeof onboardingQueryKeys.direction>;