/**
 * @file src/modules/student-onboarding/hooks/use-update-onboarding-step.ts
 *
 * HOOK: useUpdateOnboardingStep
 * ──────────────────────────────
 * Mutation hook for advancing the onboarding session to the next step.
 *
 * ARCHITECTURE POSITION (HireRise Blueprint):
 *   API (studentOnboardingApi.updateOnboardingStep)
 *     ↓
 *   [THIS FILE: mutation hook, session cache invalidation, UI-safe state]
 *     ↓
 *   UI / Pages (call update() after non-profile steps succeed)
 *
 * WHAT THIS HOOK DOES:
 *   1. Calls studentOnboardingApi.updateOnboardingStep() to advance the session step.
 *   2. Invalidates the session cache on success so the UI reflects the new step.
 *   3. Exposes clean, typed mutation state (isPending, isSuccess, isError, error).
 *   4. Normalizes errors into the consistent StudentOnboardingError shape.
 *
 * WHAT THIS HOOK DOES NOT DO:
 *   ✅  Does NOT invalidate the education profile cache — it only updates session.
 *   ✅  No Supabase logic.
 *   ✅  No navigation — onSuccess callback is the caller's responsibility.
 *   ✅  No form state.
 *
 * RELATIONSHIP TO useSaveEducationProfile:
 *   useSaveEducationProfile wraps saveEducationProfile(), which internally calls
 *   updateOnboardingStep() as part of an atomic two-step operation (profile upsert
 *   + session advance). So for Step 1 (Education), UI should use useSaveEducationProfile
 *   — not useUpdateOnboardingStep directly.
 *
 *   useUpdateOnboardingStep is designed for future steps (Step 2–5) that may NOT
 *   have a separate profile table (e.g. the 'aspiration' step stores data in the
 *   session JSON, not in a dedicated table). These steps need to advance the session
 *   without a profile upsert — hence this standalone mutation hook.
 *
 *   RULE: Only call useUpdateOnboardingStep directly when there is no dedicated
 *   save hook for that step (i.e. the step has no profile table). For Step 1,
 *   always use useSaveEducationProfile.
 *
 * CACHE INVALIDATION FLOW:
 *   updateOnboardingStep() modifies ONE DB row:
 *     - student_onboarding_sessions (current_step, completed_steps, is_complete)
 *
 *   On success, ONE cache key is invalidated:
 *     - studentOnboardingQueryKeys.session(userId)
 *       → causes useStudentOnboardingSession to refetch the advanced session
 *
 *   The education profile cache is NOT touched — this mutation does not
 *   modify student_education_profiles.
 *
 * RETRY STRATEGY:
 *   Mutations are NOT auto-retried (retry: false).
 *
 *   REASONING:
 *     updateOnboardingStep validates step transitions — it rejects regressions
 *     (going backward). If the first attempt PARTIALLY succeeded (session step
 *     advanced in DB but the response didn't return before a timeout), a retry
 *     might try to advance from the already-advanced step, causing a VALIDATION
 *     error on the transition. The UI should surface the error to the user
 *     and let them manually retry — this prevents double-advancement bugs.
 *
 * PROGRESSION INTEGRITY:
 *   The API layer (updateOnboardingStep) enforces step transition validity:
 *   steps can only advance forward. If the mutation receives an INVALID_STEP_TRANSITION
 *   error, it means the caller passed a malformed step pair. This is a programming
 *   error, not a user error — log it and surface the error category 'validation'.
 *
 * FUTURE OPTIMISTIC UPDATE SUPPORT:
 *   This hook is the primary candidate for optimistic step advancement:
 *
 *   1. onMutate: snapshot current session from cache.
 *   2. Compute optimistic session: increment completedSteps, advance currentStep.
 *   3. setQueryData with optimistic session → instant UI transition.
 *   4. onError: roll back to snapshot.
 *   5. onSettled: invalidate for server reconciliation.
 *
 *   The query key (session), data type (OnboardingSession | null), and userId
 *   resolution are already in place. The optimistic session computation would
 *   need a shared pure function (addCompletedStep, advanceStep) extracted from
 *   the API helpers — these can be moved to a shared utility module at that time.
 *
 * AI SCORING ENGINE READINESS:
 *   When the last completable step ('aspiration') completes, the session's
 *   is_complete flag flips to true in the DB. The AI scoring engine listens
 *   for this event via Supabase Realtime or a polling mechanism.
 *
 *   This hook's onSuccess callback exposes `data.session.isComplete` —
 *   callers can check this flag to initiate the scoring pipeline:
 *
 *   update({ completedStep: 'aspiration', nextStep: 'processing' }, {
 *     onSuccess: ({ session }) => {
 *       if (session.isComplete) {
 *         // Navigate to processing page — AI engine picks up the completed session
 *       }
 *     },
 *   });
 */

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '@/context/AppContext';
import { studentOnboardingApi } from '../api';
import {
  StudentOnboardingError,
  isStudentOnboardingError,
  type UpdateOnboardingStepInput,
  type UpdateOnboardingStepResponse,
} from '../api';
import { studentOnboardingQueryKeys } from './query-keys';

// ─────────────────────────────────────────────────────────────────────────────
// RETURN TYPE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * UI-safe state exposed by useUpdateOnboardingStep.
 */
export interface UseUpdateOnboardingStepReturn {
  /**
   * Advances the session to the next step. Does not throw.
   * For async usage (await result + navigate), use `updateAsync`.
   *
   * @param input { completedStep, nextStep }
   */
  update: (input: UpdateOnboardingStepInput) => void;

  /**
   * Async variant — throws on error, returns the updated session on success.
   *
   * Preferred for navigation-aware flows:
   *   const { session } = await updateAsync({ completedStep, nextStep });
   *   if (session.isComplete) router.push('/onboarding/processing');
   *
   * @param input { completedStep, nextStep }
   * @returns { session: OnboardingSession }
   * @throws {StudentOnboardingError}
   */
  updateAsync: (input: UpdateOnboardingStepInput) => Promise<UpdateOnboardingStepResponse>;

  /**
   * The updated session from the last successful step advance, or null.
   * Contains the authoritative currentStep, completedSteps, and isComplete.
   */
  data: UpdateOnboardingStepResponse | null;

  /** True while the step advance is in-flight. */
  isPending: boolean;

  /** True if the last step advance completed successfully. */
  isSuccess: boolean;

  /** True if the last step advance failed (after retries). */
  isError: boolean;

  /**
   * The normalized error, or null if no error.
   * Branch on `errorCategory` for UI decisions.
   */
  error: StudentOnboardingError | null;

  /**
   * Stable error category, or null if no error.
   * 'auth' | 'not_found' | 'validation' | 'conflict' | 'server' | null
   *
   * 'validation' here typically means an invalid step transition
   * (programming error in the caller) — not a user input error.
   */
  errorCategory: StudentOnboardingError['category'] | null;

  /**
   * Resets mutation state. Call before retrying after a failed step advance.
   */
  reset: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Advances the onboarding session step and invalidates the session cache.
 *
 * For Step 1 (Education), use useSaveEducationProfile instead — it combines
 * profile upsert + session advance in one atomic operation.
 *
 * @example
 * // Step 2 (Academics) — no separate profile table:
 * const { update, isPending } = useUpdateOnboardingStep();
 *
 * const handleContinue = () => {
 *   update({ completedStep: 'academics', nextStep: 'activities' });
 * };
 *
 * // Navigation-aware variant:
 * const { updateAsync } = useUpdateOnboardingStep();
 *
 * const handleComplete = async () => {
 *   try {
 *     const { session } = await updateAsync({
 *       completedStep: 'aspiration',
 *       nextStep: 'processing',
 *     });
 *     if (session.isComplete) router.push('/onboarding/processing');
 *   } catch {
 *     // Error surfaced via `error` + `errorCategory`
 *   }
 * };
 */
export function useUpdateOnboardingStep(): UseUpdateOnboardingStepReturn {
  const queryClient  = useQueryClient();
  const { user }     = useAppContext();
  const userId       = user?.id ?? null;

  const mutation = useMutation<
    UpdateOnboardingStepResponse,  // TData — response shape
    StudentOnboardingError,        // TError — normalized error type
    UpdateOnboardingStepInput      // TVariables — input shape
  >({
    mutationFn: (input: UpdateOnboardingStepInput) =>
      studentOnboardingApi.updateOnboardingStep(input),

    // ── Retry: disabled ─────────────────────────────────────────────────
    // See file-level RETRY STRATEGY docblock for the full reasoning.
    // Step transitions are not safely auto-retryable — a double-advance
    // would violate the progression integrity guarantees in the API layer.
    retry: false,

    // ── Cache invalidation on success ────────────────────────────────────
    onSuccess: (_data: UpdateOnboardingStepResponse) => {
      // Invalidate the session cache.
      // The session's currentStep, completedSteps, completionPct, and isComplete
      // have all changed — the cached session is now stale.
      if (userId) {
        void queryClient.invalidateQueries({
          queryKey: studentOnboardingQueryKeys.session(userId),
        });
      } else {
        // Fallback — same reasoning as useSaveEducationProfile.
        void queryClient.invalidateQueries({
          queryKey: studentOnboardingQueryKeys.all(),
        });
      }

      // NOTE: Education profile cache is NOT invalidated here.
      // updateOnboardingStep does not modify student_education_profiles.
      // Only useSaveEducationProfile invalidates the education profile cache.
    },

    // ── Error logging ─────────────────────────────────────────────────────
    onError: (error: StudentOnboardingError) => {
      if (process.env.NODE_ENV !== 'production') {
        if (isStudentOnboardingError(error)) {
          switch (error.category) {
            case 'auth':
              console.warn('[useUpdateOnboardingStep] Auth error — user session may have expired.', {
                code: error.code,
              });
              break;
            case 'validation':
              // Most likely an invalid step transition — this is a caller bug.
              console.error('[useUpdateOnboardingStep] Invalid step transition.', {
                code:    error.code,
                details: error.details,
                message: error.message,
              });
              break;
            case 'not_found':
              // Session not found — the student should restart onboarding.
              console.error('[useUpdateOnboardingStep] Session not found.', {
                code: error.code,
              });
              break;
            case 'server':
              console.error('[useUpdateOnboardingStep] Server error.', {
                code:    error.code,
                details: error.details,
              });
              break;
            default:
              console.error('[useUpdateOnboardingStep] Unexpected error.', {
                category: error.category,
                code:     error.code,
                message:  error.message,
              });
          }
        } else {
          console.error('[useUpdateOnboardingStep] Unexpected error type.', error);
        }
      }
    },
  });

  // ── Normalize error ───────────────────────────────────────────────────────
  const error: StudentOnboardingError | null = isStudentOnboardingError(mutation.error)
    ? mutation.error
    : null;

  const errorCategory = error?.category ?? null;

  return {
    update:        mutation.mutate,
    updateAsync:   mutation.mutateAsync,
    data:          mutation.data ?? null,
    isPending:     mutation.isPending,
    isSuccess:     mutation.isSuccess,
    isError:       mutation.isError,
    error,
    errorCategory,
    reset:         mutation.reset,
  };
}