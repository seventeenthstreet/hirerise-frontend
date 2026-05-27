/**
 * components/onboarding/index.ts
 *
 * Barrel export for the onboarding component system.
 *
 * Import from '@/components/onboarding' for shell + step primitives.
 * The original OnboardingSteps component remains at its existing path
 * for backward compatibility.
 */

// Shell system
export {
  OnboardingShell,
  OnboardingHeader,
  OnboardingContent,
  OnboardingErrorBanner,
  OnboardingRestoreNotice,
  OnboardingFooter,
  OnboardingProgress,
} from './shell';

// Step architecture
export {
  StepContainer,
  StepTitle,
  StepDescription,
  StepSection,
  StepActions,
} from './steps';

export type { OnboardingStepDef, OnboardingStepProps } from './steps';