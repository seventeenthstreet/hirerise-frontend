/**
 * @file front/src/modules/student-onboarding/intelligence/hooks/use-intelligence.ts
 *
 * Phase 3D — Cross-Domain Intelligence Layer
 * INTELLIGENCE DIAGNOSTIC HOOKS
 *
 * PURPOSE:
 *   React Query hooks for admin/diagnostic intelligence endpoints.
 *   All hooks are ADMIN-ONLY — never render in student-facing components.
 *
 * ARCHITECTURE:
 *   - Uses React Query v5 (useQuery / useMutation).
 *   - Query keys are namespaced under ['intelligence'] to avoid collision
 *     with student-facing onboarding query keys.
 *   - All hooks are disabled by default if no userId/signalKey is provided.
 *   - Mutations (triggerPipeline) include optimistic update stubs for
 *     future counselor tooling compatibility.
 *
 * DO NOT:
 *   - Use these hooks in student-facing pages or components.
 *   - Expose signalWeights in student-visible UI.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import {
  getSignalRegistry,
  getStudentVector,
  getStudentConfidence,
  getSignalEvidence,
  triggerPipeline,
} from '../api/intelligence.api';
import type {
  SignalRegistryEntry,
  StudentSignalVector,
  SignalConfidenceModel,
  SignalEvidenceRecord,
  TriggerPipelineInput,
  TriggerPipelineResponse,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// QUERY KEYS
// Namespaced under 'intelligence' — never collides with onboarding keys.
// ─────────────────────────────────────────────────────────────────────────────

export const intelligenceKeys = {
  all:              ['intelligence']                                                  as const,
  registry:         ['intelligence', 'registry']                                     as const,
  studentVector:    (userId: string) => ['intelligence', 'vector',     userId]       as const,
  studentConfidence:(userId: string) => ['intelligence', 'confidence', userId]       as const,
  signalEvidence:   (userId: string, signalKey: string) =>
                      ['intelligence', 'evidence', userId, signalKey]                as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// useSignalRegistry
// Fetches the full active signal registry.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the full active signal registry.
 *
 * @example
 * const { data: registry, isLoading } = useSignalRegistry();
 */
export function useSignalRegistry(): UseQueryResult<SignalRegistryEntry[]> {
  return useQuery({
    queryKey:  intelligenceKeys.registry,
    queryFn:   getSignalRegistry,
    staleTime: 10 * 60 * 1000, // 10 minutes — registry changes rarely
    gcTime:    30 * 60 * 1000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useStudentVector
// Fetches the current aggregated signal vector for a student.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the current signal vector for a student.
 * Returns null if no vector has been computed yet.
 *
 * @param userId  — Supabase Auth UID (admin viewing a student)
 *
 * @example
 * const { data: vector } = useStudentVector(userId);
 * if (!vector) return <p>No intelligence vector yet.</p>;
 */
export function useStudentVector(
  userId: string | null | undefined,
): UseQueryResult<StudentSignalVector | null> {
  return useQuery({
    queryKey:  intelligenceKeys.studentVector(userId ?? ''),
    queryFn:   () => getStudentVector(userId!),
    enabled:   !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes — vectors update after pipeline runs
    gcTime:    10 * 60 * 1000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useStudentConfidence
// Fetches confidence models for all signals for a student.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns confidence models for all signals for a student.
 *
 * @param userId  — Supabase Auth UID
 *
 * @example
 * const { data: models } = useStudentConfidence(userId);
 */
export function useStudentConfidence(
  userId: string | null | undefined,
): UseQueryResult<SignalConfidenceModel[]> {
  return useQuery({
    queryKey:  intelligenceKeys.studentConfidence(userId ?? ''),
    queryFn:   () => getStudentConfidence(userId!),
    enabled:   !!userId,
    staleTime: 2 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useSignalEvidence
// Fetches evidence records for a specific signal for a student.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns evidence records for a specific signal for a student.
 *
 * @param userId     — Supabase Auth UID
 * @param signalKey  — canonical signal key
 *
 * @example
 * const { data: evidence } = useSignalEvidence(userId, 'systems_thinking');
 */
export function useSignalEvidence(
  userId:    string | null | undefined,
  signalKey: string | null | undefined,
): UseQueryResult<SignalEvidenceRecord[]> {
  return useQuery({
    queryKey:  intelligenceKeys.signalEvidence(userId ?? '', signalKey ?? ''),
    queryFn:   () => getSignalEvidence(userId!, signalKey!),
    enabled:   !!userId && !!signalKey,
    staleTime: 2 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useTriggerPipeline
// Triggers the aggregation pipeline for a student.
// Admin only. dry_run=true by default.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mutation to trigger the cross-domain intelligence pipeline.
 * On success, invalidates vector and confidence queries for the user.
 *
 * @param userId  — Supabase Auth UID of the student whose pipeline to trigger
 *
 * @example
 * const { mutate: trigger, isPending } = useTriggerPipeline(userId);
 * trigger({ dry_run: false }); // only when ready to persist
 */
export function useTriggerPipeline(
  userId: string,
): UseMutationResult<TriggerPipelineResponse, Error, TriggerPipelineInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TriggerPipelineInput) => triggerPipeline(userId, input),

    onSuccess: (result) => {
      if (!result.dry_run) {
        // Invalidate stale data for this user after a real (non-dry-run) pipeline run
        queryClient.invalidateQueries({
          queryKey: intelligenceKeys.studentVector(userId),
        });
        queryClient.invalidateQueries({
          queryKey: intelligenceKeys.studentConfidence(userId),
        });
      }
    },
  });
}
