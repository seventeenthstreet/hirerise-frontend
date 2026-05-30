/**
 * @file src/lib/api/endpoints/metrics.ts
 * @description Typed endpoint functions for all Analytics Dashboard API routes.
 *
 * ARCHITECTURE POSITION:
 *   core (apiRequest) → client (apiClient) → endpoints/metrics → hooks → UI
 *
 * RULES (NON-NEGOTIABLE):
 *  - No try/catch — errors are ApiClientError; they must propagate to React Query.
 *  - No parsing logic — all parsing lives in core/api-parser.ts.
 *  - No business logic, state, or UI concerns.
 *  - Only delegate to apiClient with typed generics.
 *  - All return types are explicit — never inferred from apiClient alone.
 *
 * REACT QUERY USAGE:
 *  Each function is a valid `queryFn` — call directly inside useQuery:
 *
 *  @example
 *  useQuery({
 *    queryKey: QUERY_KEYS.metrics.overview(),
 *    queryFn:  metricsApi.getOverview,
 *  });
 *
 *  With filters:
 *  @example
 *  useQuery({
 *    queryKey: QUERY_KEYS.metrics.funnel(filters),
 *    queryFn:  ({ queryKey }) => {
 *      const [, params] = queryKey;
 *      return metricsApi.getFunnel(params); // ✅ params from queryKey, not closure
 *    },
 *  });
 */

import { apiClient } from '@/lib/api/client';

// ─────────────────────────────────────────────────────────────────────────────
// RE-EXPORTED TYPES
// Imported from the canonical metrics.ts so there is ONE source of truth.
// Endpoints layer owns no type definitions — it only delegates.
// ─────────────────────────────────────────────────────────────────────────────

// Imported from metrics-types.ts (not metrics.ts) to break the circular chain:
//   endpoints/metrics.ts → lib/api/metrics → metricsAdapter → endpoints/metrics
export type {
  OverviewMetrics,
  ResumeFunnelMetrics,
  OnboardingFunnelMetrics,
  PerformanceMetrics,
  ReliabilityMetrics,
  ExperimentMetrics,
  MetricFilters,
  StepCompletionBreakdown,
} from '@/lib/api/metrics-types';

import type {
  OverviewMetrics,
  ResumeFunnelMetrics,
  OnboardingFunnelMetrics,
  PerformanceMetrics,
  ReliabilityMetrics,
  ExperimentMetrics,
  MetricFilters,
} from '@/lib/api/metrics-types';

// ─────────────────────────────────────────────────────────────────────────────
// DEV-ONLY PARAM GUARD
//
// Stripped entirely by bundlers in production (dead-code elimination on the
// process.env.NODE_ENV !== 'production' branch). Zero runtime cost in prod.
//
// Catches the most common React Query misuse: closing over external filter
// state instead of reading params from queryKey.
//
//   ❌ queryFn: () => metricsApi.getFunnel(filtersFromState)
//   ✅ queryFn: ({ queryKey }) => { const [, p] = queryKey; return metricsApi.getFunnel(p); }
// ─────────────────────────────────────────────────────────────────────────────

function warnInvalidParams(fnName: string, params: unknown): void {
  if (process.env.NODE_ENV !== 'production') {
    if (params != null && (typeof params !== 'object' || Array.isArray(params))) {
      console.warn(
        `[metricsApi.${fnName}] Expected params to be a plain object or undefined. ` +
        `Got: ${typeof params}. ` +
        `Ensure params come from queryKey, not a closure over external state.`,
        params,
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Metrics API endpoint registry.
 *
 * All functions:
 *  - Accept an optional `filters` object (appended as query-string params).
 *  - Return a typed Promise that resolves to raw metric data from the backend.
 *  - Throw `ApiClientError` on any failure (network, HTTP error, parse error).
 *
 * These are thin wrappers — zero business logic lives here.
 * The hooks layer owns filtering, caching, mapping, and derived state.
 */
export const metricsApi = {
  /**
   * GET /api/v1/metrics/overview
   *
   * Headline KPIs: end-to-end conversion rate, time-to-value percentiles,
   * and resume failure rate. Used by the Overview section of the dashboard.
   *
   * @param filters - Optional date range and segment filters.
   * @throws {ApiClientError} On network failure or backend error.
   */
  getOverview: (filters?: MetricFilters): Promise<OverviewMetrics> => {
    warnInvalidParams('getOverview', filters);
    return apiClient<OverviewMetrics>({
      url:    '/api/v1/metrics/overview',
      params: filters as Record<string, unknown> | undefined,
    });
  },

  /**
   * GET /api/v1/metrics/resume-funnel
   *
   * Resume upload and processing funnel: upload start count, upload success
   * rate, processing success rate, end-to-end conversion, timeout rate,
   * and retry success rate.
   *
   * @param filters - Optional date range and segment filters.
   * @throws {ApiClientError} On network failure or backend error.
   */
  getFunnel: (filters?: MetricFilters): Promise<ResumeFunnelMetrics> => {
    warnInvalidParams('getFunnel', filters);
    return apiClient<ResumeFunnelMetrics>({
      url:    '/api/v1/metrics/resume-funnel',
      params: filters as Record<string, unknown> | undefined,
    });
  },

  /**
   * GET /api/v1/metrics/onboarding
   *
   * Onboarding funnel metrics: start count, completion rate, per-step
   * completion rates and error rates.
   *
   * @param filters - Optional date range and segment filters.
   * @throws {ApiClientError} On network failure or backend error.
   */
  getOnboarding: (filters?: MetricFilters): Promise<OnboardingFunnelMetrics> => {
    warnInvalidParams('getOnboarding', filters);
    return apiClient<OnboardingFunnelMetrics>({
      url:    '/api/v1/metrics/onboarding',
      params: filters as Record<string, unknown> | undefined,
    });
  },

  /**
   * GET /api/v1/metrics/performance
   *
   * Processing latency percentiles (p50/p95/p99), average upload duration,
   * average attempts per resume, and time-to-value percentiles.
   *
   * @param filters - Optional date range and segment filters.
   * @throws {ApiClientError} On network failure or backend error.
   */
  getPerformance: (filters?: MetricFilters): Promise<PerformanceMetrics> => {
    warnInvalidParams('getPerformance', filters);
    return apiClient<PerformanceMetrics>({
      url:    '/api/v1/metrics/performance',
      params: filters as Record<string, unknown> | undefined,
    });
  },

  /**
   * GET /api/v1/metrics/reliability
   *
   * Reliability and error metrics: resume failure rate, timeout rate,
   * retry success rate, errors per 100 sessions, monitoring and onboarding
   * error rates.
   *
   * @param filters - Optional date range and segment filters.
   * @throws {ApiClientError} On network failure or backend error.
   */
  getReliability: (filters?: MetricFilters): Promise<ReliabilityMetrics> => {
    warnInvalidParams('getReliability', filters);
    return apiClient<ReliabilityMetrics>({
      url:    '/api/v1/metrics/reliability',
      params: filters as Record<string, unknown> | undefined,
    });
  },

  /**
   * GET /api/v1/metrics/experiments
   *
   * Experiment / feature-flag metrics: flag exposure counts by variant,
   * variant conversion rates, and relative lift vs. control.
   *
   * @param filters - Optional date range and segment filters.
   * @throws {ApiClientError} On network failure or backend error.
   */
  getExperiments: (filters?: MetricFilters): Promise<ExperimentMetrics> => {
    warnInvalidParams('getExperiments', filters);
    return apiClient<ExperimentMetrics>({
      url:    '/api/v1/metrics/experiments',
      params: filters as Record<string, unknown> | undefined,
    });
  },
} as const;