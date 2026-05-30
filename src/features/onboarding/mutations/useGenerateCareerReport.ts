/**
 * @file src/features/onboarding/mutations/useGenerateCareerReport.ts
 *
 * PHASE 2 — MUTATION OWNERSHIP CONSOLIDATION
 *
 * Canonical location for the generate-career-report mutation.
 *
 * OWNERSHIP MOVE:
 *   Previously at: hooks/mutations/useGenerateCareerReport.ts
 *   Now owned by:  features/onboarding/mutations/useGenerateCareerReport.ts
 *
 * COMPATIBILITY:
 *   hooks/mutations/useGenerateCareerReport.ts is kept as a re-export bridge.
 *   All existing consumers continue to import from '@/hooks/mutations'
 *   unchanged.
 *
 * PRESERVED:
 *   ✅ Same API contract via onboardingApi.generateCareerReport
 *   ✅ Invalidates metrics.all() on successful report generation
 *   ✅ Same retry predicate (shouldRetry, maxRetries=1)
 *   ✅ Same retryDelay
 *   ✅ Same structured onError handler (tier_gate, rate_limit, server/network)
 *   ✅ CareerReportResponse type from features/onboarding/types
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { onboardingApi } from '@/features/onboarding/api';
import type { CareerReportResponse } from '@/features/onboarding/types';
import { isApiClientError } from '@/lib/api/core';
import { shouldRetry, retryDelay, queryKeys } from '@/lib/query';

export function useGenerateCareerReport() {
  const queryClient = useQueryClient();

  return useMutation<
    CareerReportResponse,
    Error,
    void
  >({
    mutationFn: () => onboardingApi.generateCareerReport(),

    // maxRetries = 1: career report generation is idempotent (re-triggering
    // re-queues or re-uses an existing job), so one retry on transient error
    // is safe. Aggressive retry of AI generation requests wastes cost budget.
    retry: (failureCount, error) => shouldRetry(failureCount, error, /* maxRetries */ 1),

    retryDelay,

    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.metrics.all(),
      });
    },

    onError: (error) => {
      if (isApiClientError(error)) {
        // Tier gate covers both plan-level and daily AI cost limit restrictions.
        if (error.isTierGate) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(
              '[useGenerateCareerReport] Tier gate or daily AI limit exceeded.',
              error.message,
            );
          }
          return;
        }

        if (error.isRateLimit) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(
              '[useGenerateCareerReport] Rate limited.',
              `Retry after ${error.retryAfter ?? 'unknown'}s.`,
            );
          }
          return;
        }

        if (error.isServerError || error.isNetworkError) {
          if (process.env.NODE_ENV !== 'production') {
            console.error(
              '[useGenerateCareerReport] Server/network error.',
              error.category,
            );
          }
          return;
        }
      }

      if (process.env.NODE_ENV !== 'production') {
        console.error('[useGenerateCareerReport] Unexpected error type.', error);
      }
    },
  });
}