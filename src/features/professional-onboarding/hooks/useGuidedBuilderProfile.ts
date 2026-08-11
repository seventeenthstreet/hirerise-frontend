/**
 * @file src/features/professional-onboarding/hooks/useGuidedBuilderProfile.ts
 *
 * WP-PRO-09C — Frontend Foundation & API Integration Implementation
 *
 * Read hook for `GET /api/v1/onboarding/guided/profile` — the canonical
 * Professional Profile. Intended (in a later work package) to back both
 * form pre-fill for the Guided Builder step screens and the Review screen's
 * data source (WP-PRO-09B §8.4, §9.2). This work package implements the
 * hook only — no consuming UI.
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
import type { GuidedBuilderProfileResponse, ProfessionalProfile } from '../types';

export interface UseGuidedBuilderProfileReturn {
  /** The canonical Professional Profile, or null before any section has been saved. */
  profile: ProfessionalProfile | null | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: ApiClientError | null;
  refetch: () => void;
}

export function useGuidedBuilderProfile(): UseGuidedBuilderProfileReturn {
  const { user, isHydrated } = useAppContext();
  const userId = user?.id ?? null;

  const query = useQuery<GuidedBuilderProfileResponse, ApiClientError, ProfessionalProfile | null>({
    queryKey: professionalOnboardingQueryKeys.guidedProfile(userId ?? ''),
    queryFn: () => guidedBuilderApi.getProfile(),
    select: (data) => data.profile,
    enabled: isHydrated && userId !== null,
    retry: (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
  });

  return {
    profile: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error ?? null,
    refetch: () => void query.refetch(),
  };
}
