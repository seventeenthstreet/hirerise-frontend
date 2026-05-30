/**
 * hooks/useResumeScore.ts
 *
 * Fetches GET /api/v1/resume-scores/me — calculates resume score for the
 * authenticated user. Only enabled after resume_uploaded = true.
 * Used by the ResumeScoreWidget on the dashboard.
 *
 * v2 — React Query migration (Phase 2)
 * v2.1 — Hardening (Phase 2.5):
 *  - `refetch` now calls query.refetch() directly.
 *  - onError forwarded via useEffect (React Query v5 pattern).
 * v2.2 — Phase 2.6 Gap Closure:
 *  - `select` added via stable `selectResumeScore` function.
 *    Previously the raw ResumeScore object was subscribed to with no
 *    selector — any refetch would notify all subscribers even if the
 *    data was identical. The selector now gives React Query a stable
 *    comparison point to bail out of unnecessary re-renders.
 *
 *  NOTE: The ResumeScoreWidget consumes all fields of ResumeScore
 *  (score, grade, breakdown, cached). The selector passes the full
 *  object through — the optimization benefit here is the refetch
 *  de-duplication React Query performs when select is present, not
 *  field narrowing.
 */

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiClientError } from '@/lib/api/core';
import { queryKeys } from '@/lib/query';
import { useAppContext } from '@/context/AppContext';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ResumeScore {
  score:       number;           // 0–100
  grade?:      string;           // e.g. 'A', 'B+'
  breakdown?: {
    formatting?:  number;
    keywords?:    number;
    experience?:  number;
    education?:   number;
  };
  cached?:      boolean;
  lastUpdated?: string;
}

export interface UseResumeScoreOptions {
  enabled?: boolean;
  onError?: (err: unknown) => void;
}

export interface UseResumeScoreReturn {
  resumeScore: ResumeScore | null;
  isLoading:   boolean;
  isError:     boolean;
  error:       ApiClientError | null;
  refetch:     () => void;
}

// ── Selector ──────────────────────────────────────────────────────────────────

/**
 * Stable selector — extracted outside the hook so the function reference
 * never changes between renders.
 *
 * ResumeScoreWidget reads all fields (score, grade, breakdown, cached), so
 * there is no benefit in narrowing the shape here. The selector exists to:
 *  1. Give React Query a stable comparison surface so it can bail out of
 *     subscriber notifications when a refetch returns identical data.
 *  2. Normalize the empty-state at the data layer (`cached` defaults to false
 *     if absent, preventing undefined propagating to the component).
 */
function selectResumeScore(raw: ResumeScore): ResumeScore {
  return {
    score:       raw.score,
    grade:       raw.grade,
    breakdown:   raw.breakdown,
    cached:      raw.cached      ?? false,
    lastUpdated: raw.lastUpdated,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useResumeScore(options: UseResumeScoreOptions = {}): UseResumeScoreReturn {
  const { enabled = true, onError } = options;

  // Q-01 (Phase 3A Step 5): Gate on AppContext hydration — same guard as useDashboard.
  // Prevents GET /api/v1/resume-scores/me from firing before the auth sequence
  // completes. Consistent with all other dashboard data hooks.
  const { isHydrated } = useAppContext();

  const query = useQuery<ResumeScore, ApiClientError, ResumeScore>({
    queryKey: queryKeys.resumeScore.all(),
    queryFn:  () => apiClient<ResumeScore>({ url: '/api/v1/resume-scores/me' }),
    // Q-01: Both flags must be true — hydration gate + caller opt-out.
    enabled:  enabled && isHydrated,
    select:   selectResumeScore,
  });

  useEffect(() => {
    if (query.error && onError) {
      onError(query.error);
    }
  }, [query.error, onError]);

  return {
    resumeScore: query.data  ?? null,
    isLoading:   query.isLoading,
    isError:     query.isError,
    error:       query.error ?? null,
    refetch:     () => { void query.refetch(); },
  };
}