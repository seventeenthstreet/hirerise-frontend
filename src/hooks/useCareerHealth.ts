// hooks/useCareerHealth.ts — FIXED
//
// ROOT CAUSE: Backend returns { success: true, data: { careerHealth: {...} } }
// The apiClient unwraps the outer envelope, giving: { careerHealth: {...} }
// But the hook typed the result as CareerHealthResponse (flat), so:
//   data.chiScore → undefined (it's actually data.careerHealth.chiScore)
//   data.skillGaps → undefined
//   data.isReady → undefined (always falsy → shows "still computing" forever)
//
// FIX: Unwrap the nested careerHealth key after the apiFetch call.
// Backend controller returns: { success: true, data: { careerHealth: { chiScore, ... } } }
// apiClient strips { success, data } → hook receives: { careerHealth: { chiScore, ... } }
// We extract .careerHealth to get the flat CareerHealthResponse.

'use client';

import { useQuery, useQueryClient }      from '@tanstack/react-query';
import { useState, useEffect }           from 'react';
import { apiFetch, apiFetchWithStatus }  from '@/services/apiClient';
import { useAiJobPoller }                from './useAiJobPoller';
import type { CareerHealthResponse }     from '@/types/careerHealth';

/** Exported so other hooks can invalidate after upload or job completion */
export const CAREER_HEALTH_KEY = ['career-health'] as const;

/** Shape the backend actually returns after apiClient envelope strip */
interface ChiApiResponse {
  careerHealth: CareerHealthResponse & { jobId?: string };
}

/**
 * useCareerHealth()
 *
 * Fetches the Career Health Index for the current user.
 * Handles the async processing state — if the backend returns 202,
 * starts polling via useAiJobPoller.
 *
 * Returns a safe empty state (isReady: false) when no CHI exists yet,
 * preventing dashboard cards from showing error states.
 */
export function useCareerHealth() {
  const queryClient = useQueryClient();
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);

  const query = useQuery<CareerHealthResponse>({
    queryKey: CAREER_HEALTH_KEY,
    queryFn: async () => {
      const { data: envelope, status } = await apiFetchWithStatus<ChiApiResponse>(
        '/career-health'
      );

      // Unwrap nested key — backend: { data: { careerHealth: {...} } }
      const chi = envelope?.careerHealth ?? (envelope as unknown as CareerHealthResponse);

      // If backend is still computing, start polling the job
      if (status === 202 && chi?.jobId) {
        setPollingJobId(chi.jobId);
      }

      // Ensure safe defaults so components never crash on missing fields
      return {
        chiScore:           chi?.chiScore           ?? null,
        isReady:            chi?.isReady            ?? (chi?.chiScore != null),
        skillGaps:          chi?.skillGaps          ?? [],
        salaryBenchmark:    chi?.salaryBenchmark    ?? null,
        demandMetrics:      chi?.demandMetrics      ?? [],
        lastCalculated:     chi?.lastCalculated     ?? null,
        topSkills:          chi?.topSkills          ?? [],
        detectedProfession: chi?.detectedProfession ?? null,
        currentJobTitle:    chi?.currentJobTitle    ?? null,
        automationRisk:     chi?.automationRisk     ?? null,
        ...(chi?.jobId  ? { jobId:   chi.jobId   } : {}),
        ...(chi?.status ? { status:  chi.status  } : {}),
        ...(chi?.pollUrl? { pollUrl: chi.pollUrl } : {}),
      };
    },
    staleTime: 10 * 60 * 1000, // 10 min — expensive AI computation
    retry: 1,
  });

  const { data: jobResult } = useAiJobPoller(pollingJobId);

  useEffect(() => {
    if (jobResult?.status === 'completed') {
      setPollingJobId(null);
      queryClient.invalidateQueries({ queryKey: CAREER_HEALTH_KEY });
    }
    if (jobResult?.status === 'failed') {
      setPollingJobId(null);
    }
  }, [jobResult?.status, queryClient]);

  return query;
}

/**
 * useCareerHealthSimple()
 *
 * Lightweight version — no 202 polling. Use on pages that only display
 * existing CHI data.
 */
export function useCareerHealthSimple() {
  return useQuery<CareerHealthResponse>({
    queryKey: CAREER_HEALTH_KEY,
    queryFn: async () => {
      const envelope = await apiFetch<ChiApiResponse>('/career-health');
      const chi = envelope?.careerHealth ?? (envelope as unknown as CareerHealthResponse);
      return {
        chiScore:        chi?.chiScore        ?? null,
        isReady:         chi?.isReady         ?? (chi?.chiScore != null),
        skillGaps:       chi?.skillGaps       ?? [],
        salaryBenchmark: chi?.salaryBenchmark ?? null,
        demandMetrics:   chi?.demandMetrics   ?? [],
        lastCalculated:  chi?.lastCalculated  ?? null,
      };
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}