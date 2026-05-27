/**
 * src/hooks/mutations/useOnboardingMutations.ts
 *
 * ONBOARDING MUTATION HOOKS
 * ──────────────────────────
 * Four mutation hooks that cover the complete academic onboarding write path:
 *
 *   useSaveAcademicProfile()   — creates/replaces the student's academic profile
 *   useSaveSubjects()          — saves subject selections (optimistic)
 *   useSaveLanguages()         — saves language selections (optimistic)
 *   useCompleteOnboarding()    — marks onboarding as complete
 *
 * OPTIMISTIC UPDATES:
 *   useSaveSubjects and useSaveLanguages apply optimistic updates to the
 *   full profile cache so the UI reflects changes instantly. On error, the
 *   previous state is rolled back and a telemetry event is emitted.
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
 * Invalidates: studentProfile
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
      if (context?.previousProfile !== undefined) {
        queryClient.setQueryData(
          academicQueryKeys.studentProfile(userId),
          context.previousProfile,
        );
      }
    },

    onSuccess: async () => {
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
 * Invalidates: studentSubjects + studentProfile
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

    onSuccess: async () => {
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
 * Invalidates: studentLanguages + studentProfile
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

    onSuccess: async () => {
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
 * Invalidates: entire onboarding namespace for the user
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

    onSuccess: async () => {
      await invalidate.afterCompleteOnboarding(userId);
    },
  });
}
