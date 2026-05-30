/**
 * @file src/modules/student-onboarding/domain/constants.ts
 *
 * CANONICAL ONBOARDING CONSTANTS
 * ───────────────────────────────
 * Re-exports the step registry and utility functions as the
 * domain-authoritative import point.
 *
 * Usage:
 *   import { STEP_REGISTRY, resolveStep } from '@/modules/student-onboarding/domain';
 */

export {
  STEP_REGISTRY,
  STUDENT_ONBOARDING_STEPS,
  COMPLETABLE_STEP_ENTRIES,
  resolveStep,
  isKnownStep,
  getStepIndex,
  getProgressPercent,
} from '../constants/onboarding-steps';

export type {
  StepRegistryEntry,
  StepRegistryMap,
} from '../constants/onboarding-steps';
