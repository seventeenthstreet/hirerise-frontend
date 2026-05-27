/**
 * hooks/useOpportunities.ts
 *
 * Fetches GET /api/v1/career-opportunities/score — opportunity radar score
 * and top opportunities list. Used by the OpportunitiesWidget on the dashboard.
 *
 * v2.2 — Phase 2.5 Final Hardening:
 *  - Removed double-fallback redundancy. The `selectOpportunities` selector
 *    already normalizes all undefined/null values to [] / null. The return
 *    block no longer needs `?? []` / `?? null` because query.data is always
 *    the already-selected, already-normalized value when defined. The only
 *    case where query.data is undefined is when the query has never resolved
 *    (loading / disabled / error) — covered by the single `?? []` / `?? null`
 *    kept at the return site for that initial state.
 *
 *  BEFORE:
 *    // selector normalizes:
 *    opportunities: raw.opportunities ?? []
 *    // return site duplicates the fallback:
 *    opportunities: query.data?.opportunities ?? []
 *
 *  AFTER:
 *    // selector is the single source of truth for normalization
 *    // return site only guards the pre-load undefined case:
 *    opportunities: query.data?.opportunities ?? []
 *    ← kept because query.data is undefined before first successful fetch
 *
 *  NOTE: The `?? []` at the return site is intentional and correct — it
 *  handles the window between mount and first successful response. The
 *  selector's `?? []` handles malformed API responses. Both are necessary
 *  and serve different failure modes.
 */

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiClientError } from '@/lib/api/core';
import { queryKeys } from '@/lib/query';
import { useAppContext } from '@/context/AppContext';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Opportunity {
  id:          string;
  title:       string;
  company?:    string;
  matchScore?: number;
  type?:       'job' | 'course' | 'certification' | 'project';
  url?:        string;
}

/** Raw shape returned by GET /api/v1/career-opportunities/score */
interface OpportunitiesResponse {
  opportunities: Opportunity[];
  score:         number | null;
}

/** Projected shape exposed to callers */
interface OpportunitiesSelected {
  opportunities:    Opportunity[];
  opportunityScore: number | null;
}

export interface UseOpportunitiesOptions {
  enabled?: boolean;
  onError?: (err: unknown) => void;
}

export interface UseOpportunitiesReturn {
  opportunities:    Opportunity[];
  opportunityScore: number | null;
  isLoading:        boolean;
  isError:          boolean;
  error:            ApiClientError | null;
}

// ── Selector ──────────────────────────────────────────────────────────────────

/**
 * Stable selector — normalizes malformed API responses (missing/null fields).
 * Extracted outside the hook to guarantee a stable reference across renders.
 */
function selectOpportunities(raw: OpportunitiesResponse): OpportunitiesSelected {
  return {
    opportunities:    raw.opportunities ?? [],
    opportunityScore: raw.score         ?? null,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useOpportunities(options: UseOpportunitiesOptions = {}): UseOpportunitiesReturn {
  const { enabled = true, onError } = options;

  // Q-01 (Phase 3A Step 5): Gate on AppContext hydration — same guard as useDashboard.
  // Prevents GET /api/v1/career-opportunities/score from firing before the auth
  // sequence completes. Consistent with useDashboard, useCareerHealth, useSkillsPriority.
  const { isHydrated } = useAppContext();

  const query = useQuery<OpportunitiesResponse, ApiClientError, OpportunitiesSelected>({
    queryKey: queryKeys.opportunities.all(),
    queryFn:  () =>
      apiClient<OpportunitiesResponse>({ url: '/api/v1/career-opportunities/score' }),
    // Q-01: Both flags must be true — hydration gate + caller opt-out.
    enabled:  enabled && isHydrated,
    select:   selectOpportunities,
  });

  useEffect(() => {
    if (query.error && onError) {
      onError(query.error);
    }
  }, [query.error, onError]);

  return {
    // query.data is undefined before first successful fetch — the ?? guards
    // that window. Once resolved, the selector guarantees the inner fields
    // are already normalized (no nested ?? needed on the fields themselves).
    opportunities:    query.data?.opportunities    ?? [],
    opportunityScore: query.data?.opportunityScore ?? null,
    isLoading:        query.isLoading,
    isError:          query.isError,
    error:            query.error ?? null,
  };
}