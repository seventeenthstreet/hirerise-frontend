/**
 * @file src/modules/student-onboarding/constants/index.ts
 *
 * Public API for the constants sub-module.
 * All step registry consumers import from here — not directly from onboarding-steps.ts.
 */

export {
  STEP_REGISTRY,
  STUDENT_ONBOARDING_STEPS,
  COMPLETABLE_STEP_ENTRIES,
  resolveStep,
  isKnownStep,
  getStepIndex,
  getProgressPercent,
} from './onboarding-steps';

export type {
  StepRegistryEntry,
  StepRegistryMap,
} from './onboarding-steps';

export type {
  OnboardingStepProps,
} from './step-props';