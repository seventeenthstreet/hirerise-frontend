/**
 * @file src/lib/api/endpoints/onboarding.ts
 *
 * PHASE 2 — TYPE OWNERSHIP CONSOLIDATION: Compatibility bridge.
 *
 * Types are now owned by: src/features/onboarding/types/index.ts
 * This file is retained for backward compatibility.
 *
 * RULES (NON-NEGOTIABLE):
 *  - No try/catch — errors are ApiClientError; they must propagate to React Query.
 *  - No parsing logic — all parsing lives in core/api-parser.ts.
 *  - No business logic, state, or UI concerns.
 */

import { apiClient } from '@/lib/api/client';

export type {
  OnboardingStep,
  OnboardingProgressResponse,
  BaseOnboardingResponse,
  SubmitOnboardingStepResponse,
  CareerReportResponse,
} from '@/features/onboarding/types';

import type {
  OnboardingProgressResponse,
  SubmitOnboardingStepResponse,
  CareerReportResponse,
} from '@/features/onboarding/types';

export const onboardingApi = {
  getProgress: (): Promise<OnboardingProgressResponse> =>
    apiClient<OnboardingProgressResponse>({
      url:    '/api/v1/onboarding/progress',
      method: 'GET',
    }),

  submitStep: (
    stepId: string,
    data: Record<string, unknown>,
  ): Promise<SubmitOnboardingStepResponse> =>
    apiClient<SubmitOnboardingStepResponse>({
      url:    `/api/v1/onboarding/${stepId}`,
      method: 'POST',
      data,
    }),

  generateCareerReport: (): Promise<CareerReportResponse> =>
    apiClient<CareerReportResponse>({
      url:    '/api/v1/onboarding/career-report',
      method: 'POST',
    }),
} as const;