/**
 * @file src/hooks/useSystemHealth.ts
 * @description React Query hook for the system health endpoint.
 *
 * RESPONSIBILITIES:
 *  - Fetch GET /api/v1/system/health via getSystemHealth()
 *  - Return a typed MetricSectionState<SystemHealthResponse>
 *  - Refresh every 60 seconds (1 min staleTime — health is a live signal)
 *  - Handle loading / error / success / unauthorized states
 *
 * HARD RULES:
 *  - NO UI logic — pure data + state management
 *  - NO direct fetch / axios — only through lib/api/metrics.ts
 *  - Errors are ApiClientError instances — never raw
 *  - No mock data, no hardcoded values
 *
 * WP-13 COMPATIBILITY:
 *  When WP-13 replaces the backend stub with real health checks, this hook
 *  requires zero changes. The endpoint path, response type, and query key
 *  are all stable.
 *
 * Architecture position: Hooks layer (second tier)
 *   API → Hooks → UI → Pages → Guards → Context
 */

import { useQuery }              from '@tanstack/react-query';
import { getSystemHealth }       from '@/lib/api/metrics';
import type { SystemHealthResponse } from '@/lib/api/metrics';
import type { ApiClientError }   from '@/lib/api/core';
import { queryKeys }             from '@/lib/query';
import type { MetricSectionState } from '@/hooks/useMetrics';

// ─────────────────────────────────────────────────────────────────────────────
// STALE TIME
// Health is a live operational signal — refresh faster than analytics sections.
// Global QUERY_STALE_TIME is 2 min; we override to 1 min here.
// ─────────────────────────────────────────────────────────────────────────────

const HEALTH_STALE_TIME_MS = 60_000; // 1 minute

// ─────────────────────────────────────────────────────────────────────────────
// HOOK RETURN TYPE
// ─────────────────────────────────────────────────────────────────────────────

export interface UseSystemHealthReturn extends MetricSectionState<SystemHealthResponse> {
  /** Convenience flag: true when status === 'healthy'. */
  isHealthy:  boolean;
  /** Convenience flag: true when status === 'degraded'. */
  isDegraded: boolean;
  /** Convenience flag: true when status === 'down'. */
  isDown:     boolean;
  /** Manually triggers a fresh health check, bypassing staleTime. */
  refetch:    () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useSystemHealth(): UseSystemHealthReturn {
  const query = useQuery({
    queryKey: queryKeys.systemHealth.snapshot(),
    queryFn:  ({ signal }) => getSystemHealth(signal),
    staleTime: HEALTH_STALE_TIME_MS,
    // refetchOnWindowFocus is false globally (queryClient.ts).
    // Health is polled via staleTime — no opt-in needed here.
  });

  const data: SystemHealthResponse | null = query.data ?? null;

  return {
    data,
    isLoading:     query.isLoading,
    isStale:       query.isStale,
    error:         query.error as ApiClientError | null,
    dataUpdatedAt: query.dataUpdatedAt,

    // Convenience status flags — safe when data is null
    isHealthy:  data?.status === 'healthy',
    isDegraded: data?.status === 'degraded',
    isDown:     data?.status === 'down',

    refetch: () => { void query.refetch(); },
  };
}