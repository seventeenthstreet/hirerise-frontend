/**
 * @file src/modules/student-onboarding/domain/enums.ts
 *
 * CANONICAL ONBOARDING ENUMS
 * ──────────────────────────
 * Single source of truth for all student-onboarding enum values.
 *
 * Re-exports from api/student-onboarding.types.ts to establish the
 * domain/ layer as the authoritative import point.
 *
 * Consuming layers (hooks, components, analytics, AI engine):
 *   import { EducationLevel, OnboardingStep, ... } from '@/modules/student-onboarding/domain';
 *
 * @contract Must stay in sync with:
 *   - SQL CHECK constraints (20260518000001_student_onboarding_foundation.sql)
 *   - backend constants/index.js
 *   - student-onboarding.types.ts (source)
 */

export {
  EDUCATION_LEVELS,
  BOARD_TYPES,
  SCHOOL_TYPES,
  ONBOARDING_STEPS,
} from '../api/student-onboarding.types';

export type {
  EducationLevel,
  BoardType,
  SchoolType,
  OnboardingStep,
} from '../api/student-onboarding.types';
