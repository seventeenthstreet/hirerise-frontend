/**
 * @file hooks/useMetrics.ts
 * @description Central hook for the Analytics Dashboard data layer.
 *
 * RESPONSIBILITIES (hooks layer only):
 *  - Fetch all metric sections in parallel via React Query
 *  - Manage loading / error / retry state per section
 *  - Accept and apply MetricFilters (date range, user_type, variant)
 *  - Compute derived metrics from already-loaded section data
 *  - Surface stable, typed data to the page layer
 *
 * HARD RULES:
 *  - NO UI logic — pure data + state management
 *  - NO direct fetch / axios — always through lib/api/metrics.ts functions
 *  - Errors are ApiClientError instances — never raw
 *  - Filters live here, NOT in components — UI only calls setFilters()
 *  - NO external libraries or global state
 *
 * v4 — React Query migration:
 *  Manual fetching (fetchSection, useEffect, AbortController, cacheRef) replaced
 *  with one useQuery call per section. React Query owns:
 *    - caching (staleTime / gcTime from queryClient.ts)
 *    - background revalidation on window focus (refetchOnWindowFocus)
 *    - AbortSignal threading (signal from queryFn context)
 *    - per-section loading / error state
 *    - retry logic (shouldRetry / retryDelay from queryClient.ts)
 *
 *  allMetricsCacheRef is preserved (read-only ref, same shape) and populated
 *  from query data in a useEffect so external consumers (export, diff) can
 *  still read the whole-response snapshot without API changes.
 *
 *  Everything else — derived metrics, formattedDerived, comparison, alerts,
 *  ComparisonResult, UseMetricsReturn — is UNCHANGED.
 *
 * Architecture position: Hooks layer (second tier)
 *   API → Hooks → UI → Pages → Guards → Context
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ApiClientError } from '@/lib/api/core';
import {
  getOverviewMetrics,
  getResumeFunnelMetrics,
  getOnboardingMetrics,
  getPerformanceMetrics,
  getReliabilityMetrics,
  getExperimentMetrics,
} from '@/lib/api/metrics';
import type {
  MetricFilters,
  OverviewMetrics,
  ResumeFunnelMetrics,
  OnboardingFunnelMetrics,
  PerformanceMetrics,
  ReliabilityMetrics,
  ExperimentMetrics,
} from '@/lib/api/metrics';
import {
  computeDelta,
  computeTrend,
  formatPercentage,
  formatDuration,
} from '@/lib/metricsTransform';
import {
  evaluateAlerts,
} from '@/lib/alerts';
import type { Alert, AlertMetricsInput } from '@/lib/alerts';
import { queryKeys, QUERY_STALE_TIME } from '@/lib/query';

// ─────────────────────────────────────────────────────────────────────────────
// STALE TIME
// Re-exported for any consumer that previously imported STALE_TIME from here.
// Value is sourced from queryClient.ts — one source of truth.
// ─────────────────────────────────────────────────────────────────────────────

export const STALE_TIME = QUERY_STALE_TIME;

// ─────────────────────────────────────────────────────────────────────────────
// WHOLE-RESPONSE CACHE (shape preserved — now populated from query data)
// ─────────────────────────────────────────────────────────────────────────────

export type AllMetricsData = {
  overview:     OverviewMetrics         | null;
  resumeFunnel: ResumeFunnelMetrics     | null;
  onboarding:   OnboardingFunnelMetrics | null;
  performance:  PerformanceMetrics      | null;
  reliability:  ReliabilityMetrics      | null;
  experiments:  ExperimentMetrics       | null;
};

export type AllMetricsCacheEntry = {
  data:      AllMetricsData;
  /** Unix timestamp (ms) when this whole-response snapshot was written. */
  timestamp: number;
};

type AllMetricsCacheMap = Map<string, AllMetricsCacheEntry>;

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT INTELLIGENCE — TIME COMPARISON  (Part 1, UNCHANGED)
// ─────────────────────────────────────────────────────────────────────────────

export interface ComparisonFilters {
  date_from_compare: string;
  date_to_compare:   string;
}

export interface MetricComparison {
  value:    number;
  previous: number | null;
  delta:    number | null;
  trend:    'up' | 'down' | 'neutral' | null;
}

export interface ComparisonResult {
  end_to_end_conversion_rate: MetricComparison;
  resume_failure_rate:        MetricComparison;
  timeout_rate:               MetricComparison;
  onboarding_completion_rate: MetricComparison;
  processing_p95_ms:          MetricComparison;
  time_to_value_p50_ms:       MetricComparison;
  upload_success_rate:        MetricComparison;
  upload_start_count:         MetricComparison;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION-LEVEL ASYNC STATE
// Shape is unchanged — now built from useQuery results instead of useState.
// ─────────────────────────────────────────────────────────────────────────────

export interface MetricSectionState<T> {
  data:          T | null;
  isLoading:     boolean;
  error:         ApiClientError | null;
  /**
   * True when React Query is background-refetching stale data.
   * Maps to: query.isLoading === false && query.isFetching === true
   */
  isStale:       boolean;
  /**
   * Unix timestamp (ms) of the last successful fetch.
   * Maps to query.dataUpdatedAt. 0 before first successful fetch.
   */
  dataUpdatedAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// DERIVED METRICS TYPE (UNCHANGED)
// ─────────────────────────────────────────────────────────────────────────────

export interface DerivedMetrics {
  processingDropOffRate: number | null;
  uploadDropOffRate:     number | null;
  overallHealthScore:    number | null;
  onboardingResumeGap:   number | null;
  p95OverP50Ratio:       number | null;
  estimatedRetryWaste:   number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK RETURN TYPE (UNCHANGED)
// ─────────────────────────────────────────────────────────────────────────────

export interface UseMetricsReturn {
  overview:     MetricSectionState<OverviewMetrics>;
  resumeFunnel: MetricSectionState<ResumeFunnelMetrics>;
  onboarding:   MetricSectionState<OnboardingFunnelMetrics>;
  performance:  MetricSectionState<PerformanceMetrics>;
  reliability:  MetricSectionState<ReliabilityMetrics>;
  experiments:  MetricSectionState<ExperimentMetrics>;
  derived:      DerivedMetrics;
  formattedDerived: {
    processingDropOffRate: string;
    uploadDropOffRate:     string;
    overallHealthScore:    string;
    onboardingResumeGap:   string;
    p95OverP50Ratio:       string;
    estimatedRetryWaste:   string;
    healthScoreDelta:      string;
    processingP50:         string;
    timeToValueP50:        string;
  };
  isAnyLoading: boolean;
  isAllError:   boolean;
  firstError:   ApiClientError | null;
  isAnyStale:   boolean;
  filters:      MetricFilters;
  setFilters:   (patch: Partial<MetricFilters>) => void;
  clearFilters: () => void;
  refetchAll:   () => void;
  comparisonFilters:      ComparisonFilters | null;
  setComparisonFilters:   (cf: ComparisonFilters) => void;
  clearComparisonFilters: () => void;
  comparison:   ComparisonResult;
  alerts:       Alert[];
  allMetricsCacheRef: React.RefObject<AllMetricsCacheMap>;
}

// ─────────────────────────────────────────────────────────────────────────────
// PURE HELPERS (UNCHANGED)
// ─────────────────────────────────────────────────────────────────────────────

function buildMetricComparison(
  current:  number | null | undefined,
  previous: number | null | undefined,
  threshold = 0.001,
): MetricComparison {
  const value = current  ?? 0;
  const prev  = previous ?? null;
  const delta = prev !== null ? computeDelta(value, prev)            : null;
  const trend = prev !== null ? computeTrend(value, prev, threshold) : null;
  return { value, previous: prev, delta, trend };
}

function buildComparisonResult(
  current:  AllMetricsData,
  previous: AllMetricsData | null,
): ComparisonResult {
  const p = previous;
  return {
    end_to_end_conversion_rate: buildMetricComparison(
      current.resumeFunnel?.end_to_end_conversion_rate,
      p?.resumeFunnel?.end_to_end_conversion_rate,
    ),
    resume_failure_rate: buildMetricComparison(
      current.reliability?.resume_failure_rate,
      p?.reliability?.resume_failure_rate,
    ),
    timeout_rate: buildMetricComparison(
      current.reliability?.timeout_rate,
      p?.reliability?.timeout_rate,
    ),
    onboarding_completion_rate: buildMetricComparison(
      current.onboarding?.onboarding_completion_rate,
      p?.onboarding?.onboarding_completion_rate,
    ),
    processing_p95_ms: buildMetricComparison(
      current.performance?.processing_p95_ms,
      p?.performance?.processing_p95_ms,
      50,
    ),
    time_to_value_p50_ms: buildMetricComparison(
      current.performance?.time_to_value_p50_ms,
      p?.performance?.time_to_value_p50_ms,
      500,
    ),
    upload_success_rate: buildMetricComparison(
      current.resumeFunnel?.upload_success_rate,
      p?.resumeFunnel?.upload_success_rate,
    ),
    upload_start_count: buildMetricComparison(
      current.resumeFunnel?.upload_start_count,
      p?.resumeFunnel?.upload_start_count,
      1,
    ),
  };
}

function buildAlertInput(data: AllMetricsData): AlertMetricsInput {
  return {
    overview:     data.overview,
    resumeFunnel: data.resumeFunnel,
    onboarding:   data.onboarding,
    performance:  data.performance,
    reliability:  data.reliability,
    experiments:  data.experiments,
  };
}

function computeDerived(
  rf: ResumeFunnelMetrics     | null,
  ob: OnboardingFunnelMetrics | null,
  pf: PerformanceMetrics      | null,
  rl: ReliabilityMetrics      | null,
): DerivedMetrics {
  const processingDropOffRate =
    rf != null ? Math.max(0, rf.upload_success_rate - rf.end_to_end_conversion_rate) : null;

  const uploadDropOffRate =
    rf != null ? Math.max(0, 1 - rf.upload_success_rate) : null;

  const overallHealthScore =
    rf != null && rl != null
      ? Math.min(1, Math.max(0,
          0.6 * rf.end_to_end_conversion_rate +
          0.2 * (1 - rl.resume_failure_rate) +
          0.2 * (1 - rl.timeout_rate),
        ))
      : null;

  const onboardingResumeGap =
    ob != null && rf != null
      ? ob.onboarding_completion_rate - rf.end_to_end_conversion_rate
      : null;

  const p95OverP50Ratio =
    pf != null && pf.processing_p50_ms > 0
      ? pf.processing_p95_ms / pf.processing_p50_ms
      : null;

  const estimatedRetryWaste =
    rf != null
      ? Math.round(rf.upload_start_count * (1 - rf.retry_success_rate) * rf.timeout_rate)
      : null;

  return {
    processingDropOffRate,
    uploadDropOffRate,
    overallHealthScore,
    onboardingResumeGap,
    p95OverP50Ratio,
    estimatedRetryWaste,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY KEY PARAM EXTRACTOR
//
// Always reads the last element of the queryKey array — the position where
// every queryKeys.metrics.section() key stores the filters object.
//
// WHY: positional destructuring (`const [,,,params] = queryKey`) breaks
// silently if the key hierarchy ever gains or loses a segment. Reading from
// the tail is robust to any future restructuring and removes the magic index.
// ─────────────────────────────────────────────────────────────────────────────

function getParamsFromQueryKey<T = unknown>(queryKey: readonly unknown[]): T | undefined {
  const value = queryKey[queryKey.length - 1] as T | undefined;

  if (process.env.NODE_ENV !== 'production') {
    if (
      value != null &&
      (typeof value !== 'object' || Array.isArray(value))
    ) {
      console.warn(
        '[useMetrics] queryKey params must be a plain object. ' +
        'Ensure params come from queryKey and not a closure.',
        value,
      );
    }
  }

  return value;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION STATE ADAPTER
// Converts a useQuery result into the MetricSectionState shape the return
// contract requires. Keeps the mapping in one place — callers are identical.
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
    // isStale: delegated entirely to React Query's own staleness tracking.
    // React Query sets this based on staleTime configured in queryClient.ts —
    // no need to approximate it from isFetched + isFetching here.
    isStale:       query.isStale,
    error:         query.error as ApiClientError | null,
    dataUpdatedAt: query.dataUpdatedAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: MetricFilters = { grain: 'weekly' };

// ─────────────────────────────────────────────────────────────────────────────
// SNAPSHOT HELPER (unchanged — used by setSnapshotValue in comparison fetch)
// ─────────────────────────────────────────────────────────────────────────────

function setSnapshotValue<K extends keyof AllMetricsData>(
  snapshot: AllMetricsData,
  key: K,
  value: AllMetricsData[K],
): void {
  snapshot[key] = value;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useMetrics(): UseMetricsReturn {
  // ── Filter state ──────────────────────────────────────────────────────────
  const [filters, setFiltersState] = useState<MetricFilters>(DEFAULT_FILTERS);

  // ── Whole-response cache ref (preserved shape — populated via useEffect) ──
  const allMetricsCacheRef = useRef<AllMetricsCacheMap>(new Map());

  // ── Product Intelligence — Comparison state  (Part 1) ────────────────────
  const [comparisonFilters, setComparisonFiltersState] =
    useState<ComparisonFilters | null>(null);
  const [previousData, setPreviousData] = useState<AllMetricsData | null>(null);

  // Separate abort controller for comparison fetches only.
  const comparisonAbortRef = useRef<AbortController | null>(null);

  // Stable ref so the comparison effect always reads current filters dims.
  const filtersRef = useRef<MetricFilters>(filters);
  useEffect(() => { filtersRef.current = filters; }, [filters]);

  // ─────────────────────────────────────────────────────────────────────────
  // PRIMARY QUERIES — one useQuery per section
  //
  // queryKey includes filters so React Query re-fetches whenever filters
  // change, caches independently per filter combo, and supports targeted
  // invalidation (queryKeys.metrics.sections() busts all six at once).
  //
  // Params are always read from queryKey — never closed over from outer scope.
  // This satisfies the params-as-single-source-of-truth contract documented
  // in the API layer and detected by the dev-only warnInvalidParams guard.
  //
  // signal is forwarded from the queryFn context — React Query creates and
  // cancels it automatically when the query is superseded or the component
  // unmounts, replacing the manual AbortController / abortRef pattern.
  // ─────────────────────────────────────────────────────────────────────────

  const overviewQuery = useQuery({
    queryKey: queryKeys.metrics.section('overview', filters),
    queryFn: ({ queryKey, signal }) => {
      const params = getParamsFromQueryKey<MetricFilters>(queryKey);
      return getOverviewMetrics(params, signal);
    },
  });

  const funnelQuery = useQuery({
    queryKey: queryKeys.metrics.section('funnel', filters),
    queryFn: ({ queryKey, signal }) => {
      const params = getParamsFromQueryKey<MetricFilters>(queryKey);
      return getResumeFunnelMetrics(params, signal);
    },
  });

  const onboardingQuery = useQuery({
    queryKey: queryKeys.metrics.section('onboarding', filters),
    queryFn: ({ queryKey, signal }) => {
      const params = getParamsFromQueryKey<MetricFilters>(queryKey);
      return getOnboardingMetrics(params, signal);
    },
  });

  const performanceQuery = useQuery({
    queryKey: queryKeys.metrics.section('performance', filters),
    queryFn: ({ queryKey, signal }) => {
      const params = getParamsFromQueryKey<MetricFilters>(queryKey);
      return getPerformanceMetrics(params, signal);
    },
  });

  const reliabilityQuery = useQuery({
    queryKey: queryKeys.metrics.section('reliability', filters),
    queryFn: ({ queryKey, signal }) => {
      const params = getParamsFromQueryKey<MetricFilters>(queryKey);
      return getReliabilityMetrics(params, signal);
    },
  });

  const experimentsQuery = useQuery({
    queryKey: queryKeys.metrics.section('experiments', filters),
    queryFn: ({ queryKey, signal }) => {
      const params = getParamsFromQueryKey<MetricFilters>(queryKey);
      return getExperimentMetrics(params, signal);
    },
  });

  // ── Adapt query results to MetricSectionState shape ───────────────────────
  const overview     = toSectionState(overviewQuery);
  const resumeFunnel = toSectionState(funnelQuery);
  const onboarding   = toSectionState(onboardingQuery);
  const performance  = toSectionState(performanceQuery);
  const reliability  = toSectionState(reliabilityQuery);
  const experiments  = toSectionState(experimentsQuery);

  // ── Whole-response cache ref — kept alive for external consumers ──────────
  // Populated whenever all six queries have settled (at least one data or error).
  // Uses the same AllMetricsCacheEntry shape as before — consumer API unchanged.
  useEffect(() => {
    // Only write a snapshot once all six have exited their initial loading state.
    const allSettled = [
      overviewQuery, funnelQuery, onboardingQuery,
      performanceQuery, reliabilityQuery, experimentsQuery,
    ].every(q => !q.isLoading);

    if (!allSettled) return;

    const snapshot: AllMetricsData = {
      overview:     overviewQuery.data     ?? null,
      resumeFunnel: funnelQuery.data       ?? null,
      onboarding:   onboardingQuery.data   ?? null,
      performance:  performanceQuery.data  ?? null,
      reliability:  reliabilityQuery.data  ?? null,
      experiments:  experimentsQuery.data  ?? null,
    };

    allMetricsCacheRef.current.set(
      JSON.stringify(filters),
      { data: snapshot, timestamp: Date.now() },
    );
  }, [
    filters,
    overviewQuery.data,     overviewQuery.isLoading,
    funnelQuery.data,       funnelQuery.isLoading,
    onboardingQuery.data,   onboardingQuery.isLoading,
    performanceQuery.data,  performanceQuery.isLoading,
    reliabilityQuery.data,  reliabilityQuery.isLoading,
    experimentsQuery.data,  experimentsQuery.isLoading,
  ]);

  // ── Product Intelligence — Comparison fetch  (Part 1, UNCHANGED logic) ───
  // This path was already a manual parallel fetch — it remains so because it
  // needs custom filter merging (primary dims + comparison dates) that doesn't
  // map cleanly to a static queryKey. Converting it to useQuery would require
  // a separate queryKey factory or dynamic enabled logic; keeping it manual
  // is simpler and has no impact on the primary React Query migration.
  useEffect(() => {
    if (!comparisonFilters) {
      comparisonAbortRef.current?.abort();
      setPreviousData(null);
      return;
    }

    comparisonAbortRef.current?.abort();
    const controller = new AbortController();
    comparisonAbortRef.current = controller;
    const { signal } = controller;

    const cf: MetricFilters = {
      ...filtersRef.current,
      date_from: comparisonFilters.date_from_compare,
      date_to:   comparisonFilters.date_to_compare,
    };

    const sectionFetches: Promise<{ key: keyof AllMetricsData; data: unknown }>[] = [
      getOverviewMetrics(cf, signal)
        .then(data => ({ key: 'overview'     as const, data })),
      getResumeFunnelMetrics(cf, signal)
        .then(data => ({ key: 'resumeFunnel' as const, data })),
      getOnboardingMetrics(cf, signal)
        .then(data => ({ key: 'onboarding'   as const, data })),
      getPerformanceMetrics(cf, signal)
        .then(data => ({ key: 'performance'  as const, data })),
      getReliabilityMetrics(cf, signal)
        .then(data => ({ key: 'reliability'  as const, data })),
      getExperimentMetrics(cf, signal)
        .then(data => ({ key: 'experiments'  as const, data })),
    ];

    Promise.allSettled(sectionFetches).then(results => {
      if (signal.aborted) return;

      const snapshot: AllMetricsData = {
        overview:     null,
        resumeFunnel: null,
        onboarding:   null,
        performance:  null,
        reliability:  null,
        experiments:  null,
      };

      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { key, data } = result.value;
          setSnapshotValue(snapshot, key, data as AllMetricsData[typeof key]);
        }
      }

      setPreviousData(snapshot);
    });

    return () => { comparisonAbortRef.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparisonFilters, filters]);

  // ── Filter actions ────────────────────────────────────────────────────────
  // setFilters updates the filters state, which changes every queryKey →
  // React Query automatically re-fetches all six sections. No manual trigger.
  const setFilters = useCallback((patch: Partial<MetricFilters>): void => {
    setFiltersState(prev => ({ ...prev, ...patch }));
  }, []);

  const clearFilters = useCallback((): void => {
    setFiltersState(DEFAULT_FILTERS);
  }, []);

  // ── Comparison filter actions (UNCHANGED) ─────────────────────────────────
  const setComparisonFilters = useCallback((cf: ComparisonFilters): void => {
    setComparisonFiltersState(cf);
  }, []);

  const clearComparisonFilters = useCallback((): void => {
    setComparisonFiltersState(null);
  }, []);

  // ── Manual force-refetch ──────────────────────────────────────────────────
  // Calls .refetch() on all six queries. React Query bypasses staleTime and
  // fires a fresh network request for each, equivalent to forceRefresh=true.
  const refetchAll = useCallback((): void => {
    void overviewQuery.refetch();
    void funnelQuery.refetch();
    void onboardingQuery.refetch();
    void performanceQuery.refetch();
    void reliabilityQuery.refetch();
    void experimentsQuery.refetch();
  }, [
    overviewQuery, funnelQuery, onboardingQuery,
    performanceQuery, reliabilityQuery, experimentsQuery,
  ]);

  // ── Derived metrics (UNCHANGED) ───────────────────────────────────────────
  const derived = useMemo(
    () => computeDerived(
      resumeFunnel.data,
      onboarding.data,
      performance.data,
      reliability.data,
    ),
    [resumeFunnel.data, onboarding.data, performance.data, reliability.data],
  );

  // ── Formatted derived metrics (UNCHANGED) ─────────────────────────────────
  const formattedDerived = useMemo(() => ({
    processingDropOffRate: derived.processingDropOffRate != null
      ? formatPercentage(derived.processingDropOffRate) : '',
    uploadDropOffRate: derived.uploadDropOffRate != null
      ? formatPercentage(derived.uploadDropOffRate) : '',
    overallHealthScore: derived.overallHealthScore != null
      ? formatPercentage(derived.overallHealthScore) : '',
    onboardingResumeGap: derived.onboardingResumeGap != null
      ? formatPercentage(Math.abs(derived.onboardingResumeGap)) : '',
    p95OverP50Ratio: derived.p95OverP50Ratio != null
      ? `${derived.p95OverP50Ratio.toFixed(2)}×` : '',
    estimatedRetryWaste: derived.estimatedRetryWaste != null
      ? String(derived.estimatedRetryWaste) : '',
    healthScoreDelta: derived.overallHealthScore != null
      ? formatPercentage(Math.abs(computeDelta(derived.overallHealthScore, 1.0))) : '',
    processingP50: performance.data?.processing_p50_ms != null
      ? formatDuration(performance.data.processing_p50_ms) : '',
    timeToValueP50: performance.data?.time_to_value_p50_ms != null
      ? formatDuration(performance.data.time_to_value_p50_ms) : '',
  }), [derived, performance.data]);

  // ── Comparison result (UNCHANGED) ─────────────────────────────────────────
  const currentSnapshot = useMemo<AllMetricsData>(() => ({
    overview:     overview.data,
    resumeFunnel: resumeFunnel.data,
    onboarding:   onboarding.data,
    performance:  performance.data,
    reliability:  reliability.data,
    experiments:  experiments.data,
  }), [
    overview.data, resumeFunnel.data, onboarding.data,
    performance.data, reliability.data, experiments.data,
  ]);

  const comparison = useMemo(
    () => buildComparisonResult(currentSnapshot, previousData),
    [currentSnapshot, previousData],
  );

  // ── Alert evaluation (UNCHANGED) ──────────────────────────────────────────
  const alerts = useMemo(
    () => evaluateAlerts(buildAlertInput(currentSnapshot)),
    [currentSnapshot],
  );

  // ── Aggregate flags ───────────────────────────────────────────────────────
  const sections     = [overview, resumeFunnel, onboarding, performance, reliability, experiments];
  const isAnyLoading = sections.some(s => s.isLoading);
  const isAllError   = sections.every(s => s.error !== null);
  const isAnyStale   = sections.some(s => s.isStale);
  const firstError: ApiClientError | null =
    sections.find(s => s.error !== null && s.data === null)?.error ??
    sections.find(s => s.error !== null)?.error ??
    null;

  return {
    overview,
    resumeFunnel,
    onboarding,
    performance,
    reliability,
    experiments,
    derived,
    formattedDerived,
    isAnyLoading,
    isAllError,
    isAnyStale,
    firstError,
    filters,
    setFilters,
    clearFilters,
    refetchAll,
    allMetricsCacheRef,
    comparisonFilters,
    setComparisonFilters,
    clearComparisonFilters,
    comparison,
    alerts,
  };
}