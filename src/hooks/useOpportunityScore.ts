/**
 * hooks/useOpportunityScore.ts
 *
 * Fetches the user's aggregate Portfolio Opportunity Score from
 * GET /api/v1/career-opportunities/score
 *
 * This replaces the proxy value (chi.demandMetrics[0].demandScore) that was
 * previously used in the KPI tile. The backend computes a real composite score:
 *
 *   portfolio_score = weighted average of top-5
 *                     (opportunity_score × 0.60 + match_score × 0.40)
 *
 * The query is:
 *   - Enabled only when the user has a CHI snapshot (isReady: true) — the
 *     radar engine needs a profile to personalise results.
 *   - Stale for 30 min (matches the backend Redis cache TTL).
 *   - Retries once on failure (radar engine may need time after first CV upload).
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/services/apiClient';
import type { OpportunityScoreResult } from '@/types/careerHealth';

export const OPPORTUNITY_SCORE_KEY = ['career-opportunities', 'score'] as const;

interface UseOpportunityScoreOptions {
  /**
   * Only fetch when the user has a ready CHI snapshot.
   * Pass chi.isReady here so the hook is a no-op before CV processing completes.
   */
  enabled?: boolean;
  /** Override default minOpportunityScore (default 30 on backend). */
  minOpportunityScore?: number;
  /** Override default signal limit (default 10 on backend). */
  limit?: number;
}

export function useOpportunityScore(opts: UseOpportunityScoreOptions = {}) {
  const {
    enabled              = true,
    minOpportunityScore,
    limit,
  } = opts;

  // Build query-string only when overrides are provided
  const params = new URLSearchParams();
  if (minOpportunityScore != null) params.set('minOpportunityScore', String(minOpportunityScore));
  if (limit               != null) params.set('limit',               String(limit));
  const qs = params.toString() ? `?${params.toString()}` : '';

  return useQuery<OpportunityScoreResult>({
    queryKey: [...OPPORTUNITY_SCORE_KEY, minOpportunityScore, limit],
    queryFn:  async () => {
      const envelope = await apiFetch<{ data: OpportunityScoreResult }>(
        `/career-opportunities/score${qs}`
      );
      // apiFetch unwraps { success, data } → envelope IS the data payload
      return (envelope as unknown as OpportunityScoreResult);
    },
    enabled,
    staleTime: 30 * 60 * 1000,  // 30 min — matches backend Redis TTL
    retry:     1,
  });
}