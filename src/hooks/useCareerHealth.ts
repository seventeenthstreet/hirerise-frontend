/**
 * hooks/useCareerHealth.ts
 *
 * Fetches GET /api/v1/career-health — Career Health Index (CHI) score +
 * snapshot data. Used by the CHI widget on the dashboard.
 *
 * CHI dependencies (must all be true for a non-null score):
 *   - resume_uploaded = true
 *   - skills in profile
 *   - target_role set
 *
 * v2 — React Query migration (Phase 2)
 * v2.1 — Hardening (Phase 2.5):
 *  - Removed `meta: { onError }`. React Query v5 does not call meta.onError
 *    automatically — it was a no-op. The onError option is forwarded via a
 *    stable useEffect that watches query.error, which is the correct v5 pattern.
 *  - `select` added to project raw API response into the { chiScore, chiSnapshot }
 *    shape so the component receives pre-shaped data and re-renders only when
 *    the relevant fields change (not on unrelated response key changes).
 *  - `refetch` now calls query.refetch() directly instead of invalidateQueries.
 *    invalidateQueries marks all subscribers stale and triggers background
 *    refetch — appropriate for cross-hook invalidation. query.refetch() is the
 *    correct API for "reload this specific query immediately" from a UI action.
 */

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiClientError } from '@/lib/api/core';
import { queryKeys } from '@/lib/query';
import { useAppContext } from '@/context/AppContext';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CHISnapshot {
  topSkills?: Array<{ id: string; name: string; score: number }>;
  gaps?: Array<{ id: string; name: string; priority: 'high' | 'medium' | 'low' }>;
  lastUpdated?: string;
  version?: number;
}

/** Raw shape returned by GET /api/v1/career-health */
interface CareerHealthResponse {
  score:    number | null;
  snapshot: CHISnapshot | null;
}

/** Projected shape exposed to callers via select */
interface CareerHealthSelected {
  chiScore:    number | null;
  chiSnapshot: CHISnapshot | null;
}

export interface UseCareerHealthOptions {
  enabled?: boolean;
  onError?: (err: unknown) => void;
}

export interface UseCareerHealthReturn {
  chiScore:    number | null;
  chiSnapshot: CHISnapshot | null;
  isLoading:   boolean;
  isError:     boolean;
  error:       ApiClientError | null;
  refetch:     () => void;
}

// ── Selector ──────────────────────────────────────────────────────────────────

function selectCareerHealth(raw: CareerHealthResponse): CareerHealthSelected {
  return {
    chiScore:    raw.score    ?? null,
    chiSnapshot: raw.snapshot ?? null,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCareerHealth(options: UseCareerHealthOptions = {}): UseCareerHealthReturn {
  const { enabled = true, onError } = options;

  // Q-01 (Phase 3A Step 5): Gate on AppContext hydration — same guard as useDashboard.
  // Prevents firing GET /api/v1/career-health before the auth sequence completes.
  // Without this guard, the query can fire with an absent or stale token when
  // the hook is mounted outside the guarded dashboard layout (test, future refactor).
  const { isHydrated } = useAppContext();

  const query = useQuery<CareerHealthResponse, ApiClientError, CareerHealthSelected>({
    queryKey: queryKeys.careerHealth.all(),
    queryFn:  () => apiClient<CareerHealthResponse>({ url: '/api/v1/career-health' }),
    // Q-01: Both flags must be true — hydration gate + caller opt-out.
    enabled:  enabled && isHydrated,
    select:   selectCareerHealth,
  });

  // Forward errors to the optional caller-supplied handler.
  // React Query v5 removed onError from useQuery options — the recommended
  // v5 pattern is a useEffect that watches query.error.
  useEffect(() => {
    if (query.error && onError) {
      onError(query.error);
    }
  }, [query.error, onError]);

  return {
    chiScore:    query.data?.chiScore    ?? null,
    chiSnapshot: query.data?.chiSnapshot ?? null,
    isLoading:   query.isLoading,
    isError:     query.isError,
    error:       query.error ?? null,
    // query.refetch() — correct API for "reload this query now" from a user action.
    // Bypasses staleTime and fires immediately, scoped to this query only.
    refetch:     () => { void query.refetch(); },
  };
}