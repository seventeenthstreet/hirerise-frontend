// features/resume/hooks/useResume.ts
//
// TanStack Query hooks for the Resume Intelligence pipeline.
//
// FLOW:
//   1. useUploadResume()  — POST /api/v1/resumes/upload → { jobId }
//   2. useJobPoller()     — GET  /api/v1/ai-jobs/:jobId every 5s until done
//   3. useResumes()       — GET  /api/v1/resumes (history)
//   4. useDeleteResume()  — DELETE /api/v1/resumes/:id

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { resumeService, type JobStatus, type AiJobResponse } from '@/services/resumeService';
import { profileKeys } from '@/features/profile/hooks';

// ─── Query keys ──────────────────────────────────────────────────────────────

export const resumeKeys = {
  all:  () => ['resumes'] as const,
  list: () => [...resumeKeys.all(), 'list'] as const,
  job:  (jobId: string) => ['ai-jobs', jobId] as const,
};

// ─── Terminal statuses — polling stops here ───────────────────────────────────

const TERMINAL_STATUSES = new Set<JobStatus>(['completed', 'failed']);

// ─── useResumes — list upload history ────────────────────────────────────────

/** List the current user's uploaded resumes */
export function useResumes() {
  return useQuery({
    queryKey: resumeKeys.list(),
    queryFn:  () => resumeService.listResumes(),
    staleTime: 2 * 60 * 1000,
  });
}

// ─── useUploadResume — file upload mutation ───────────────────────────────────

/** Upload a new resume. Returns { jobId } for polling. */
export function useUploadResume() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => resumeService.uploadResume(file),
    onSuccess: () => {
      // Invalidate list so the new resume appears in history
      queryClient.invalidateQueries({ queryKey: resumeKeys.list() });
      queryClient.invalidateQueries({ queryKey: profileKeys.me() });
    },
  });
}

// ─── useJobPoller — poll AI job every 5 seconds ──────────────────────────────

/**
 * Poll /api/v1/ai-jobs/:jobId every 5 seconds.
 * Stops automatically once status is 'completed' or 'failed'.
 *
 * @param jobId — returned from useUploadResume().data.jobId
 */
export function useJobPoller(jobId: string | null) {
  const queryClient = useQueryClient();

  return useQuery<AiJobResponse>({
    queryKey:  resumeKeys.job(jobId ?? ''),
    queryFn:   () => resumeService.pollJob(jobId!),
    enabled:   !!jobId,
    // Poll every 5 seconds
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 5_000;
      return TERMINAL_STATUSES.has(data.status) ? false : 5_000;
    },
    // When job completes, refresh resume list
    select: (data) => {
      if (data.status === 'completed') {
        queryClient.invalidateQueries({ queryKey: resumeKeys.list() });
        queryClient.invalidateQueries({ queryKey: profileKeys.me() });
      }
      return data;
    },
    staleTime: 0,
    gcTime:    5 * 60 * 1000,
  });
}

// ─── useDeleteResume ─────────────────────────────────────────────────────────

/** Delete a resume by id */
export function useDeleteResume() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => resumeService.deleteResume(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resumeKeys.list() });
      queryClient.invalidateQueries({ queryKey: profileKeys.me() });
    },
  });
}
