/**
 * front/src/modules/student-onboarding/hooks/use-academics.ts
 *
 * ACADEMIC HOOKS — Phase 3A
 * ──────────────────────────
 * Four modular hooks that isolate every aspect of academic data management.
 *
 * HOOK RESPONSIBILITIES:
 *
 *   useAcademicRecords        → server state: fetch + cache saved academics
 *   useSaveAcademicYear       → mutation: partial-save a single year
 *   useAcademicSignalQuality  → derived: evaluate signal quality from server state
 *   useAcademicProgress       → derived: progress summary for the progress indicator
 *
 * PATTERNS:
 *   • React Query for server state (same queryClient as the rest of onboarding)
 *   • Optimistic updates on partial saves — rolled back on error
 *   • Diagnostics captured on failure paths only
 *   • Session invalidation after every successful save (keeps routing authoritative)
 *
 * HARDENING (Issue 1B):
 *   useSaveAcademicYear.onMutate also cancels ACADEMIC_QUERY_KEYS.session to
 *   prevent a stale session refetch from overwriting optimistic cache state
 *   and causing UI flicker or progression desync during a failed save rollback.
 *
 * IMPORTANT:
 *   Hooks do NOT calculate progression locally.
 *   next_step comes from the POST response — always backend-authoritative.
 */

import { useCallback } from 'react';
import { useAppContext } from '@/context/AppContext';
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';

import { fetchAcademics, saveAcademics } from '../api/academics.api';
import { logOnboardingEvent }            from '@/features/student-onboarding/lib/onboarding-diagnostics';

import type {
  AcademicYearData,
  AcademicSignalQuality,
  AcademicProgressSummary,
  AcademicYearProgress,
  AcademicYearInput,
  SaveAcademicsPayload,
  SaveAcademicsResponse,
  GetAcademicsResponse,
} from '@/features/student-onboarding/lib/academic.types';

import {
  ACADEMIC_YEAR_LABELS,
  ACADEMIC_YEARS_LIST,
} from '@/features/student-onboarding/lib/academic.types';

// ─────────────────────────────────────────────────────────────────────────────
// QUERY KEYS
// Centralized to make invalidation deterministic.
// ─────────────────────────────────────────────────────────────────────────────

export const ACADEMIC_QUERY_KEYS = {
  records: ['student-onboarding', 'academics'] as const,
  session: ['student-onboarding', 'session']   as const,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 1. useAcademicRecords
//    Fetches and caches the student's saved academic history.
// ─────────────────────────────────────────────────────────────────────────────

export interface UseAcademicRecordsReturn {
  years:         Record<string, AcademicYearData>;
  signalQuality: AcademicSignalQuality | null;
  isLoading:     boolean;
  isError:       boolean;
  error:         Error | null;
  refetch:       () => void;
}

export function useAcademicRecords(): UseAcademicRecordsReturn {
  // Auth guard — mirrors useStudentOnboardingSession.
  // Must NOT fire until AppContext has completed its boot sequence and
  // the Supabase session cookie is established. Without this guard the
  // raw fetch() in fetchAcademics sends a cookie-less request and the
  // backend returns 401 (userId: null in server logs).
  const { user, isHydrated } = useAppContext();
  const userId = user?.id ?? null;

  const result: UseQueryResult<GetAcademicsResponse, Error> = useQuery({
    queryKey: ACADEMIC_QUERY_KEYS.records,
    queryFn:  ({ signal }) => fetchAcademics(signal),

    // Only fire once the app has booted and we have a confirmed user identity.
    enabled: isHydrated && userId !== null,

    staleTime: 30_000,

    // Keep previous data while re-fetching — prevents UI flicker on invalidation
    placeholderData: (prev) => prev,

    // Auto-recover when the network/server comes back after being down.
    refetchOnReconnect: true,

    retry: (failureCount, error) => {
      // Never retry auth failures — 401/403 are deterministic, not transient.
      if (error.message.includes('401') || error.message.includes('403')) return false;
      return failureCount < 2;
    },
  });

  return {
    years:         result.data?.academics?.years ?? {},
    signalQuality: result.data?.signal_quality   ?? null,
    isLoading:     result.isLoading,
    isError:       result.isError,
    error:         result.error,
    refetch:       result.refetch,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. useSaveAcademicYear
//    Partial-save or commit-save a single academic year.
//    Supports optimistic updates with rollback on error.
// ─────────────────────────────────────────────────────────────────────────────

export interface SaveAcademicYearVariables {
  academicYear: string;
  yearInput:    AcademicYearInput;
  isPartial:    boolean;
}

export interface UseSaveAcademicYearReturn {
  saveYear:  (vars: SaveAcademicYearVariables) => Promise<SaveAcademicsResponse>;
  isSaving:  boolean;
  saveError: Error | null;
  reset:     () => void;
}

export function useSaveAcademicYear(): UseSaveAcademicYearReturn {
  const queryClient = useQueryClient();

  const mutation: UseMutationResult<
    SaveAcademicsResponse,
    Error,
    SaveAcademicYearVariables
  > = useMutation({
    mutationFn: ({ academicYear, yearInput, isPartial }: SaveAcademicYearVariables) => {
      const payload: SaveAcademicsPayload = {
        years:      { [academicYear]: yearInput },
        is_partial: isPartial,
      };
      return saveAcademics(payload);
    },

    // ── Optimistic update ──────────────────────────────────────────────────
    onMutate: async ({ academicYear, yearInput }) => {
      // Cancel in-flight re-fetches so they don't overwrite the optimistic update
      await queryClient.cancelQueries({ queryKey: ACADEMIC_QUERY_KEYS.records });
      // Also cancel any in-flight session refetch to prevent stale-session
      // flicker during the optimistic update window (Issue 1B)
      await queryClient.cancelQueries({ queryKey: ACADEMIC_QUERY_KEYS.session });

      // Snapshot previous state for rollback
      const previousData = queryClient.getQueryData<GetAcademicsResponse>(
        ACADEMIC_QUERY_KEYS.records,
      );

      // Optimistically update the cache
      queryClient.setQueryData<GetAcademicsResponse>(
        ACADEMIC_QUERY_KEYS.records,
        (old) => {
          if (!old) return old;

          const existingYear    = old.academics.years[academicYear];
          const optimisticYear: AcademicYearData = {
            academic_year:  academicYear as AcademicYearData['academic_year'],
            board_type:     yearInput.board_type,
            is_predicted:   yearInput.is_predicted,
            is_partial:     true,
            subject_count:  yearInput.subjects.length,
            completed_at:   existingYear?.completed_at ?? null,
            subjects:       yearInput.subjects.map((s) => ({
              subject:        s.subject,
              marks_obtained: s.marks_obtained,
              max_marks:      s.max_marks,
              grade:          s.grade,
              percentage:     null,
              source_type:    s.source_type,
              is_predicted:   s.is_predicted,
            })),
          };

          return {
            ...old,
            academics: {
              ...old.academics,
              years: {
                ...old.academics.years,
                [academicYear]: optimisticYear,
              },
            },
          };
        },
      );

      return { previousData };
    },

    // ── Rollback on error ──────────────────────────────────────────────────
    onError: (err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(ACADEMIC_QUERY_KEYS.records, context.previousData);
      }

      logOnboardingEvent({
        event:          'session_fetch_failed',
        severity:       'error',
        timestamp:      new Date().toISOString(),
        onboardingStep: 'academics',
        metadata: {
          errorCategory: 'academic_year_save_failed',
          errorMessage:  err.message,
        },
      });
    },

    // ── Settle: always invalidate so server state wins ─────────────────────
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ACADEMIC_QUERY_KEYS.records });
      queryClient.invalidateQueries({ queryKey: ACADEMIC_QUERY_KEYS.session });
    },
  });

  const saveYear = useCallback(
    (vars: SaveAcademicYearVariables) => mutation.mutateAsync(vars),
    [mutation],
  );

  return {
    saveYear,
    isSaving:  mutation.isPending,
    saveError: mutation.error,
    reset:     mutation.reset,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. useAcademicSignalQuality
//    Derived hook — returns signal quality from cached server state.
//    No additional fetch — reads from the same cache as useAcademicRecords.
// ─────────────────────────────────────────────────────────────────────────────

export interface UseAcademicSignalQualityReturn {
  signalQuality: AcademicSignalQuality | null;
  isSufficient:  boolean;
  isLoading:     boolean;
}

export function useAcademicSignalQuality(): UseAcademicSignalQualityReturn {
  const { user, isHydrated } = useAppContext();
  const result = useQuery({
    queryKey: ACADEMIC_QUERY_KEYS.records,
    queryFn:  ({ signal }) => fetchAcademics(signal),
    enabled:  isHydrated && user?.id != null,
    staleTime: 30_000,
    select:    (data) => data.signal_quality,
  });

  return {
    signalQuality: result.data ?? null,
    isSufficient:  result.data?.is_sufficient ?? false,
    isLoading:     result.isLoading,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. useAcademicProgress
//    Derives the AcademicProgressSummary for the progress indicator UI.
//    Reads from the cache — zero extra requests.
// ─────────────────────────────────────────────────────────────────────────────

export interface UseAcademicProgressReturn {
  progress:  AcademicProgressSummary | null;
  isLoading: boolean;
}

export function useAcademicProgress(): UseAcademicProgressReturn {
  const { user, isHydrated } = useAppContext();
  const result = useQuery({
    queryKey: ACADEMIC_QUERY_KEYS.records,
    queryFn:  ({ signal }) => fetchAcademics(signal),
    enabled:  isHydrated && user?.id != null,
    staleTime: 30_000,
    select:    (data): AcademicProgressSummary => {
      const yearsMap      = data.academics.years;
      const signalQuality = data.signal_quality;

      const yearProgressList: AcademicYearProgress[] = ACADEMIC_YEARS_LIST.map((year) => {
        const saved = yearsMap[year];
        return {
          academic_year: year,
          label:         ACADEMIC_YEAR_LABELS[year],
          subject_count: saved?.subject_count ?? 0,
          is_partial:    saved?.is_partial    ?? true,
          is_complete:   saved != null && !saved.is_partial && saved.subject_count >= 4,
          is_active:     false,
        };
      });

      const totalSubjectsSaved = yearProgressList.reduce(
        (sum, y) => sum + y.subject_count,
        0,
      );

      return {
        years:                yearProgressList,
        total_years_touched:  yearProgressList.filter((y) => y.subject_count > 0).length,
        total_subjects_saved: totalSubjectsSaved,
        signal_quality:       signalQuality,
        can_advance:          signalQuality?.is_sufficient ?? false,
      };
    },
  });

  return {
    progress:  result.data ?? null,
    isLoading: result.isLoading,
  };
}