/**
 * @file src/hooks/mutations/useUploadResume.ts
 * @description Mutation hook for POST /api/v1/resumes (resume upload).
 *
 * RESPONSIBILITIES:
 *  - Wrap the resume upload API call in useMutation
 *  - Invalidate all affected queries on success
 *  - Apply consistent retry strategy (shouldRetry / retryDelay from queryClient.ts)
 *  - Surface structured ApiClientError to callers
 *
 * HARD RULES:
 *  - NO UI logic — callers handle progress / success / error states
 *  - NO polling logic — the caller polls /resumes/:id/status with the
 *    returned jobId until status === 'done' | 'failed'
 *  - NO direct fetch / axios — always through apiClient
 *  - Errors are ApiClientError instances — never rethrow as raw
 *
 * OPTIMISTIC UPDATES: intentionally omitted.
 *  Upload is async (server returns jobId immediately). The actual score and
 *  parsed data are not available until the job settles. We invalidate after
 *  success so the next data read reflects the new state.
 *
 * INVALIDATION STRATEGY (v2.1 — expanded):
 *  A successful upload affects the following cache regions:
 *    1. queryKeys.resume.all()        — resume list gains a new entry
 *    2. queryKeys.resumeScore.all()   — score will be recalculated once job settles
 *    3. queryKeys.careerHealth.all()  — CHI depends on resume_uploaded = true
 *    4. queryKeys.dashboard.all()     — dashboard hasResume flag may change
 *
 *  queryKeys.skillsPriority is NOT invalidated — it depends on targetRole + skills,
 *  not on resume content directly.
 *
 *  The caller is responsible for polling job status and triggering a manual
 *  query.refetch() on resumeScore once status === 'done'.
 *
 * Architecture position: Hooks layer (second tier)
 *   API → Hooks → UI → Pages → Guards → Context
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiClientError } from '@/lib/api/core';
import { shouldRetry, retryDelay, queryKeys } from '@/lib/query';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface UploadResumeInput {
  /** FormData containing the resume file under the 'file' key. */
  formData: FormData;
}

export interface UploadResumeResponse {
  resumeId: string;
  jobId:    string;
  status:   'pending' | 'processing' | 'done' | 'failed';
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useUploadResume() {
  const queryClient = useQueryClient();

  return useMutation<UploadResumeResponse, ApiClientError, UploadResumeInput>({
    mutationFn: ({ formData }) =>
      apiClient<UploadResumeResponse>({
        url:    '/api/v1/resumes',
        method: 'POST',
        data:   formData,
      }),

    // NON-IDEMPOTENT: POST /api/v1/resumes creates a new resume record and
    // enqueues a new processing job on every call. Retrying on a transient 5xx
    // would create duplicate records and duplicate jobs.
    // ⚠️  DO NOT change retry to shouldRetry here — keep retry: false.
    retry:      false,
    retryDelay: retryDelay,

    onSuccess: () => {
      // Resume list gains a new entry.
      void queryClient.invalidateQueries({ queryKey: queryKeys.resume.all() });
      // Resume score will be recalculated once the async job settles.
      void queryClient.invalidateQueries({ queryKey: queryKeys.resumeScore.all() });
      // CHI score depends on resume_uploaded = true — bust it so it re-evaluates.
      void queryClient.invalidateQueries({ queryKey: queryKeys.careerHealth.all() });
      // Dashboard may surface a hasResume flag or quota change.
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
    },
  });
}