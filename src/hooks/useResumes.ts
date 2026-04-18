// hooks/useResumes.ts
//
// Hooks — GET /api/v1/resumes + POST /api/v1/resumes.
// Combines list query and upload mutation in one file for cohesion.
// On upload success: invalidates resume list AND profile (resumeUploaded flag).
//
// PHASE-4 UPDATE:
//   After a successful upload, POST /api/v1/career-health/calculate to
//   kick off CHI recalculation. The response may be 202 (async job) or
//   200 (sync result). In either case, the career health query cache is
//   updated so useCareerHealth automatically picks up the async flow.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { resumeService }  from '@/services/resumeService';
import { apiFetchWithStatus } from '@/services/apiClient';
import type { ResumeListResponse } from '@/services/resumeService';
import type { CareerHealthResponse } from '@/types/careerHealth';
import { PROFILE_KEY }       from './useProfile';
import { CAREER_HEALTH_KEY } from './useCareerHealth';

export const RESUMES_KEY = ['resumes', 'list'] as const;

// ─── Query: list resumes ──────────────────────────────────────────────────────

/**
 * useResumes()
 *
 * @returns TanStack Query result wrapping ResumeListResponse
 *          Access via data.items (Resume[]), data.total
 *
 * @example
 *   const { data, isLoading } = useResumes();
 *   const resumes = data?.items ?? [];
 */
export function useResumes() {
  return useQuery<ResumeListResponse>({
    queryKey:  RESUMES_KEY,
    queryFn:   () => resumeService.listResumes(),
    staleTime: 2 * 60 * 1000,
  });
}

// ─── Mutation: upload resume ──────────────────────────────────────────────────

/**
 * useUploadResume()
 *
 * @example
 *   const { mutate, isPending } = useUploadResume();
 *   mutate(file);  // file: File (PDF/DOCX)
 */
export function useUploadResume() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => resumeService.uploadResume(file),

    onSuccess: async (uploadResult) => {
      // 1. Refresh resume list and profile (resumeUploaded flag)
      queryClient.invalidateQueries({ queryKey: RESUMES_KEY });
      queryClient.invalidateQueries({ queryKey: PROFILE_KEY });

      // 2. Trigger CHI recalculation for the newly uploaded resume.
      //    The backend returns 202 (async) or 200 (sync).
      //    We write the response — including any jobId — directly into the
      //    career health cache so useCareerHealth detects the async flow.
      try {
        const resumeId = uploadResult?.resumeId;
        const { data, status } = await apiFetchWithStatus<CareerHealthResponse>(
          '/career-health/calculate',
          {
            method: 'POST',
            body:   JSON.stringify({ resumeId: resumeId ?? null }),
          },
        );

        if (status === 202) {
          // Async job — write the 202 envelope (containing jobId) into the
          // cache. useCareerHealth will detect data.jobId and start polling.
          queryClient.setQueryData(CAREER_HEALTH_KEY, data);
        } else {
          // Sync result — write completed data directly.
          queryClient.setQueryData(CAREER_HEALTH_KEY, data);
        }
      } catch {
        // If the CHI trigger fails, fall back to a simple invalidation so
        // useCareerHealth re-fetches on its own schedule. Never block the
        // upload success state.
        queryClient.invalidateQueries({ queryKey: CAREER_HEALTH_KEY });
      }
    },
  });
}

// ─── Mutation: delete resume ──────────────────────────────────────────────────

/**
 * useDeleteResume()
 *
 * @example
 *   const { mutate } = useDeleteResume();
 *   mutate(resume.id);
 */
export function useDeleteResume() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => resumeService.deleteResume(id),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RESUMES_KEY });
      queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
      // Invalidate career health — score is now stale after deletion
      queryClient.invalidateQueries({ queryKey: CAREER_HEALTH_KEY });
    },
  });
}