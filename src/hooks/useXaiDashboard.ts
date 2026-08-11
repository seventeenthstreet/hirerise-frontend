/**
 * @file src/hooks/useXaiDashboard.ts
 * @description Orchestrator hook for the XAI Operations Dashboard page.
 *
 * RESPONSIBILITIES:
 *  - Compose useSystemHealth() + useXaiMetrics() into one stable return type
 *  - Provide a single data source for XaiOperationsDashboardPage
 *  - Surface aggregate loading / error / stale flags for the page layer
 *
 * HARD RULES:
 *  - NO UI logic — pure orchestration
 *  - NO API calls — delegates entirely to useSystemHealth and useXaiMetrics
 *  - NO duplication — re-exports what already exists rather than rebuilding it
 *
 * WP-13 COMPATIBILITY:
 *  This hook is the primary composition point. When WP-13 wires real metrics,
 *  only the underlying hooks change — this orchestrator and the page layer
 *  are unaffected.
 *
 * Architecture position: Hooks layer (second tier)
 *   API → Hooks → UI → Pages → Guards → Context
 */

import { useSystemHealth }  from '@/hooks/useSystemHealth';
import { useXaiMetrics }    from '@/hooks/useXaiMetrics';
import type { UseSystemHealthReturn }  from '@/hooks/useSystemHealth';
import type { UseXaiMetricsReturn }    from '@/hooks/useXaiMetrics';
import type { ApiClientError }         from '@/lib/api/core';

// ─────────────────────────────────────────────────────────────────────────────
// HOOK RETURN TYPE
// ─────────────────────────────────────────────────────────────────────────────

export interface UseXaiDashboardReturn {
  health:       UseSystemHealthReturn;
  xaiMetrics:   UseXaiMetricsReturn;
  /** True when any section is in its initial loading state. */
  isAnyLoading: boolean;
  /** True when all sections have errored (full dashboard failure). */
  isAllError:   boolean;
  /** True when any section has stale data being background-refetched. */
  isAnyStale:   boolean;
  /**
   * First error found, prioritising sections with no data over sections
   * with stale data + a new error. Null when no errors are present.
   */
  firstError:   ApiClientError | null;
  /** True when XAI metrics are in Phase 1 zero-value empty state. */
  phase1Empty:  boolean;
  /** Force-refetches all sections, bypassing staleTime. */
  refetchAll:   () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useXaiDashboard(): UseXaiDashboardReturn {
  const health     = useSystemHealth();
  const xaiMetrics = useXaiMetrics();

  // ── Aggregate loading / error / stale flags ──────────────────────────────────
  // Health contributes its own flags alongside xaiMetrics aggregate flags.
  const isAnyLoading =
    health.isLoading ||
    xaiMetrics.isAnyLoading;

  const isAllError =
    health.error !== null &&
    xaiMetrics.isAllError;

  const isAnyStale =
    health.isStale ||
    xaiMetrics.isAnyStale;

  // Prioritise sections with no data (initial errors) over partial data errors.
  const firstError: ApiClientError | null =
    (health.error !== null && health.data === null ? health.error : null) ??
    xaiMetrics.firstError ??
    health.error ??
    null;

  const refetchAll = (): void => {
    health.refetch();
    xaiMetrics.refetchAll();
  };

  return {
    health,
    xaiMetrics,
    isAnyLoading,
    isAllError,
    isAnyStale,
    firstError,
    phase1Empty: xaiMetrics.phase1Empty,
    refetchAll,
  };
}