/**
 * @file src/modules/student-onboarding/hooks/use-education-profile.ts
 *
 * HOOK: useEducationProfile
 * ──────────────────────────
 * Fetches and caches the authenticated student's saved education profile (Step 1 data).
 *
 * ARCHITECTURE POSITION (HireRise Blueprint):
 *   API (studentOnboardingApi.getEducationProfile)
 *     ↓
 *   [THIS FILE: query hook, null-safe state, UI-safe flags]
 *     ↓
 *   UI / Pages (read educationLevel, boardType, schoolType for form pre-fill)
 *
 * WHAT THIS HOOK DOES:
 *   1. Fetches the student's saved education profile from Supabase via the API layer.
 *   2. Returns null safely when no profile exists (Step 1 not yet completed).
 *   3. Exposes the profile for form pre-fill when the student navigates back to Step 1.
 *   4. Guards against unauthenticated execution — query disabled until userId is known.
 *   5. Prevents duplicate fetches — React Query deduplicates all concurrent calls.
 *
 * WHAT THIS HOOK DOES NOT DO:
 *   ✅  No Supabase logic — all DB access is in the API layer.
 *   ✅  No save/upsert logic — write operations are in useSaveEducationProfile.
 *   ✅  No UI components.
 *   ✅  No cache invalidation — that belongs in mutation hooks.
 *
 * NULL PROFILE HANDLING:
 *   getEducationProfile() returns null when no profile row exists.
 *   This is expected for users who haven't completed Step 1 yet.
 *   The hook surfaces null transparently:
 *     - `profile` is null
 *     - `isProfileFound` is false
 *   UI should treat null as "empty form" — not as an error.
 *
 * DEPENDENCY ON SESSION:
 *   This hook does NOT depend on useStudentOnboardingSession.
 *   They are independent query hooks that share userId from AppContext.
 *   The UI page is responsible for composing them if needed.
 *
 *   REASONING: Combining them would couple two separate data concerns into
 *   one hook, making it harder to independently invalidate session vs. profile
 *   after mutations. Separate hooks give each mutation hook surgical precision.
 *
 * STALE TIME STRATEGY:
 *   staleTime: 5 minutes — longer than the session (60s) because the education
 *   profile is more stable. It only changes when the student explicitly edits
 *   and resubmits Step 1. The mutation hook (useSaveEducationProfile) triggers
 *   explicit invalidation on every save, so the staleTime gap is irrelevant
 *   to data accuracy — it only affects how aggressively background refetches
 *   fire when no mutation has occurred.
 *
 * FORM PRE-FILL PATTERN:
 *   The primary consumer of this hook is the Step 1 form component.
 *   When the student navigates back to Step 1, the form should pre-populate
 *   with the previously saved data. This hook provides that data:
 *
 *   const { profile, isLoading } = useEducationProfile();
 *   // In form: defaultValues={{ educationLevel: profile?.educationLevel ?? '' }}
 *
 * FUTURE OPTIMISTIC UPDATE SUPPORT:
 *   When useSaveEducationProfile optimistically updates the profile cache,
 *   it will call:
 *     queryClient.setQueryData<EducationProfile | null>(
 *       studentOnboardingQueryKeys.educationProfile(userId),
 *       optimisticProfile,
 *     )
 *   The query key, data type, and structure here are designed to accept that
 *   pattern without any refactoring.
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { useAppContext } from '@/context/AppContext';
import { studentOnboardingApi } from '../api';
import {
  StudentOnboardingError,
  isStudentOnboardingError,
  type EducationProfile,
} from '../api';
import { studentOnboardingQueryKeys } from './query-keys';
import { retryDelay } from '@/lib/query';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How long the education profile is considered fresh (5 minutes).
 *
 * LONGER than the session stale time (60s) because the profile is more stable.
 * It only changes when the student explicitly edits and resubmits Step 1.
 * useSaveEducationProfile invalidates this cache on every save, so staleTime
 * governs background refetch frequency between explicit saves — not accuracy.
 */
const PROFILE_STALE_TIME_MS = 5 * 60 * 1_000; // 5 minutes

/**
 * Cache retention after all observers unmount (10 minutes).
 *
 * Longer than the session GC time (5 min) because profile data is used for
 * form pre-fill. If the student navigates away mid-step and returns within
 * 10 minutes, the cached profile eliminates a network round-trip.
 */
const PROFILE_GC_TIME_MS = 10 * 60 * 1_000; // 10 minutes

// ─────────────────────────────────────────────────────────────────────────────
// SELECTOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Module-level selector — identity transform on the education profile.
 *
 * Defined at module scope for referential stability (see useStudentOnboardingSession
 * for the full reasoning). No transformation is applied here — the profile from
 * the API layer is already normalized. Future derived fields (e.g. a computed
 * "has complete profile" flag) would be added here.
 */
function selectEducationProfile(data: EducationProfile | null): EducationProfile | null {
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// RETURN TYPE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * UI-safe state exposed by useEducationProfile.
 */
export interface UseEducationProfileReturn {
  /** The saved education profile, or null if Step 1 has not been completed. */
  profile: EducationProfile | null;

  /** True while the initial fetch is in-flight (no cached data yet). */
  isLoading: boolean;

  /**
   * True when a background refetch is running (cached data is present).
   * UI can show a subtle spinner without blocking form interaction.
   */
  isFetching: boolean;

  /** True if the fetch completed successfully (profile may still be null). */
  isSuccess: boolean;

  /** True if the fetch failed permanently (after retries). */
  isError: boolean;

  /**
   * The normalized error, or null if there is no error.
   * Branch on `errorCategory`, not on raw error messages or codes.
   */
  error: StudentOnboardingError | null;

  /**
   * Stable error category string, or null if there is no error.
   * 'auth' | 'not_found' | 'validation' | 'conflict' | 'server' | null
   */
  errorCategory: StudentOnboardingError['category'] | null;

  /**
   * True when the fetch succeeded and a profile row exists.
   * False when loading, errored, or when profile is null (Step 1 not yet done).
   *
   * Usage: `if (isProfileFound) { pre-fill form with profile data }`
   */
  isProfileFound: boolean;

  /**
   * Manual refetch trigger — for retry UI and network recovery.
   * Does not invalidate the cache (invalidation is handled by mutation hooks).
   */
  refetch: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches and caches the authenticated student's saved education profile.
 *
 * Returns null safely when the student hasn't completed Step 1 yet.
 * Query is disabled until userId is known and AppContext has booted.
 *
 * @example
 * const { profile, isLoading } = useEducationProfile();
 *
 * // Form pre-fill:
 * const defaultValues = {
 *   educationLevel: profile?.educationLevel ?? '',
 *   boardType: profile?.boardType ?? null,
 *   schoolType: profile?.schoolType ?? null,
 * };
 */
export function useEducationProfile(): UseEducationProfileReturn {
  // ── Auth gate — mirrors useStudentOnboardingSession ───────────────────────
  const { user, isHydrated } = useAppContext();
  const userId = user?.id ?? null;

  const query = useQuery<
    EducationProfile | null,   // TQueryFnData — what queryFn returns
    StudentOnboardingError,    // TError — normalized error type
    EducationProfile | null    // TData — what select returns (identity)
  >({
    queryKey: studentOnboardingQueryKeys.educationProfile(userId ?? ''),

    queryFn: () => studentOnboardingApi.getEducationProfile(),

    select: selectEducationProfile,

    // ── Guard — same pattern as useStudentOnboardingSession ──────────────
    // Both isHydrated and userId must be truthy for the query to fire.
    enabled: isHydrated && userId !== null,

    staleTime: PROFILE_STALE_TIME_MS,
    gcTime:    PROFILE_GC_TIME_MS,

    // ── Retry strategy — same as useStudentOnboardingSession ─────────────
    retry: (failureCount: number, error: unknown): boolean => {
      if (failureCount >= 2) return false;
      if (isStudentOnboardingError(error)) {
        if (error.category === 'auth')       return false;
        if (error.category === 'validation') return false;
        return true;
      }
      // Unknown errors — treat as transient, retry up to 2 times.
      return failureCount < 2;
    },

    retryDelay,

    // Profile data does not need focus-refetch — it changes only on explicit saves.
    refetchOnWindowFocus: false,
  });

  // ── Normalize error ───────────────────────────────────────────────────────
  const error: StudentOnboardingError | null = isStudentOnboardingError(query.error)
    ? query.error
    : null;

  // ── Derive convenience flags ─────────────────────────────────────────────
  const profile        = query.data ?? null;
  const isProfileFound = query.isSuccess && profile !== null;
  const errorCategory  = error?.category ?? null;

  return {
    profile,
    isLoading:    query.isLoading,
    isFetching:   query.isFetching,
    isSuccess:    query.isSuccess,
    isError:      query.isError,
    error,
    errorCategory,
    isProfileFound,
    refetch: () => { void query.refetch(); },
  };
}