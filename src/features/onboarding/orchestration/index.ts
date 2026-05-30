/**
 * @file src/features/onboarding/orchestration/index.ts
 * @description Public exports for onboarding orchestration.
 */

export {
  resolvePostOnboardingDestination,
  type OnboardingDestination,
  type PostOnboardingUser,
} from './resolvePostOnboardingDestination';

export {
  usePostSubmitNavigation,
  type UsePostSubmitNavigationReturn,
} from './usePostSubmitNavigation';