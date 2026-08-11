/**
 * @file src/features/professional-onboarding/hooks/useProfessionalOnboardingProgress.ts
 *
 * WP-PRO-09C — Frontend Foundation & API Integration Implementation
 *
 * Read hook for `GET /api/v1/onboarding/progress`, scoped for the
 * Professional Guided Builder / Resume Upload UI (a later work package).
 *
 * RESPONSIBILITIES:
 *  - Fetch progress via the corrected API layer (guidedBuilderApi.getProgress)
 *  - Reuse the SAME cache entry as every other onboarding surface
 *    (professionalOnboardingQueryKeys.progress → onboardingQueryKeys.progress)
 *  - Apply the same auth-gating pattern already established across the
 *    codebase (isHydrated && userId !== null) — mirrors useOnboarding.ts and
 *    modules/student-onboarding/hooks/use-student-onboarding-session.ts
 *  - Surface track inference (display-only) alongside the raw progress data
 *
 * HARD RULES:
 *  - NO UI logic — this hook returns data + status flags only.
 *  - NO mutation / invalidation here — this is a read-only query hook.
 *  - NO direct fetch/axios — always through the guidedBuilderApi wrapper.
 *
 * Architecture position: Hooks layer (second tier)
 *   API → Hooks → UI → Pages → Guards → Context
 */

import { useQuery } from '@tanstack/react-query';

import { useAppContext } from '@/context/AppContext';
import type { ApiClientError } from '@/lib/api/core';
import { retryDelay, shouldRetry } from '@/lib/query';

import { guidedBuilderApi } from '../api/guided-builder.api';
import { professionalOnboardingQueryKeys } from '../queries/queryKeys';
import { inferOnboardingTrack } from '../utils/track-detection';
import type { OnboardingTrack, ProfessionalOnboardingProgressResponse } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface UseProfessionalOnboardingProgressReturn {
  /** Raw Progress API response, or undefined while loading / before first fetch. */
  progress: ProfessionalOnboardingProgressResponse | undefined;
  /** Display-only track inference — see utils/track-detection.ts. */
  track: OnboardingTrack;
  isLoading: boolean;
  isFetching: boolean;
  error: ApiClientError | null;
  refetch: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useProfessionalOnboardingProgress(): UseProfessionalOnboardingProgressReturn {
  const { user, isHydrated } = useAppContext();
  const userId = user?.id ?? null;

  const query = useQuery<ProfessionalOnboardingProgressResponse, ApiClientError>({
    queryKey: professionalOnboardingQueryKeys.progress(userId ?? ''),
    queryFn: () => guidedBuilderApi.getProgress(),
    // Pattern mirrors useOnboarding.ts — don't fire before the app has
    // finished its own boot sequence, and never for an unauthenticated user.
    enabled: isHydrated && userId !== null,
    retry: (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
  });

  return {
    progress: query.data,
    track: inferOnboardingTrack(query.data?.steps),
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error ?? null,
    refetch: () => void query.refetch(),
  };
}
