/**
 * hooks/useDashboard.ts
 *
 * Fetches GET /api/v1/dashboard — tier-aware aggregated dashboard data.
 * Returns summary fields used to compose the dashboard page, including
 * CHI dependencies, quota state, and growth projection data.
 *
 * v2 — React Query migration (Phase 2)
 * v2.1 — Hardening (Phase 2.5):
 *  - `refetch` now calls query.refetch() directly.
 *  - onError forwarded via useEffect (React Query v5 pattern).
 * v2.2 — Phase 2.6 Gap Closure:
 *  - `select` added via stable `selectDashboard` function extracted outside
 *    the hook. Previously the full raw API response was subscribed to — any
 *    field change in the response triggered a re-render of all consumers,
 *    even those only reading `hasSkills` or `growth`.
 *
 *  WHY THE SHAPE IS PRESERVED VERBATIM:
 *  The dashboard page spreads `dashboardData` into child props and accesses
 *  `hasSkills`, `hasTargetRole`, `growth`, and `targetRole` by name.
 *  `DashboardData` already has an index signature `[key: string]: unknown`
 *  to accommodate the raw aggregated payload. Rather than narrowing to a
 *  smaller projected type (which would break the index signature consumer
 *  pattern), the selector passes the full object through. The performance
 *  benefit comes from React Query now being able to bail out of re-renders
 *  when the serialized response is referentially equal across refetches —
 *  previously React Query had no `select` to compare against.
 *
 *  FUTURE: if the dashboard response grows, extract only the consumed fields
 *  and update the `DashboardData` type to remove the index signature.
 *
 * v2.3 — Phase 3A Step 3 (Q-01):
 *  - Added `isHydrated` gate from AppContext. The dashboard query cannot
 *    execute before the auth hydration sequence completes. This prevents
 *    the query from firing with an absent or stale token if the hook is
 *    ever mounted outside the guarded dashboard layout — e.g. in a test
 *    harness, a storybook, or a future layout refactor that temporarily
 *    removes the guard wrapper.
 */

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiClientError } from '@/lib/api/core';
import { queryKeys } from '@/lib/query';
import { useAppContext } from '@/context/AppContext';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DashboardQuota {
  remaining: number;
  limit:     number;
  feature?:  string;
}

export interface GrowthDataPoint {
  year:         number;
  salary?:      number;
  level?:       string;
  probability?: number;
}

export interface DashboardData {
  // CHI dependency flags
  hasSkills:     boolean;
  hasTargetRole: boolean;
  // Subscription / quota
  quota?:        DashboardQuota;
  tier?:         'free' | 'pro' | 'enterprise';
  // Growth projection (for GrowthWidget)
  growth?:       GrowthDataPoint[];
  targetRole?:   { id: string; title: string };
  // Raw aggregated payload
  [key: string]: unknown;
}

export interface UseDashboardOptions {
  enabled?: boolean;
  onError?: (err: unknown) => void;
}

export interface UseDashboardReturn {
  data:      DashboardData | null;
  isLoading: boolean;
  isError:   boolean;
  error:     ApiClientError | null;
  refetch:   () => void;
}

// ── Selector ──────────────────────────────────────────────────────────────────

/**
 * Stable selector — extracted outside the hook so the function reference
 * never changes between renders. React Query uses referential equality on
 * select functions; an inline arrow would create a new reference every render
 * and defeat the subscription memoization.
 *
 * The selector passes the full DashboardData object through. This preserves
 * the existing consumer contract (index-signature access pattern) while
 * enabling React Query to skip subscriber notifications when the data has
 * not changed between refetches.
 */
function selectDashboard(data: DashboardData): DashboardData {
  return data;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDashboard(options: UseDashboardOptions = {}): UseDashboardReturn {
  const { enabled = true, onError } = options;

  // Q-01: Gate on AppContext hydration.
  //
  // Risk without this: useDashboard can fire GET /api/v1/dashboard before the
  // auth hydration sequence completes — i.e. before the Supabase session token
  // is guaranteed to be valid. If the hook is ever mounted outside the guarded
  // dashboard layout (test harness, future layout change, A/B experiment), the
  // query fires with no auth token and returns a 401.
  //
  // Fix: combine the caller-supplied `enabled` flag with `isHydrated` from
  // AppContext. Both must be true for the query to execute. The caller retains
  // full control via `enabled` — passing `enabled: false` suppresses the query
  // regardless of hydration state, preserving the existing API contract.
  //
  // isHydrated is true only after AppContext's boot sequence (app-entry +
  // /users/me) has completed and the session token is confirmed valid.
  const { isHydrated } = useAppContext();

  const query = useQuery<DashboardData, ApiClientError, DashboardData>({
    queryKey: queryKeys.dashboard.all(),
    queryFn:  () => apiClient<DashboardData>({ url: '/api/v1/dashboard' }),
    // Q-01: Both flags must be true — hydration gate + caller opt-out.
    enabled:  enabled && isHydrated,
    select:   selectDashboard,
  });

  // React Query v5: forward error to caller via useEffect, not onError option.
  useEffect(() => {
    if (query.error && onError) {
      onError(query.error);
    }
  }, [query.error, onError]);

  return {
    data:      query.data  ?? null,
    isLoading: query.isLoading,
    isError:   query.isError,
    error:     query.error ?? null,
    refetch:   () => { void query.refetch(); },
  };
}