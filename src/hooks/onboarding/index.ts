/**
 * hooks/onboarding/index.ts
 *
 * Barrel export for the onboarding hook layer.
 * Import from '@/hooks/onboarding' for all onboarding hooks.
 */

export { useOnboardingFlow } from './useOnboardingFlow';
export type {
  UseOnboardingFlowOptions,
  UseOnboardingFlowReturn,
  OnboardingFlowStep,
} from './useOnboardingFlow';

export { useOnboardingProgress } from './useOnboardingProgress';
export type {
  UseOnboardingProgressOptions,
  UseOnboardingProgressReturn,
} from './useOnboardingProgress';

export { useOnboardingNavigation } from './useOnboardingNavigation';
export type {
  UseOnboardingNavigationOptions,
  UseOnboardingNavigationReturn,
} from './useOnboardingNavigation';

export { useOnboardingQuota } from './useOnboardingQuota';
export type { UseOnboardingQuotaReturn } from './useOnboardingQuota';

export { useOnboardingDirectionSwitch } from './useOnboardingDirectionSwitch';
export type { UseOnboardingDirectionSwitchReturn } from './useOnboardingDirectionSwitch';