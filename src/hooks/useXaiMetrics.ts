/**
 * @file src/hooks/useXaiMetrics.ts
 * @description React Query hook for the XAI metrics endpoints.
 *
 * RESPONSIBILITIES:
 *  - Fetch GET /api/v1/metrics/xai-usage via getXaiUsageMetrics()
 *  - Fetch GET /api/v1/metrics/xai-tier  via getXaiTierMetrics()
 *  - Return typed MetricSectionState<T> for each section
 *  - Accept and apply MetricFilters (date range, grain, user_type)
 *  - Expose a phase1Empty flag when all data is zero-value (Phase 1 stub)
 *
 * HARD RULES:
 *  - NO UI logic — pure data + state management
 *  - NO direct fetch / axios — only through lib/api/metrics.ts
 *  - Errors are ApiClientError instances — never raw
 *  - No mock data, no hardcoded values
 *  - Zero-value responses are valid — not errors
 *
 * WP-13 COMPATIBILITY:
 *  When WP-13 replaces the backend stubs with real aggregation, this hook
 *  requires zero changes. The endpoint paths, response types, query keys,
 *  and filter contract are all stable. phase1Empty will naturally become
 *  false once real data populates.
 *
 * Architecture position: Hooks layer (second tier)
 *   API → Hooks → UI → Pages → Guards → Context
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery }                        from '@tanstack/react-query';
import {
  getXaiUsageMetrics,
  getXaiTierMetrics,
}                                          from '@/lib/api/metrics';
import type {
  MetricFilters,
  XaiUsageMetrics,
  XaiTierDistributionMetrics,
}                                          from '@/lib/api/metrics';
import type { ApiClientError }             from '@/lib/api/core';
import { queryKeys, QUERY_STALE_TIME }     from '@/lib/query';
import type { MetricSectionState }         from '@/hooks/useMetrics';

// ─────────────────────────────────────────────────────────────────────────────
// QUERY KEY PARAM EXTRACTOR
// Mirrors the pattern in useMetrics — reads from the tail of the queryKey.
// ─────────────────────────────────────────────────────────────────────────────

function getParamsFromQueryKey<T = unknown>(queryKey: readonly unknown[]): T | undefined {
  return queryKey[queryKey.length - 1] as T | undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION STATE ADAPTER
// Mirrors toSectionState() from useMetrics — keeps the shape consistent.
// ─────────────────────────────────────────────────────────────────────────────

function toSectionState<T>(query: {
  data:          T | undefined;
  isLoading:     boolean;
  isFetching:    boolean;
  isStale:       boolean;
  error:         unknown;
  dataUpdatedAt: number;
}): MetricSectionState<T> {
  return {
    data:          query.data ?? null,
    isLoading:     query.isLoading,
    isStale:       query.isStale,
    error:         query.error as ApiClientError | null,
    dataUpdatedAt: query.dataUpdatedAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ZERO-VALUE DETECTOR
//
// Phase 1: backend stubs return all zeros.
// The UI renders a "WP-13 pending" informational state when this is true —
// not an error state, just a Phase 1 placeholder message.
// ─────────────────────────────────────────────────────────────────────────────

function isXaiPhase1Empty(
  usage: XaiUsageMetrics | null,
  tier:  XaiTierDistributionMetrics | null,
): boolean {
  if (usage === null || tier === null) return false;
  return (
    usage.explanation_request_count === 0 &&
    usage.fallback_explanation_count === 0 &&
    tier.ai_augmentation_exposure_rate === 0 &&
    tier.tier_distribution.HIGH    === 0 &&
    tier.tier_distribution.MEDIUM  === 0 &&
    tier.tier_distribution.LOW     === 0 &&
    tier.tier_distribution.NO_DATA === 0
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK RETURN TYPE
// ─────────────────────────────────────────────────────────────────────────────

export interface UseXaiMetricsReturn {
  usage:        MetricSectionState<XaiUsageMetrics>;
  tier:         MetricSectionState<XaiTierDistributionMetrics>;
  isAnyLoading: boolean;
  isAllError:   boolean;
  isAnyStale:   boolean;
  firstError:   ApiClientError | null;
  /**
   * True when both sections have loaded and all fields are zero.
   * Signals Phase 1 empty state — render a WP-13 informational placeholder,
   * not an error.
   */
  phase1Empty:  boolean;
  filters:      MetricFilters;
  setFilters:   (patch: Partial<MetricFilters>) => void;
  clearFilters: () => void;
  refetchAll:   () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT FILTERS
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: MetricFilters = { grain: 'weekly' };

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useXaiMetrics(): UseXaiMetricsReturn {
  // ── Filter state ────────────────────────────────────────────────────────────
  const [filters, setFiltersState] = useState<MetricFilters>(DEFAULT_FILTERS);

  // ── Primary queries ─────────────────────────────────────────────────────────
  // queryKey includes filters so React Query re-fetches and caches independently
  // per filter combo. Params always come from queryKey (never closed over).

  const usageQuery = useQuery({
    queryKey: queryKeys.xaiMetrics.usage(filters),
    queryFn:  ({ queryKey, signal }) => {
      const params = getParamsFromQueryKey<MetricFilters>(queryKey);
      return getXaiUsageMetrics(params, signal);
    },
    staleTime: QUERY_STALE_TIME,
  });

  const tierQuery = useQuery({
    queryKey: queryKeys.xaiMetrics.tier(filters),
    queryFn:  ({ queryKey, signal }) => {
      const params = getParamsFromQueryKey<MetricFilters>(queryKey);
      return getXaiTierMetrics(params, signal);
    },
    staleTime: QUERY_STALE_TIME,
  });

  // ── Adapt query results ──────────────────────────────────────────────────────
  const usage = toSectionState(usageQuery);
  const tier  = toSectionState(tierQuery);

  // ── Filter actions ──────────────────────────────────────────────────────────
  const setFilters = useCallback((patch: Partial<MetricFilters>): void => {
    setFiltersState(prev => ({ ...prev, ...patch }));
  }, []);

  const clearFilters = useCallback((): void => {
    setFiltersState(DEFAULT_FILTERS);
  }, []);

  const refetchAll = useCallback((): void => {
    void usageQuery.refetch();
    void tierQuery.refetch();
  }, [usageQuery, tierQuery]);

  // ── Aggregate flags ─────────────────────────────────────────────────────────
  const sections     = [usage, tier];
  const isAnyLoading = sections.some(s => s.isLoading);
  const isAllError   = sections.every(s => s.error !== null);
  const isAnyStale   = sections.some(s => s.isStale);
  const firstError: ApiClientError | null =
    sections.find(s => s.error !== null && s.data === null)?.error ??
    sections.find(s => s.error !== null)?.error ??
    null;

  // ── Phase 1 empty state ─────────────────────────────────────────────────────
  const phase1Empty = useMemo(
    () => isXaiPhase1Empty(usage.data, tier.data),
    [usage.data, tier.data],
  );

  return {
    usage,
    tier,
    isAnyLoading,
    isAllError,
    isAnyStale,
    firstError,
    phase1Empty,
    filters,
    setFilters,
    clearFilters,
    refetchAll,
  };
}