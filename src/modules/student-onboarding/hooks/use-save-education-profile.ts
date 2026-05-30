/**
 * @file src/modules/student-onboarding/hooks/use-save-education-profile.ts
 *
 * HOOK: useSaveEducationProfile
 * ──────────────────────────────
 * Mutation hook for saving (or updating) the student's education profile (Step 1).
 *
 * ARCHITECTURE POSITION (HireRise Blueprint):
 *   API (studentOnboardingApi.saveEducationProfile)
 *     ↓
 *   [THIS FILE: mutation hook, cache invalidation, UI-safe mutation state]
 *     ↓
 *   UI / Pages (call mutate(), read isPending, isSuccess, isError)
 *
 * WHAT THIS HOOK DOES:
 *   1. Calls studentOnboardingApi.saveEducationProfile() — which atomically:
 *        a. Upserts the education profile row in Supabase.
 *        b. Advances the session step from 'education' → 'academics'.
 *        c. Returns both the updated profile and the updated session.
 *   2. On success, invalidates BOTH the session and education profile caches.
 *   3. Exposes clean, typed mutation state to the UI.
 *   4. Normalizes errors via isStudentOnboardingError for consistent UI branching.
 *
 * WHAT THIS HOOK DOES NOT DO:
 *   ✅  No Supabase logic.
 *   ✅  No navigation logic — onSuccess callback is provided by the caller.
 *   ✅  No UI components.
 *   ✅  No form state — form libraries call mutate() from their own submit handlers.
 *
 * CACHE INVALIDATION FLOW:
 *   saveEducationProfile() is an atomic API operation that modifies TWO DB rows:
 *     1. student_education_profiles (upsert)
 *     2. student_onboarding_sessions (current_step + completed_steps update)
 *
 *   Therefore on success, we invalidate TWO cache keys:
 *     - studentOnboardingQueryKeys.educationProfile(userId)
 *       → causes useEducationProfile to refetch the saved profile
 *     - studentOnboardingQueryKeys.session(userId)
 *       → causes useStudentOnboardingSession to refetch the advanced session
 *
 *   WHY NOT OPTIMISTICALLY UPDATE:
 *     The API returns the authoritative new state (profile + session) in the
 *     mutation response. Optimistic updates are deferred to a future phase
 *     when form submission latency becomes a UX concern. The architecture
 *     supports optimistic updates — see the FUTURE OPTIMISTIC UPDATE SUPPORT
 *     section below.
 *
 * RETRY STRATEGY:
 *   Mutations are NOT auto-retried (retry: false) because:
 *     - saveEducationProfile is effectively idempotent (upsert), but
 *     - updateOnboardingStep (called inside it) is NOT fully idempotent under
 *       concurrent calls. Retrying the full mutation risks a duplicate step
 *       advance if the first attempt partially succeeded on the DB.
 *     - The UI exposes the error to the user who can manually retry via
 *       the form submit button — this is safer than silent auto-retry.
 *
 * ERROR HANDLING:
 *   Errors are surfaced via `error` and `errorCategory` on the return value.
 *   The `onError` callback logs in development and provides a structured
 *   extension point for future analytics/observability integration.
 *
 *   UI branching guide:
 *     'auth'       → session expired — redirect to login
 *     'validation' → invalid form data — show field errors
 *     'server'     → Supabase error — show generic retry toast
 *     'not_found'  → session not found — should not occur if session was created
 *
 * FUTURE OPTIMISTIC UPDATE SUPPORT:
 *   The mutation return value (SaveEducationProfileResponse) contains
 *   both `profile` and `session` — the exact shapes used by the two
 *   dependent query caches. To add optimistic updates:
 *
 *   1. Add `onMutate` to snapshot the current cache:
 *      const previousSession = queryClient.getQueryData<OnboardingSession | null>(
 *        studentOnboardingQueryKeys.session(userId),
 *      );
 *
 *   2. Compute and apply the optimistic state:
 *      queryClient.setQueryData<OnboardingSession | null>(
 *        studentOnboardingQueryKeys.session(userId),
 *        optimisticSession,
 *      );
 *
 *   3. Add `onError` rollback:
 *      queryClient.setQueryData(studentOnboardingQueryKeys.session(userId), previousSession);
 *
 *   4. Keep `onSettled` for unconditional invalidation (server reconciliation).
 *
 *   The type signatures, userId resolution, and query key structure
 *   are all in place — no structural refactor needed to enable this.
 *
 * IDEMPOTENCY NOTE:
 *   saveEducationProfile() is safe to call multiple times (user editing Step 1).
 *   Each call overwrites the profile and re-advances the session idempotently.
 *   Calling it while the session is already at 'academics' or beyond will
 *   validate correctly: addCompletedStep() is idempotent (no duplicate step entries).
 */



import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '@/context/AppContext';
import { studentOnboardingApi } from '../api';
import {
  StudentOnboardingError,
  isStudentOnboardingError,
  type SaveEducationProfileInput,
  type SaveEducationProfileResponse,
} from '../api';
import { studentOnboardingQueryKeys } from './query-keys';

// ─────────────────────────────────────────────────────────────────────────────
// RETURN TYPE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * UI-safe state exposed by useSaveEducationProfile.
 *
 * The mutation function is `save` (not `mutate`) to match the module's
 * domain language — "save education profile" vs generic "mutate".
 */
export interface UseSaveEducationProfileReturn {
  /**
   * Initiates the save. Does not throw — errors are surfaced via `error`.
   * For async usage with try/catch, use `saveAsync` instead.
   *
   * @param input  Education profile form data — validated by Zod in the API layer.
   */
  save: (input: SaveEducationProfileInput) => void;

  /**
   * Async variant — throws on error. Use when the caller needs to await
   * the result (e.g. to trigger navigation after a successful save).
   *
   * @param input  Education profile form data.
   * @returns The full response (profile + session + nextStep).
   * @throws {StudentOnboardingError} On validation, auth, or server failure.
   */
  saveAsync: (input: SaveEducationProfileInput) => Promise<SaveEducationProfileResponse>;

  /**
   * The full mutation response from the last successful save.
   * Contains: { profile, session, nextStep }.
   * null when no save has completed successfully.
   */
  data: SaveEducationProfileResponse | null;

  /**
   * True while the save request is in-flight.
   * Use to disable the submit button and show a loading indicator.
   */
  isPending: boolean;

  /** True if the last save completed successfully. */
  isSuccess: boolean;

  /** True if the last save failed (after retries). */
  isError: boolean;

  /**
   * The normalized error from the last failed save, or null.
   * Always StudentOnboardingError — branch on `errorCategory`.
   */
  error: StudentOnboardingError | null;

  /**
   * Stable error category string, or null if no error.
   * 'auth' | 'not_found' | 'validation' | 'conflict' | 'server' | null
   */
  errorCategory: StudentOnboardingError['category'] | null;

  /**
   * Resets the mutation state (clears isSuccess, isError, error, data).
   * Call before re-submitting a corrected form to avoid stale error states.
   */
  reset: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Saves (or updates) the student's education profile and advances the session.
 *
 * Invalidates both the session and education profile caches on success.
 *
 * @example
 * const { save, isPending, isError, error } = useSaveEducationProfile();
 *
 * const handleSubmit = (formData: SaveEducationProfileInput) => {
 *   save(formData);
 * };
 *
 * // OR for navigation-aware flows:
 * const handleSubmit = async (formData: SaveEducationProfileInput) => {
 *   try {
 *     const { nextStep } = await saveAsync(formData);
 *     router.push(`/onboarding/${nextStep}`);
 *   } catch (err) {
 *     // Error already surfaced via `error` — log only if needed
 *   }
 * };
 */
export function useSaveEducationProfile(): UseSaveEducationProfileReturn {
  const queryClient       = useQueryClient();
  const { user }          = useAppContext();
  const userId            = user?.id ?? null;

  const mutation = useMutation<
    SaveEducationProfileResponse,  // TData — response shape
    StudentOnboardingError,        // TError — normalized error type
    SaveEducationProfileInput      // TVariables — input shape
  >({
    mutationFn: (input: SaveEducationProfileInput) =>
      studentOnboardingApi.saveEducationProfile(input),

    // ── Retry: disabled ─────────────────────────────────────────────────
    // See file-level RETRY STRATEGY docblock for the full reasoning.
    // saveEducationProfile is effectively idempotent, but the internal
    // updateOnboardingStep is not safe for silent auto-retry.
    retry: false,

    // ── Cache invalidation on success ────────────────────────────────────
    onSuccess: (_data: SaveEducationProfileResponse) => {
      // Invalidate the education profile cache.
      // The API upserted a new profile row — the cached profile is now stale.
      if (userId) {
        void queryClient.invalidateQueries({
          queryKey: studentOnboardingQueryKeys.educationProfile(userId),
        });

        // Invalidate the session cache.
        // saveEducationProfile advanced the session step (education → academics).
        // The cached session's currentStep and completedSteps are now stale.
        void queryClient.invalidateQueries({
          queryKey: studentOnboardingQueryKeys.session(userId),
        });
      } else {
        // Fallback: invalidate the root key if userId is somehow not available.
        // This should not occur in practice (mutation is gated by auth in the API),
        // but guards against race conditions where user context flips during a save.
        void queryClient.invalidateQueries({
          queryKey: studentOnboardingQueryKeys.all(),
        });
      }
    },

    // ── Error logging ─────────────────────────────────────────────────────
    onError: (error: unknown) => {
      if (process.env.NODE_ENV !== 'production') {
        // Always log the raw error first — guaranteed visible in DevTools
        // regardless of class-instance lazy-evaluation quirks.
        console.error(
          '[useSaveEducationProfile] Raw error:',
          error instanceof Error
            ? `${error.name}: ${error.message}`
            : String(error),
        );

        if (isStudentOnboardingError(error)) {
          // JSON.stringify forces immediate serialisation — avoids the Chrome
          // DevTools collapsed-object {} display bug on class instances.
          const errSnapshot = JSON.stringify({
            category: error.category,
            code:     error.code,
            message:  error.message,
            details:  error.details,
          });
          switch (error.category) {
            case 'auth':
              console.warn('[useSaveEducationProfile] Auth error — user session may have expired.', errSnapshot);
              break;
            case 'validation':
              console.warn('[useSaveEducationProfile] Validation error — form data rejected.', errSnapshot);
              break;
            case 'server':
              console.error('[useSaveEducationProfile] Server error — Supabase operation failed.', errSnapshot);
              break;
            case 'not_found':
              console.error('[useSaveEducationProfile] Session not found — user may need to restart.', errSnapshot);
              break;
            case 'conflict':
              console.error('[useSaveEducationProfile] Conflict — duplicate session or concurrent write.', errSnapshot);
              break;
            default:
              console.error('[useSaveEducationProfile] StudentOnboardingError with unrecognised category.', errSnapshot);
          }
        } else {
          // Non-StudentOnboardingError — log raw for diagnosis.
          // This path fires when a plain Error, ZodError, or network error
          // escapes normalisation in the API layer.
          const raw = error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : error;
          console.error('[useSaveEducationProfile] Unexpected error type (not StudentOnboardingError).', raw);
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
    save:          mutation.mutate,
    saveAsync:     mutation.mutateAsync,
    data:          mutation.data ?? null,
    isPending:     mutation.isPending,
    isSuccess:     mutation.isSuccess,
    isError:       mutation.isError,
    error,
    errorCategory,
    reset:         mutation.reset,
  };
}