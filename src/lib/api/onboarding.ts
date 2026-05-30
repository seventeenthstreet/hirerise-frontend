/**
 * @file lib/api/onboarding.ts
 *
 * PHASE 2 — TYPE OWNERSHIP CONSOLIDATION: Compatibility bridge.
 *
 * Types are now owned by: src/features/onboarding/types/index.ts
 *
 * This file is retained for backward compatibility. All imports from
 * '@/lib/api/onboarding' continue to resolve without changes.
 *
 * Migrate new imports to '@/features/onboarding' or '@/features/onboarding/types'.
 *
 * NOTE: The API functions (getOnboardingSteps, submitOnboardingStep) are
 * kept here because some callers may import them from this path. They are
 * NOT bridged to features/onboarding/api — the newer callers should use
 * onboardingApi from '@/lib/api/endpoints/onboarding' or '@/features/onboarding/api'.
 */

export type {
  OnboardingStep,
  OnboardingProgressResponse,
  BaseOnboardingResponse,
  SubmitOnboardingStepResponse,
} from '@/features/onboarding/types';

import { apiRequest } from './core';
import type { OnboardingProgressResponse, SubmitOnboardingStepResponse } from '@/features/onboarding/types';

/**
 * Fetch the current onboarding progress for the authenticated user.
 * @deprecated Prefer onboardingApi.getProgress from '@/lib/api/endpoints/onboarding'
 */
export function getOnboardingSteps(): Promise<OnboardingProgressResponse> {
  return apiRequest<OnboardingProgressResponse>({
    url:    '/api/v1/onboarding/progress',
    method: 'GET',
  });
}

/**
 * Submit data for a specific onboarding step.
 * @deprecated Prefer onboardingApi.submitStep from '@/lib/api/endpoints/onboarding'
 */
export function submitOnboardingStep(
  stepId: string,
  data: Record<string, unknown>,
): Promise<SubmitOnboardingStepResponse> {
  return apiRequest<SubmitOnboardingStepResponse>({
    url:    `/api/v1/onboarding/${stepId}`,
    method: 'POST',
    data,
  });
}
