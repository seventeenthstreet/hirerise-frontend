/**
 * src/hooks/queries/useStudentAcademicProfile.ts
 *
 * STUDENT ACADEMIC PROFILE — QUERY HOOK
 * ───────────────────────────────────────
 * Fetches the full academic profile for the currently authenticated student:
 *  - profile (country, region, board, stream, class_level)
 *  - subjects (selected subject IDs + metadata)
 *  - languages (medium + additional)
 *  - onboarding_status
 *  - is_complete
 *
 * This is the canonical source of truth for onboarding state on the frontend.
 * Mutations (save subjects, save languages, complete onboarding) invalidate
 * this key via the invalidation service — they never stale-check it themselves.
 *
 * AUTH REQUIREMENT:
 *  The hook requires an authenticated userId. If userId is absent (not yet
 *  authenticated) the query is disabled and returns `{ data: undefined, ... }`.
 *  Pass the Supabase Auth UID from your auth context.
 *
 * ARCHITECTURE POSITION:
 *   API layer → [THIS FILE] → onboarding UI components
 */

import { useQuery } from '@tanstack/react-query';
import { getStudentFullProfile }          from '../../api/academicOnboardingApi';
import { academicQueryKeys }              from '../queryKeys/academicQueryKeys';
import { unwrapOrThrow, academicRpcRetryPredicate } from '../utils/rpcExecutor';
import {
  ONBOARDING_STALE_TIME,
  ONBOARDING_GC_TIME,
  ONBOARDING_REFETCH_OPTIONS,
  isQueryEnabled,
} from '../utils/hookHelpers';
import type { StudentFullProfile } from '../types/onboarding.types';

// ─────────────────────────────────────────────────────────────────────────────
// RETURN TYPE
// ─────────────────────────────────────────────────────────────────────────────

export interface UseStudentAcademicProfileReturn {
  profile:           StudentFullProfile | undefined;
  isLoading:         boolean;
  isFetching:        boolean;
  isError:           boolean;
  error:             Error | null;
  /** True when profile is loaded, not errored, and onboarding is complete. */
  isOnboardingDone:  boolean;
  /** True when profile is loaded and not currently fetching. */
  isReady:           boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches the student's full academic profile.
 *
 * @param userId  Supabase Auth UID of the authenticated student.
 *                Query is disabled when falsy.
 */
export function useStudentAcademicProfile(
  userId: string | undefined | null,
): UseStudentAcademicProfileReturn {
  const enabled = isQueryEnabled(userId);

  const result = useQuery<StudentFullProfile, Error>({
    queryKey:  academicQueryKeys.studentProfile(userId ?? ''),
    queryFn:   async () => {
      // signal is available if React Query adds cancellation; pass through when
      // the API is upgraded to support AbortSignal
      const res = await getStudentFullProfile();
      return unwrapOrThrow(res);
    },
    enabled,
    staleTime:  ONBOARDING_STALE_TIME,
    gcTime:     ONBOARDING_GC_TIME,
    retry:      academicRpcRetryPredicate,
    ...ONBOARDING_REFETCH_OPTIONS,
  });

  return {
    profile:          result.data,
    isLoading:        result.isLoading,
    isFetching:       result.isFetching,
    isError:          result.isError,
    error:            result.error,
    isOnboardingDone: result.data?.is_complete === true,
    isReady:          !result.isLoading && !result.isError && result.data !== undefined,
  };
}
