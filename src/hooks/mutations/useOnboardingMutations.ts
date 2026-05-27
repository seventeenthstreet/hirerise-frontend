/**
 * src/hooks/mutations/useOnboardingMutations.ts
 *
 * ONBOARDING MUTATION HOOKS (HARDENED — Phase 3 Verification Pass)
 * ─────────────────────────────────────────────────────────────────
 * Four mutation hooks that cover the complete academic onboarding write path:
 *
 *   useSaveAcademicProfile()   — creates/replaces the student's academic profile
 *   useSaveSubjects()          — saves subject selections (optimistic)
 *   useSaveLanguages()         — saves language selections (optimistic)
 *   useCompleteOnboarding()    — marks onboarding as complete
 *
 * CHANGES FROM ORIGINAL (OP-01):
 *  Invalidation moved from `onSuccess` to `onSettled` in ALL four mutations.
 *
 *  RATIONALE:
 *  `onSuccess` does not fire if:
 *    (a) The server committed but the network dropped during response delivery
 *        — the mutationFn throws and `onError` fires instead.
 *    (b) The mutationFn receives an error response envelope.
 *  In both cases the server may have written the data. Without invalidation
 *  the optimistic cache state persists indefinitely and never re-syncs.
 *
 *  `onSettled` fires after BOTH success AND error. Invalidating on error is:
 *    - Safe: it triggers a background refetch that resolves true server state
 *    - Cheap: React Query deduplicates the refetch if one is already in-flight
 *    - Correct: it collapses any partial-success divergence
 *
 *  The `data` parameter of `onSettled` carries the mutation result on success
 *  (same as `onSuccess`'s `data`) and is `undefined` on error. The `error`
 *  parameter carries the failure on error and is `null` on success.
 *
 * OPTIMISTIC UPDATES:
 *   useSaveSubjects and useSaveLanguages apply optimistic updates to the
 *   full profile cache so the UI reflects changes instantly. On error the
 *   previous state is rolled back in `onError` and then `onSettled` triggers
 *   a clean server re-fetch.
 *
 * INVALIDATION:
 *   All mutations delegate invalidation to createAcademicInvalidationService.
 *   No mutation calls queryClient.invalidateQueries directly.
 *
 * TELEMETRY:
 *   Funnel events are emitted on mutate start, success, and error.
 *
 * ARCHITECTURE POSITION:
 *   API layer → [THIS FILE] → onboarding step components
 */

'use client';

import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import {
  createAcademicProfile,
  saveStudentSubjects,
  saveStudentLanguages,
  completeAcademicOnboarding,
} from '../../api/academicOnboardingApi';
import { academicQueryKeys }                     from '../queryKeys/academicQueryKeys';
import { unwrapOrThrow }                          from '../utils/rpcExecutor';
import { createAcademicInvalidationService }      from '../invalidation/academicInvalidationService';
import { academicTelemetry }                      from '../../telemetry/academicTelemetry';
import { generateCorrelationId }                  from '../types/rpcEnvelope.types';

import type {
  CreateAcademicProfilePayload,
  CreateAcademicProfileResult,
  SaveSubjectsPayload,
  SaveSubjectsResult,
  SaveLanguagesPayload,
  SaveLanguagesResult,
  CompleteOnboardingResult,
  StudentFullProfile,
  StudentSubjectEntry,
  StudentLanguageEntry,
  OptimisticSubjectContext,
  OptimisticLanguageContext,
  OptimisticProfileContext,
} from '../types/onboarding.types';

// ─────────────────────────────────────────────────────────────────────────────
// useSaveAcademicProfile
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates or replaces the student's academic profile.
 * Replay-safe — safe to call multiple times with the same payload.
 *
 * Invalidates: studentProfile (in onSettled — fires on success AND error)
 *
 * @param userId  Supabase Auth UID — needed for targeted cache invalidation.
 *
 * @example
 *   const { mutate, isPending } = useSaveAcademicProfile(userId);
 *   mutate({ country_code: 'IN', region_code: 'MH', ... });
 */
export function useSaveAcademicProfile(
  userId: string,
): UseMutationResult<
  CreateAcademicProfileResult,
  Error,
  CreateAcademicProfilePayload,
  OptimisticProfileContext
> {
  const queryClient = useQueryClient();
  const invalidate  = createAcademicInvalidationService(queryClient);

  return useMutation({
    mutationFn: async (payload: CreateAcademicProfilePayload) => {
      const correlationId = generateCorrelationId();
      academicTelemetry.onboarding(
        'academic.onboarding.profile_create.start',
        correlationId,
        { classLevel: payload.class_level },
      );
      const res = await createAcademicProfile(payload);
      const data = unwrapOrThrow(res);
      academicTelemetry.onboarding(
        'academic.onboarding.profile_create.success',
        correlationId,
        { wasReplay: data.was_replay },
      );
      return data;
    },

    onMutate: async (): Promise<OptimisticProfileContext> => {
      // Cancel any in-flight profile refetch to avoid overwrite race
      await queryClient.cancelQueries({
        queryKey: academicQueryKeys.studentProfile(userId),
      });
      const previousProfile = queryClient.getQueryData<StudentFullProfile>(
        academicQueryKeys.studentProfile(userId),
      );
      return { previousProfile };
    },

    onError: (_error, _variables, context) => {
      const correlationId = generateCorrelationId();
      academicTelemetry.onboarding(
        'academic.onboarding.profile_create.error',
        correlationId,
      );
      // Rollback snapshot — restore previous profile
      if (context?.previousProfile !== undefined) {
        queryClient.setQueryData(
          academicQueryKeys.studentProfile(userId),
          context.previousProfile,
        );
      }
    },

    // OP-01 FIX: invalidate in onSettled (fires on BOTH success AND error)
    // so partial-success scenarios (server wrote, client received error) are
    // resolved by a clean refetch.
    onSettled: async () => {
      await invalidate.afterCreateProfile(userId);
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useSaveSubjects
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Saves subject selections for the authenticated student.
 * Applies an optimistic update so the UI reflects the new selections
 * before the server confirms.
 *
 * Invalidates: studentSubjects + studentProfile (in onSettled)
 *
 * @param userId    Supabase Auth UID.
 * @param subjects  Full list of available subjects (needed to build optimistic state).
 */
export function useSaveSubjects(
  userId:   string,
  subjects: StudentSubjectEntry[],
): UseMutationResult<
  SaveSubjectsResult,
  Error,
  SaveSubjectsPayload,
  OptimisticSubjectContext
> {
  const queryClient = useQueryClient();
  const invalidate  = createAcademicInvalidationService(queryClient);

  return useMutation({
    mutationFn: async (payload: SaveSubjectsPayload) => {
      const correlationId = generateCorrelationId();
      academicTelemetry.onboarding(
        'academic.onboarding.subjects_save.start',
        correlationId,
        { count: payload.subject_ids.length },
      );
      const res = await saveStudentSubjects(payload);
      const data = unwrapOrThrow(res);
      academicTelemetry.onboarding(
        'academic.onboarding.subjects_save.success',
        correlationId,
        { savedCount: data.saved_count },
      );
      return data;
    },

    onMutate: async (payload: SaveSubjectsPayload): Promise<OptimisticSubjectContext> => {
      await queryClient.cancelQueries({
        queryKey: academicQueryKeys.studentProfile(userId),
      });
      await queryClient.cancelQueries({
        queryKey: academicQueryKeys.studentSubjects(userId),
      });

      const previousSubjects = queryClient.getQueryData<StudentSubjectEntry[]>(
        academicQueryKeys.studentSubjects(userId),
      );
      const previousProfile = queryClient.getQueryData<StudentFullProfile>(
        academicQueryKeys.studentProfile(userId),
      );

      // Build optimistic subject list from full subjects array
      const optimisticSubjects: StudentSubjectEntry[] = subjects.map((s) => ({
        ...s,
        is_selected: payload.subject_ids.includes(s.subject_id),
      }));

      queryClient.setQueryData(
        academicQueryKeys.studentSubjects(userId),
        optimisticSubjects,
      );

      // Patch the full profile aggregate
      if (previousProfile) {
        queryClient.setQueryData<StudentFullProfile>(
          academicQueryKeys.studentProfile(userId),
          { ...previousProfile, subjects: optimisticSubjects },
        );
      }

      return { previousSubjects, previousProfile };
    },

    onError: (_error, _variables, context) => {
      const correlationId = generateCorrelationId();
      academicTelemetry.optimisticRollback(
        'onboarding:subjects',
        'useSaveSubjects',
        correlationId,
      );
      academicTelemetry.onboarding(
        'academic.onboarding.subjects_save.error',
        correlationId,
      );
      // Rollback optimistic state — restore pre-mutation snapshots
      if (context?.previousSubjects !== undefined) {
        queryClient.setQueryData(
          academicQueryKeys.studentSubjects(userId),
          context.previousSubjects,
        );
      }
      if (context?.previousProfile !== undefined) {
        queryClient.setQueryData(
          academicQueryKeys.studentProfile(userId),
          context.previousProfile,
        );
      }
    },

    // OP-01 FIX: onSettled fires after BOTH success AND error.
    // After onError rolls back the optimistic state, onSettled immediately
    // triggers a server refetch — resolving any server-side partial writes.
    onSettled: async () => {
      await invalidate.afterSaveSubjects(userId);
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useSaveLanguages
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Saves language selections (medium of instruction + additional languages).
 * Applies an optimistic update to the full profile cache.
 *
 * Invalidates: studentLanguages + studentProfile (in onSettled)
 *
 * @param userId     Supabase Auth UID.
 * @param languages  Full list of available languages (for optimistic state).
 */
export function useSaveLanguages(
  userId:    string,
  languages: StudentLanguageEntry[],
): UseMutationResult<
  SaveLanguagesResult,
  Error,
  SaveLanguagesPayload,
  OptimisticLanguageContext
> {
  const queryClient = useQueryClient();
  const invalidate  = createAcademicInvalidationService(queryClient);

  return useMutation({
    mutationFn: async (payload: SaveLanguagesPayload) => {
      const correlationId = generateCorrelationId();
      academicTelemetry.onboarding(
        'academic.onboarding.languages_save.start',
        correlationId,
        {
          mediumCount:     payload.medium_language_ids.length,
          additionalCount: payload.additional_language_ids.length,
        },
      );
      const res = await saveStudentLanguages(payload);
      const data = unwrapOrThrow(res);
      academicTelemetry.onboarding(
        'academic.onboarding.languages_save.success',
        correlationId,
        { savedCount: data.saved_count },
      );
      return data;
    },

    onMutate: async (payload: SaveLanguagesPayload): Promise<OptimisticLanguageContext> => {
      await queryClient.cancelQueries({
        queryKey: academicQueryKeys.studentProfile(userId),
      });
      await queryClient.cancelQueries({
        queryKey: academicQueryKeys.studentLanguages(userId),
      });

      const previousLanguages = queryClient.getQueryData<StudentLanguageEntry[]>(
        academicQueryKeys.studentLanguages(userId),
      );
      const previousProfile = queryClient.getQueryData<StudentFullProfile>(
        academicQueryKeys.studentProfile(userId),
      );

      // Build optimistic language list
      const optimisticLanguages: StudentLanguageEntry[] = languages.map((l) => ({
        ...l,
        is_medium_of_instruction: payload.medium_language_ids.includes(l.language_id),
        is_additional:             payload.additional_language_ids.includes(l.language_id),
      }));

      queryClient.setQueryData(
        academicQueryKeys.studentLanguages(userId),
        optimisticLanguages,
      );

      if (previousProfile) {
        queryClient.setQueryData<StudentFullProfile>(
          academicQueryKeys.studentProfile(userId),
          { ...previousProfile, languages: optimisticLanguages },
        );
      }

      return { previousLanguages, previousProfile };
    },

    onError: (_error, _variables, context) => {
      const correlationId = generateCorrelationId();
      academicTelemetry.optimisticRollback(
        'onboarding:languages',
        'useSaveLanguages',
        correlationId,
      );
      academicTelemetry.onboarding(
        'academic.onboarding.languages_save.error',
        correlationId,
      );
      if (context?.previousLanguages !== undefined) {
        queryClient.setQueryData(
          academicQueryKeys.studentLanguages(userId),
          context.previousLanguages,
        );
      }
      if (context?.previousProfile !== undefined) {
        queryClient.setQueryData(
          academicQueryKeys.studentProfile(userId),
          context.previousProfile,
        );
      }
    },

    // OP-01 FIX: onSettled
    onSettled: async () => {
      await invalidate.afterSaveLanguages(userId);
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useCompleteOnboarding
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Marks the academic onboarding as complete.
 * Replay-safe — if already completed, the backend returns `was_replay: true`.
 *
 * Invalidates: entire onboarding namespace for the user (in onSettled)
 *
 * @param userId  Supabase Auth UID.
 */
export function useCompleteOnboarding(
  userId: string,
): UseMutationResult<CompleteOnboardingResult, Error, void, void> {
  const queryClient = useQueryClient();
  const invalidate  = createAcademicInvalidationService(queryClient);

  return useMutation({
    mutationFn: async () => {
      const correlationId = generateCorrelationId();
      academicTelemetry.onboarding(
        'academic.onboarding.complete.start',
        correlationId,
      );
      const res = await completeAcademicOnboarding();
      const data = unwrapOrThrow(res);
      academicTelemetry.onboarding(
        'academic.onboarding.complete.success',
        correlationId,
        { wasReplay: data.was_replay },
      );
      return data;
    },

    onError: () => {
      const correlationId = generateCorrelationId();
      academicTelemetry.onboarding(
        'academic.onboarding.complete.error',
        correlationId,
      );
    },

    // OP-01 FIX: onSettled
    onSettled: async () => {
      await invalidate.afterCompleteOnboarding(userId);
    },
  });
}
