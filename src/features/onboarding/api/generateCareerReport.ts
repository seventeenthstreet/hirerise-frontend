/**
 * @file src/features/onboarding/api/generateCareerReport.ts
 *
 * TASK 1 — Report Generation Trigger
 *
 * Minimal wrapper around the existing onboardingApi.generateCareerReport()
 * call. Uses the existing apiClient pattern via the onboardingApi registry.
 *
 * No service layers. No abstractions. No React Query. No caching.
 */

import { onboardingApi } from '@/features/onboarding/api';
import type { CareerReportResponse } from '@/features/onboarding/types';

export async function generateCareerReport(): Promise<CareerReportResponse> {
  return onboardingApi.generateCareerReport();
}