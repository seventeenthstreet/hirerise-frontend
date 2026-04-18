// hooks/useAiJobPoller.ts
//
// Polls GET /api/v1/ai-jobs/:jobId every 5 seconds until the job
// reaches a terminal state (completed | failed).
// Used by useCareerHealth and ResumeUploader to track async AI processing.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/services/apiClient';
import { CAREER_HEALTH_KEY } from './useCareerHealth';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AiJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface AiJobResult {
  jobId:         string;
  operationType: string;
  status:        AiJobStatus;
  result:        Record<string, unknown> | null;
  error:         { code: string; message: string } | null;
  createdAt:     string;
  completedAt:   string | null;
}

// Terminal statuses — polling stops here
const TERMINAL: Set<AiJobStatus> = new Set(['completed', 'failed']);

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useAiJobPoller(jobId)
 *
 * Polls /api/v1/ai-jobs/:jobId every 5 seconds.
 * Automatically stops when status is 'completed' or 'failed'.
 * When a job completes, invalidates the career-health query so the
 * dashboard refreshes with the new CHI score.
 *
 * @param jobId  — returned from the CV upload response. Pass null to disable.
 *
 * @example
 *   const { data: job } = useAiJobPoller(uploadResult?.jobId ?? null);
 *   if (job?.status === 'completed') showSuccess();
 */
export function useAiJobPoller(jobId: string | null) {
  const queryClient = useQueryClient();

  return useQuery<AiJobResult>({
    queryKey:  ['ai-jobs', jobId ?? ''],
    queryFn:   () => apiFetch<AiJobResult>(`/ai-jobs/${jobId}`),
    enabled:   !!jobId,

    // Poll every 5 seconds while job is active
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || TERMINAL.has(status)) return false;
      return 5_000;
    },

    // When job finishes, refresh career health so dashboard updates
    select: (data) => {
      if (data.status === 'completed') {
        queryClient.invalidateQueries({ queryKey: CAREER_HEALTH_KEY });
      }
      return data;
    },

    staleTime: 0,
    gcTime:    5 * 60 * 1000,
    retry:     false, // don't retry on 404 — job may not exist yet
  });
}
