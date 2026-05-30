/**
 * @file features/student-onboarding/hooks/index.ts
 *
 * Phase 2 orchestration hooks barrel export.
 *
 * These hooks COMPLEMENT (not replace) the existing module hooks in
 * @/modules/student-onboarding/hooks. They add:
 *   - Flow orchestration (useStudentOnboardingFlow)
 *   - Resume detection (useResumeOnboarding)
 *
 * The base hooks (session, mutations, education profile) remain in the module.
 * This feature layer re-exports them alongside the new orchestration hooks.
 */

// ── New Phase 2 orchestration hooks ──────────────────────────────────────────
export {
  useStudentOnboardingFlow,
  isStepImplemented,
  PHASE2_UNIMPLEMENTED_STEPS,
} from './use-student-onboarding-flow';

export type {
  UseStudentOnboardingFlowReturn,
} from './use-student-onboarding-flow';

export {
  useResumeOnboarding,
} from './use-resume-onboarding';

export type {
  UseResumeOnboardingReturn,
} from './use-resume-onboarding';

// ── Re-exports from module layer (single import surface for feature consumers) ──
export {
  useStudentOnboardingSession,
  useEducationProfile,
  useSaveEducationProfile,
  useUpdateOnboardingStep,
  studentOnboardingQueryKeys,
} from '@/modules/student-onboarding/hooks';

export type {
  UseStudentOnboardingSessionReturn,
  UseEducationProfileReturn,
  UseSaveEducationProfileReturn,
  UseUpdateOnboardingStepReturn,
  StudentOnboardingQueryKey,
} from '@/modules/student-onboarding/hooks';
