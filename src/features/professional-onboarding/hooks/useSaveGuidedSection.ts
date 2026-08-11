/**
 * @file src/features/professional-onboarding/hooks/useSaveGuidedSection.ts
 *
 * WP-PRO-09C — Frontend Foundation & API Integration Implementation
 * Implements WP-PRO-09B §7.3.
 *
 * Mutation hook for `POST /api/v1/onboarding/guided/:section`.
 *
 * DESIGN: ONE parameterized hook, not nine near-duplicate hooks.
 *   `useSaveGuidedSection('education')` returns a mutation scoped to the
 *   education section; the section is baked into the returned mutation's
 *   `mutationFn` closure, not passed at call time, so callers get a stable,
 *   typed `mutate(payload)` signature per section without copy-pasted hook
 *   bodies drifting from each other over time.
 *
 * RESPONSIBILITIES:
 *  - Wrap guidedBuilderApi.saveSection in useMutation
 *  - Invalidate the shared progress cache + guided-profile cache + user cache
 *  - Apply the non-idempotent-safe retry policy already established by
 *    useUploadResume.ts (retry: false) — retrying a POST that mutates the
 *    Professional Profile on a transient 5xx risks duplicate/partial writes
 *  - Surface structured ApiClientError to callers
 *
 * HARD RULES:
 *  - NO UI logic — callers handle loading / success / error states.
 *  - NO direct fetch/axios — always through guidedBuilderApi.
 *  - Errors are ApiClientError instances — never rethrown as raw.
 *
 * Architecture position: Hooks layer (second tier)
 *   API → Hooks → UI → Pages → Guards → Context
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAppContext } from '@/context/AppContext';
import type { ApiClientError } from '@/lib/api/core';
import { queryKeys, retryDelay } from '@/lib/query';

import { guidedBuilderApi } from '../api/guided-builder.api';
import { professionalOnboardingQueryKeys } from '../queries/queryKeys';
import type { GuidedBuilderSection, GuidedSectionPayload, SaveGuidedSectionResponse } from '../types';

export function useSaveGuidedSection(section: GuidedBuilderSection) {
  const queryClient = useQueryClient();
  const { user } = useAppContext();
  const userId = user?.id ?? null;

  return useMutation<SaveGuidedSectionResponse, ApiClientError, GuidedSectionPayload>({
    mutationFn: (data) => guidedBuilderApi.saveSection(section, data),

    // NON-IDEMPOTENT: each call writes to the Professional Profile and
    // (for the five gating sections) advances step_history. Retrying on a
    // transient 5xx risks a duplicate/partial write. Matches the documented
    // rationale in hooks/mutations/useUploadResume.ts.
    // ⚠️  DO NOT change to shouldRetry — keep retry: false.
    retry: false,
    retryDelay,

    onSuccess: () => {
      // Progress (steps[], currentStep) changes for the five gating
      // sections, and is a cheap no-op invalidation for the four
      // enrichment-only sections (progress is unaffected, but a refetch
      // is harmless and keeps this hook simple/uniform across all nine
      // sections rather than special-casing which ones gate progress).
      if (userId) {
        void queryClient.invalidateQueries({
          queryKey: professionalOnboardingQueryKeys.progress(userId),
        });
        void queryClient.invalidateQueries({
          queryKey: professionalOnboardingQueryKeys.guidedProfile(userId),
        });
      }
      // Mirrors the existing useSubmitStep.ts invalidation of the current
      // user cache, in case onboarding_completed / profile flags are
      // embedded in /users/me.
      void queryClient.invalidateQueries({ queryKey: queryKeys.user.me() });
    },
  });
}
