/**
 * @file src/hooks/mutations/useSubmitOnboardingStep.ts
 * PHASE 2 — Compatibility bridge.
 * Canonical implementation: src/features/onboarding/mutations/useSubmitStep.ts
 */
// TODO(phase3-cleanup): Remove this compatibility bridge once all consumers
// import from the canonical path documented in the @file comment above.

export {
  useSubmitStep as useSubmitOnboardingStep,
} from '@/features/onboarding/mutations/useSubmitStep';
export type {
  SubmitOnboardingStepInput,
} from '@/features/onboarding/mutations/useSubmitStep';