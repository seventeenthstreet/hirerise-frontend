/**
 * @file src/features/onboarding/api/index.ts
 *
 * PHASE 2 — ONBOARDING EXTRACTION: API ownership module.
 *
 * OWNERSHIP PRINCIPLE:
 *   The onboarding feature's API surface is owned here. This module re-exports
 *   the onboardingApi registry from lib/api/endpoints/onboarding so that
 *   features/onboarding/* can import from a stable, domain-local path.
 *
 * WHY RE-EXPORT (NOT MOVE) YET:
 *   lib/api/endpoints/onboarding.ts is a transport-layer file governed by
 *   the V2 API contract and parser governance infrastructure in lib/api/core/.
 *   Moving the implementation here would couple the feature module to transport
 *   internals (apiClient, parser boundaries) — violating the separation of
 *   transport infrastructure from domain ownership.
 *
 *   The correct sequence:
 *     Phase 2 (now):  establish ownership — re-export from transport layer.
 *     Phase 3 (next): once feature boundaries are stable, evaluate whether
 *                     the endpoint function definitions should move here.
 *
 * CONSUMERS:
 *   features/onboarding/mutations/* should import from this module, not
 *   directly from lib/api/endpoints/onboarding.
 *
 * INFRASTRUCTURE PRESERVED:
 *   ✅ V2 parser boundaries (apiClient uses api-parser.ts internally)
 *   ✅ Transport normalization (apiClient in lib/api/client.ts)
 *   ✅ No retry logic changes
 *   ✅ No API contract changes
 */

export { onboardingApi } from '@/lib/api/endpoints/onboarding';

// Re-export types from the feature type source of truth.
// These are the same types — we bridge them here so mutation hooks
// importing from features/onboarding/api get the consolidated types.
export type {
  OnboardingProgressResponse,
  SubmitOnboardingStepResponse,
  CareerReportResponse,
  BaseOnboardingResponse,
  OnboardingStep,
} from '@/features/onboarding/types';
