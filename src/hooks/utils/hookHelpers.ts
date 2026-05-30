/**
 * src/hooks/utils/hookHelpers.ts
 *
 * HOOK UTILITY HELPERS
 * ─────────────────────
 * Shared staleTime / gcTime / retry strategy constants and
 * query instrumentation helpers used across all academic hooks.
 *
 * Centralising these prevents drift where one hook uses 5 minutes
 * and another uses 10 minutes for the same category of data.
 */

// ─────────────────────────────────────────────────────────────────────────────
// STALE TIME STRATEGY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Taxonomy data (countries/regions/boards/streams/subjects/languages):
 * - Controlled by HireRise admins, changes rarely (weekly at most).
 * - 30-minute staleTime means users aren't hitting the DB on every page visit.
 */
export const TAXONOMY_STALE_TIME = 30 * 60 * 1000; // 30 minutes

/**
 * Student profile and onboarding state:
 * - Changes on every mutation step.
 * - 0 staleTime ensures reads after a write always reflect the latest state.
 * - React Query's mutation invalidation is the primary freshness mechanism.
 */
export const ONBOARDING_STALE_TIME = 0;

// ─────────────────────────────────────────────────────────────────────────────
// GC TIME STRATEGY (formerly cacheTime)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Taxonomy data: keep in memory for 1 hour after all subscribers unmount.
 * Multi-step onboarding flows mount/unmount many components — this prevents
 * redundant re-fetches as users navigate between steps.
 */
export const TAXONOMY_GC_TIME = 60 * 60 * 1000; // 1 hour

/**
 * Onboarding data: 5 minutes after unmount.
 * Keeps profile data cached across step transitions without holding stale
 * data too long when a user leaves onboarding mid-flow.
 */
export const ONBOARDING_GC_TIME = 5 * 60 * 1000; // 5 minutes

// ─────────────────────────────────────────────────────────────────────────────
// REFETCH STRATEGY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Taxonomy data does not change based on user activity in another tab.
 * Suppress background refetches to reduce unnecessary RPC calls.
 */
export const TAXONOMY_REFETCH_OPTIONS = {
  refetchOnWindowFocus:      false,
  refetchOnReconnect:        false,
  refetchOnMount:            false,
} as const;

/**
 * Onboarding data: refetch on window focus to pick up any cross-tab changes,
 * but not on mount (mutation invalidation handles that).
 */
export const ONBOARDING_REFETCH_OPTIONS = {
  refetchOnWindowFocus: true,
  refetchOnReconnect:   true,
  refetchOnMount:       false,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// ENABLED GUARD HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns false if any argument is undefined, null, or an empty string.
 * Used for `enabled` guard in dependent queries (e.g. don't fetch regions
 * until countryCode is available).
 *
 * @example
 *   enabled: isQueryEnabled(countryCode)
 *   enabled: isQueryEnabled(boardCode, countryCode)
 */
export function isQueryEnabled(...args: (string | undefined | null)[]): boolean {
  return args.every((a) => a !== undefined && a !== null && a.trim() !== '');
}
