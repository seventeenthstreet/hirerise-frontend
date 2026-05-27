/**
 * @file src/features/onboarding/hooks/index.ts
 *
 * PHASE 2 — ONBOARDING EXTRACTION
 *
 * Re-exports all onboarding hooks from their current locations.
 * This establishes the features/onboarding/hooks barrel as the future
 * import path — consumers can begin migrating to '@/features/onboarding/hooks'
 * incrementally.
 *
 * WHY RE-EXPORT (NOT MOVE) YET:
 *   The hooks in hooks/onboarding/* are correct and stable. Moving them
 *   now would require updating all page-level imports simultaneously,
 *   which creates unnecessary regression surface. The ownership extraction
 *   is established via this barrel — physical file moves happen in Phase 3.
 *
 * PRESERVED:
 *   ✅ All hook implementations unchanged
 *   ✅ All hook signatures unchanged
 *   ✅ hooks/onboarding/index.ts remains valid (unchanged)
 */

export {
  useOnboardingFlow,
} from '@/hooks/onboarding/useOnboardingFlow';
export type {
  UseOnboardingFlowOptions,
  UseOnboardingFlowReturn,
  OnboardingFlowStep,
} from '@/hooks/onboarding/useOnboardingFlow';

export {
  useOnboardingProgress,
} from '@/hooks/onboarding/useOnboardingProgress';
export type {
  UseOnboardingProgressOptions,
  UseOnboardingProgressReturn,
} from '@/hooks/onboarding/useOnboardingProgress';

export {
  useOnboardingNavigation,
} from '@/hooks/onboarding/useOnboardingNavigation';
export type {
  UseOnboardingNavigationOptions,
  UseOnboardingNavigationReturn,
} from '@/hooks/onboarding/useOnboardingNavigation';

export {
  useOnboardingQuota,
} from '@/hooks/onboarding/useOnboardingQuota';
export type {
  UseOnboardingQuotaReturn,
} from '@/hooks/onboarding/useOnboardingQuota';
