/**
 * @file src/modules/student-onboarding/index.ts
 *
 * PUBLIC API SURFACE — Student Onboarding Module
 * ══════════════════════════════════════════════════
 * Top-level barrel export for the entire student-onboarding module.
 *
 * IMPORT CONTRACT (HireRise Blueprint — API → Hooks → UI → Pages):
 *
 *   Pages and UI components MUST import from this index:
 *
 *     import {
 *       // Step registry
 *       STUDENT_ONBOARDING_STEPS,
 *       STEP_REGISTRY,
 *       resolveStep,
 *       getProgressPercent,
 *       // Renderer
 *       OnboardingStepRenderer,
 *       // Hooks
 *       useStudentOnboardingSession,
 *       useSaveEducationProfile,
 *       useUpdateOnboardingStep,
 *     } from '@/modules/student-onboarding';
 *
 *   DO NOT import directly from sub-modules:
 *     ❌ import { resolveStep } from '.../constants/onboarding-steps';
 *     ❌ import { EducationStep } from '.../steps/education-step';
 *
 * SUB-MODULE OWNERSHIP:
 *   api/         → Supabase calls, DB types, Zod schemas
 *   hooks/       → React Query wrappers over the API layer
 *   constants/   → Step registry, resolver, step props type
 *   components/  → OnboardingStepRenderer (registry → rendered component)
 *   steps/       → Individual step components (loaded lazily via registry)
 *
 * WHAT IS NOT EXPORTED FROM THIS INDEX:
 *   - Individual step components (education-step, academics-step, etc.)
 *     These are loaded lazily by the registry — never imported directly.
 *   - DB-layer types (DbOnboardingSession, DbEducationProfile)
 *   - Internal helper functions
 */

// ─────────────────────────────────────────────────────────────────────────────
// STEP REGISTRY + RESOLVER
// ─────────────────────────────────────────────────────────────────────────────

export {
  STEP_REGISTRY,
  STUDENT_ONBOARDING_STEPS,
  COMPLETABLE_STEP_ENTRIES,
  resolveStep,
  isKnownStep,
  getStepIndex,
  getProgressPercent,
} from './constants';

export type {
  StepRegistryEntry,
  StepRegistryMap,
  OnboardingStepProps,
} from './constants';

// ─────────────────────────────────────────────────────────────────────────────
// RENDERER
// ─────────────────────────────────────────────────────────────────────────────

export {
  OnboardingStepRenderer,
} from './components/onboarding-step-renderer';

export type {
  OnboardingStepRendererProps,
} from './components/onboarding-step-renderer';

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────

export {
  useStudentOnboardingSession,
  useEducationProfile,
  useSaveEducationProfile,
  useUpdateOnboardingStep,
  studentOnboardingQueryKeys,
} from './hooks';

export type {
  UseStudentOnboardingSessionReturn,
  UseEducationProfileReturn,
  UseSaveEducationProfileReturn,
  UseUpdateOnboardingStepReturn,
  StudentOnboardingQueryKey,
} from './hooks';

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN TYPES (API layer — re-exported for page consumption)
// ─────────────────────────────────────────────────────────────────────────────

export type {
  OnboardingStep,
  CompletableStep,
  OnboardingSession,
  EducationProfile,
  EducationLevel,
  BoardType,
  SchoolType,
  SaveEducationProfileInput,
  UpdateOnboardingStepInput,
  StudentOnboardingErrorCode,
} from './api/student-onboarding.types';

export {
  ONBOARDING_STEPS,
  COMPLETABLE_STEPS,
  EDUCATION_LEVELS,
  BOARD_TYPES,
  SCHOOL_TYPES,
  StudentOnboardingError,
  isStudentOnboardingError,
} from './api/student-onboarding.types';