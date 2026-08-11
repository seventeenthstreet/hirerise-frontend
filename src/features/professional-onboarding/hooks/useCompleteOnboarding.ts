/**
 * @file src/features/professional-onboarding/hooks/useCompleteOnboarding.ts
 *
 * WP-PRO-09C — Frontend Foundation & API Integration Implementation
 *
 * Mutation hook for `POST /api/v1/onboarding/complete`.
 *
 * Deliberately does NOT trigger `POST /api/v1/onboarding/career-report` —
 * per WP-PRO-09B §10.1, completion success must not be blocked on the
 * (rate-limited, potentially slower) career-report call. A later work
 * package's CompletionScreen calls this hook and
 * `guidedBuilderApi.generateCareerReport()` as two independent steps.
 *
 * RESPONSIBILITIES:
 *  - Wrap guidedBuilderApi.complete in useMutation
 *  - Invalidate the shared progress cache + the current-user cache (so
 *    onboarding_completed / professional_onboarding_complete flags refresh)
 *  - This call IS safe to retry — the frozen backend merges step_history
 *    rather than overwriting it (onboarding.controller.js#completeOnboarding)
 *
 * BUGFIX (2026-07-28) — "Go to Dashboard" bounced back to /onboarding/profile:
 *   AppContext.user is a plain useState populated only by AppContext's own
 *   hydration cycle (fetchUser on INITIAL_SESSION/SIGNED_IN/TOKEN_REFRESHED)
 *   or by explicitly calling refreshUser() — it is NOT re-derived from the
 *   React Query cache. AuthGuard / OnboardingGuard both read `user` from
 *   useAppContext(), never from useUser()/useQuery(['user','me']).
 *
 *   invalidateQueries({ queryKey: queryKeys.user.me() }) only marks that
 *   React Query cache entry stale; it does not call AppContext's setUser().
 *   With no mounted useUser() observer in the onboarding flow, the
 *   invalidation was frequently a no-op besides. Net effect: AppContext.user
 *   kept the pre-completion snapshot (professional_onboarding_complete:
 *   false) until the next full hydration event (e.g. a page reload). So
 *   when CompletionScreen navigated to /dashboard, AuthGuard's
 *   requireOnboardingComplete(user) still saw onboarding as incomplete and
 *   redirected back to /onboarding/profile — a full loop back to Step 2.
 *
 *   FIX: also call AppContext's refreshUser() (awaited) in onSuccess. This
 *   re-fetches /users/me and updates the AppContext.user object the guards
 *   actually read, before mutateAsync() resolves in ReviewScreen — so by
 *   the time the person reaches CompletionScreen and clicks "Go to
 *   Dashboard", AppContext already has the up-to-date completion flags.
 *
 * HARD RULES:
 *  - NO UI logic — callers own success/navigation presentation.
 *  - NO career-report triggering here — kept as a separate, explicit call
 *    site so completion success is never gated on report generation.
 *  - NO direct fetch/axios — always through guidedBuilderApi.
 *
 * Architecture position: Hooks layer (second tier)
 *   API → Hooks → UI → Pages → Guards → Context
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAppContext } from '@/context/AppContext';
import type { ApiClientError } from '@/lib/api/core';
import { queryKeys, retryDelay, shouldRetry } from '@/lib/query';

import { guidedBuilderApi } from '../api/guided-builder.api';
import { professionalOnboardingQueryKeys } from '../queries/queryKeys';
import type { CompleteOnboardingResponse } from '../types';

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAppContext();
  const userId = user?.id ?? null;

  return useMutation<CompleteOnboardingResponse, ApiClientError, void>({
    mutationFn: () => guidedBuilderApi.complete(),

    // Idempotent-safe: the backend merges step_history rather than
    // overwriting it, so the standard retry predicate is appropriate here
    // (unlike the section-save / resume-upload mutations in this feature).
    retry: (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,

    onSuccess: async () => {
      if (userId) {
        void queryClient.invalidateQueries({
          queryKey: professionalOnboardingQueryKeys.progress(userId),
        });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.user.me() });

      // AppContext.user (what AuthGuard/OnboardingGuard actually read) is
      // NOT wired to React Query invalidation — see file header. Without
      // this, guards keep evaluating the stale, pre-completion user object
      // and bounce a just-finished professional back into onboarding.
      // Awaited so mutateAsync() in ReviewScreen doesn't resolve — and the
      // person can't reach "Go to Dashboard" — until AppContext is current.
      await refreshUser();
    },
  });
}