/**
 * @file src/modules/student-onboarding/hooks/index.ts
 *
 * PUBLIC API SURFACE — Student Onboarding Hooks Module
 * ─────────────────────────────────────────────────────
 * Single barrel export for all consumer-facing hooks and types in the
 * Student Onboarding hooks layer.
 *
 * IMPORT CONTRACT:
 *   All UI components and pages MUST import from this index:
 *
 *     import {
 *       useStudentOnboardingSession,
 *       useEducationProfile,
 *       useSaveEducationProfile,
 *       useUpdateOnboardingStep,
 *       studentOnboardingQueryKeys,
 *     } from '@/modules/student-onboarding/hooks';
 *
 *   DO NOT import directly from individual hook files:
 *
 *     ❌ import { useStudentOnboardingSession }
 *          from '.../hooks/use-student-onboarding-session';
 *
 * ARCHITECTURE POSITION (HireRise Blueprint):
 *   API Layer (@/modules/student-onboarding/api)
 *     ↓
 *   [THIS FILE: hooks barrel — consumable by UI]
 *     ↓
 *   UI / Pages
 *
 * HOOK OVERVIEW:
 *
 *   READ HOOKS (useQuery):
 *   ─────────────────────
 *   useStudentOnboardingSession()
 *     Fetches the session state (currentStep, completedSteps, completionPct).
 *     Returns null safely when no session exists (first-time user).
 *
 *   useEducationProfile()
 *     Fetches the saved education profile (educationLevel, boardType, schoolType).
 *     Returns null safely when Step 1 has not been completed.
 *     Used for form pre-fill when the student navigates back to Step 1.
 *
 *   WRITE HOOKS (useMutation):
 *   ──────────────────────────
 *   useSaveEducationProfile()
 *     Saves (or updates) the education profile AND advances the session.
 *     Invalidates both session + education profile caches on success.
 *     Primary hook for Step 1 (Education) form submission.
 *
 *   useUpdateOnboardingStep()
 *     Advances the session step without saving a profile.
 *     Use for steps that do not have a dedicated profile table.
 *     Invalidates the session cache only.
 *     The `updateAsync` variant enables navigation-aware flows.
 *
 * QUERY KEYS:
 *   studentOnboardingQueryKeys is exported for consumers that need to:
 *     - Manually invalidate the session or profile cache.
 *     - Seed the cache with server-side data (SSR/prefetch scenarios).
 *     - Implement optimistic updates with setQueryData.
 *
 * WHAT IS NOT EXPORTED:
 *   - Internal selector functions (module-level, not part of the public API)
 *   - STALE_TIME and GC_TIME constants (implementation details)
 *   - Raw React Query query/mutation objects (the hooks abstract these)
 *
 * FUTURE ADDITIONS (document before implementing):
 *   - useAcademicsProfile()          ← Step 2
 *   - useSaveAcademicsProfile()      ← Step 2 mutation
 *   - useActivitiesProfile()         ← Step 3
 *   - useSaveActivitiesProfile()     ← Step 3 mutation
 *   - useCognitiveProfile()          ← Step 4
 *   - useSaveCognitiveProfile()      ← Step 4 mutation
 *   - useAspirationProfile()         ← Step 5
 *   - useSaveAspirationProfile()     ← Step 5 mutation
 *   - useOnboardingResult()          ← AI scoring engine result (Phase 3+)
 */

// ─────────────────────────────────────────────────────────────────────────────
// QUERY KEYS — exported for external cache manipulation
// ─────────────────────────────────────────────────────────────────────────────

export {
  studentOnboardingQueryKeys,
} from './query-keys';

export type {
  StudentOnboardingQueryKey,
} from './query-keys';

// ─────────────────────────────────────────────────────────────────────────────
// READ HOOKS
// ─────────────────────────────────────────────────────────────────────────────

export {
  useStudentOnboardingSession,
} from './use-student-onboarding-session';

export type {
  UseStudentOnboardingSessionReturn,
} from './use-student-onboarding-session';

export {
  useEducationProfile,
} from './use-education-profile';

export type {
  UseEducationProfileReturn,
} from './use-education-profile';

// ─────────────────────────────────────────────────────────────────────────────
// WRITE HOOKS (mutations)
// ─────────────────────────────────────────────────────────────────────────────

export {
  useSaveEducationProfile,
} from './use-save-education-profile';

export type {
  UseSaveEducationProfileReturn,
} from './use-save-education-profile';

export {
  useUpdateOnboardingStep,
} from './use-update-onboarding-step';

export type {
  UseUpdateOnboardingStepReturn,
} from './use-update-onboarding-step';