/**
 * @file src/features/onboarding/mutations/useSubmitStep.ts
 *
 * PHASE 2 — MUTATION OWNERSHIP CONSOLIDATION
 *
 * Canonical location for the submit-onboarding-step mutation.
 *
 * OWNERSHIP MOVE:
 *   Previously at: hooks/mutations/useSubmitOnboardingStep.ts
 *   Now owned by:  features/onboarding/mutations/useSubmitStep.ts
 *
 * NAME CHANGE:
 *   Renamed from useSubmitOnboardingStep → useSubmitStep because "onboarding"
 *   is now the module namespace (features/onboarding/). The "Onboarding" infix
 *   is redundant within the domain module. The old name is re-exported from
 *   hooks/mutations for backward compatibility.
 *
 * COMPATIBILITY:
 *   hooks/mutations/useSubmitOnboardingStep.ts is kept as a re-export bridge.
 *   All existing consumers continue to import from '@/hooks/mutations'
 *   unchanged.
 *
 * PRESERVED:
 *   ✅ Same API contract via onboardingApi.submitStep
 *   ✅ Same invalidation: onboarding.all() + metrics.sections()
 *   ✅ Same retry predicate (shouldRetry, maxRetries=1)
 *   ✅ Same retryDelay
 *   ✅ Same structured onError handler
 *   ✅ Same SubmitOnboardingStepInput / SubmitOnboardingStepResponse types
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { onboardingApi } from '@/features/onboarding/api';
import type { SubmitOnboardingStepResponse, SubmitOnboardingStepInput } from '@/features/onboarding/types';
import { isApiClientError } from '@/lib/api/core';
import { shouldRetry, retryDelay, queryKeys } from '@/lib/query';

export type { SubmitOnboardingStepInput };

export function useSubmitStep() {
  const queryClient = useQueryClient();

  return useMutation<
    SubmitOnboardingStepResponse,
    Error,
    SubmitOnboardingStepInput
  >({
    mutationFn: ({ stepId, data }) => onboardingApi.submitStep(stepId, data),

    // Max retries = 1 for mutations — retrying a POST risks duplicate
    // side-effects on non-idempotent steps.
    retry: (failureCount, error) => shouldRetry(failureCount, error, /* maxRetries */ 1),

    retryDelay,

    onSuccess: () => {
      // Onboarding progress — currentStep and completedSteps have changed.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.onboarding.all(),
      });

      // Metrics sections — step submissions feed onboarding funnel aggregates.
      // Narrowed from metrics.all() to metrics.sections() to avoid busting
      // performance, reliability, and experiments sections unnecessarily.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.metrics.sections(),
      });

      // Q-05 — User cache invalidation after onboarding step submission.
      //
      // Problem:
      //   The page-level handleSubmit calls `await refreshUser()` after
      //   `submitOnboarding()`. This pattern relies on the page remembering
      //   to call refreshUser — and calling it at exactly the right time.
      //   If the mutation is used from any other call site (or if page-level
      //   refreshUser is skipped due to an early return), the user cache
      //   retains stale onboarding flags (e.g. onboarding_completed=false,
      //   professional_onboarding_complete=false). page.tsx's routing guards
      //   then read stale flags → redirect back to /onboarding despite
      //   the onboarding having completed on the backend.
      //
      // Fix:
      //   Invalidate the user cache in onSuccess here, inside the mutation.
      //   This makes user cache refresh deterministic: every successful step
      //   submission — regardless of which call site triggered it — causes
      //   React Query to mark ['user','me'] stale and schedule a background
      //   refetch. AppContext's setUser will be called by the refetch result.
      //
      // Duplicate refresh prevention:
      //   invalidateQueries marks stale and schedules ONE refetch per active
      //   observer. If the page also calls refreshUser(), that calls
      //   query.refetch() which deduplicates with the in-flight invalidation
      //   refetch — React Query returns the same in-flight Promise rather than
      //   firing a second request. No duplicate /users/me calls result.
      //
      // Scope: user.me() only — not user.all() — to avoid invalidating any
      // future user-namespace queries unrelated to the onboarding flags.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.user.me(),
      });
    },

    onError: (error) => {
      if (isApiClientError(error)) {
        if (error.isRateLimit) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(
              '[useSubmitStep] Rate limited.',
              `Retry after ${error.retryAfter ?? 'unknown'}s.`,
            );
          }
          return;
        }

        if (error.isTierGate) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[useSubmitStep] Tier gate — user needs upgrade.');
          }
          return;
        }

        if (error.isServerError || error.isNetworkError) {
          if (process.env.NODE_ENV !== 'production') {
            console.error('[useSubmitStep] Server/network error.', error.category);
          }
          return;
        }

        if (error.isValidationError) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[useSubmitStep] Validation error.', error.message);
          }
          return;
        }
      }

      if (process.env.NODE_ENV !== 'production') {
        console.error('[useSubmitStep] Unexpected error type.', error);
      }
    },
  });
}

// Backward-compatible alias — callers importing useSubmitOnboardingStep by
// name from this module will continue to work.
export { useSubmitStep as useSubmitOnboardingStep };