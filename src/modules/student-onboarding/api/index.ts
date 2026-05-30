/**
 * @file src/modules/student-onboarding/api/index.ts
 *
 * PUBLIC API SURFACE — Student Onboarding API Module
 * ────────────────────────────────────────────────────
 * Single barrel export for all consumers of the Student Onboarding API layer.
 *
 * IMPORT CONTRACT:
 *   All hooks and module consumers MUST import from this index:
 *
 *     import { studentOnboardingApi, ... } from '@/modules/student-onboarding/api';
 *
 *   DO NOT import directly from individual files:
 *
 *     ❌ import { saveEducationProfile } from '.../student-onboarding.api';
 *     ❌ import { EDUCATION_LEVELS } from '.../student-onboarding.types';
 *
 * WHY A BARREL:
 *   1. Single import path — refactoring internal file names doesn't break consumers.
 *   2. Explicit public surface — types/functions NOT exported here are private.
 *   3. Tree-shaking friendly — bundlers eliminate unused named exports.
 *   4. Mirrors the `features/onboarding/api/index.ts` pattern in this codebase.
 *
 * WHAT IS NOT EXPORTED:
 *   - DbOnboardingSession, DbEducationProfile (raw DB types — internal only)
 *   - normalizeSession, normalizeEducationProfile (internal helpers)
 *   - requireAuthUserId, calculateCompletionPct (internal helpers)
 *   - dbOnboardingSessionRowSchema, dbEducationProfileRowSchema (internal validators)
 *
 * WHAT IS EXPORTED:
 *   - studentOnboardingApi (the API object — primary consumer surface)
 *   - All domain types (hooks need these for React Query generics)
 *   - All enum constants (UI components need these for option lists)
 *   - StudentOnboardingError + isStudentOnboardingError (error handling in hooks)
 *   - Input schema types (useMutation parameter types)
 *   - Schemas for optional external validation use
 */

// ─────────────────────────────────────────────────────────────────────────────
// API OBJECT — primary consumer surface
// ─────────────────────────────────────────────────────────────────────────────

export { studentOnboardingApi } from './student-onboarding.api';

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN TYPES — Tier 2 (normalized, hook-safe)
// ─────────────────────────────────────────────────────────────────────────────

export type {
  OnboardingSession,
  EducationProfile,
} from './student-onboarding.types';

// ─────────────────────────────────────────────────────────────────────────────
// ENUM CONSTANTS — for UI option lists and type guards
// ─────────────────────────────────────────────────────────────────────────────

export {
  EDUCATION_LEVELS,
  BOARD_TYPES,
  SCHOOL_TYPES,
  ONBOARDING_STEPS,
  COMPLETABLE_STEPS,
} from './student-onboarding.types';

export type {
  EducationLevel,
  BoardType,
  SchoolType,
  OnboardingStep,
  CompletableStep,
} from './student-onboarding.types';

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST / RESPONSE MODELS — Tier 3 (hook parameter and return types)
// ─────────────────────────────────────────────────────────────────────────────

export type {
  GetOnboardingSessionResponse,
  CreateOnboardingSessionResponse,
  UpdateOnboardingStepInput,
  UpdateOnboardingStepResponse,
  SaveEducationProfileInput,
  SaveEducationProfileResponse,
  GetEducationProfileResponse,
} from './student-onboarding.types';

// ─────────────────────────────────────────────────────────────────────────────
// ERROR TYPES — for hook-level error handling
// ─────────────────────────────────────────────────────────────────────────────

export {
  StudentOnboardingError,
  StudentOnboardingErrorCode,
  isStudentOnboardingError,
} from './student-onboarding.types';

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMAS — exported for consumers that need runtime validation
// (e.g. form libraries integrating with Zod, unit tests)
// ─────────────────────────────────────────────────────────────────────────────

export {
  saveEducationProfileInputSchema,
  updateOnboardingStepInputSchema,
  educationLevelSchema,
  boardTypeSchema,
  schoolTypeSchema,
  parseOrThrow,
} from './student-onboarding.schemas';

// ─────────────────────────────────────────────────────────────────────────────
// AI / SCORING ENGINE TYPES — forward declarations for Phase 3+
// ─────────────────────────────────────────────────────────────────────────────

export type {
  OnboardingScoringPayload,
} from './student-onboarding.types';