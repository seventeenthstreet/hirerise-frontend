/**
 * @file lib/api/metrics.ts
 * @description API wrappers for the Analytics Dashboard endpoints.
 *
 * RULES (NON-NEGOTIABLE):
 *  - All requests go through apiRequest<T>() — no raw fetch, no axios direct calls
 *  - NO UI, NO business logic, NO state — pure transport + type mapping
 *  - All types derived from the approved Phase 2 Metrics Schema v4 Final
 *  - Filters passed as params; backend owns computation
 *
 * Architecture position: API layer (first tier)
 *   API → Hooks → UI → Pages → Guards → Context
 */

import { apiRequest } from './core';
import {
  resolveOverviewMetrics,
  resolveResumeFunnelMetrics,
  resolveOnboardingMetrics,
  resolvePerformanceMetrics,
  resolveReliabilityMetrics,
  resolveExperimentMetrics,
} from '@/lib/integrations/metricsAdapter';

// Shared metric types live in metrics-types.ts to break the circular chain:
//   metrics.ts → metricsAdapter → endpoints/metrics → metrics.ts
// Import here for local use; re-export below so all existing consumers
// importing from '@/lib/api/metrics' continue to work unchanged.
import type {
  MetricFilters,
  OverviewMetrics,
  ResumeFunnelMetrics,
  OnboardingFunnelMetrics,
  PerformanceMetrics,
  ReliabilityMetrics,
  ExperimentMetrics,
} from './metrics-types';

export type {
  MetricFilters,
  OverviewMetrics,
  ResumeFunnelMetrics,
  OnboardingFunnelMetrics,
  PerformanceMetrics,
  ReliabilityMetrics,
  ExperimentMetrics,
} from './metrics-types';

/**
 * Integration mode flag.
 * When true, API functions delegate to the metricsAdapter (external sources).
 * When false, API functions call the internal backend via apiRequest (original behavior).
 *
 * Set METRICS_INTEGRATION_ENABLED=true in your environment to enable.
 * The hook, UI, and alert layers have zero awareness of this flag.
 */
const INTEGRATION_ENABLED =
  process.env.METRICS_INTEGRATION_ENABLED === 'true';

// Interface definitions moved to ./metrics-types.ts to break the circular import.
// They are re-exported above so all existing import paths remain valid.

// ─────────────────────────────────────────────────────────────────────────────
// DEV-ONLY PARAM GUARD
//
// Stripped entirely by bundlers in production (dead-code elimination on the
// process.env.NODE_ENV !== 'production' branch). Zero runtime cost in prod.
//
// Catches the most common React Query misuse: closing over external filter
// state instead of reading params from queryKey.
//
//   ❌ queryFn: () => getResumeFunnelMetrics(filtersFromState)
//   ✅ queryFn: ({ queryKey, signal }) => {
//        const [, params] = queryKey as ReturnType<typeof QUERY_KEYS.metrics.funnel>;
//        return getResumeFunnelMetrics(params, signal);
//      }
// ─────────────────────────────────────────────────────────────────────────────

function warnInvalidParams(fnName: string, params: unknown): void {
  if (process.env.NODE_ENV !== 'production') {
    if (params != null && (typeof params !== 'object' || Array.isArray(params))) {
      console.warn(
        `[metrics.${fnName}] Expected filters to be a plain object or undefined. ` +
        `Got: ${typeof params}. ` +
        `Ensure params come from queryKey, not a closure over external state.`,
        params,
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API FUNCTIONS
//
// AbortSignal + params-coupling contract (enforced across all functions below):
//
//  1. SIGNAL THREADING: Every function accepts `signal?: AbortSignal` as its
//     second argument and forwards it into apiRequest({ ..., signal }). This
//     enables React Query automatic cancellation and manual AbortController
//     cancellation (used by useMetrics's per-batch AbortController).
//
//  2. PARAMS AS SINGLE SOURCE OF TRUTH: Functions receive `filters` as an
//     explicit argument — they NEVER close over external state. Callers are
//     responsible for passing the authoritative params at invocation time.
//
//     React Query usage pattern (when useQuery is introduced):
//       queryFn: ({ queryKey, signal }) => {
//         const [, params] = queryKey as ReturnType<typeof QUERY_KEYS.metrics.funnel>;
//         return metricsApi.getResumeFunnelMetrics(params, signal);
//       }
//     — extract params from queryKey (single source of truth), pass signal for
//       cancellation. Never close over external `filters` variables.
//
//     Current useMetrics pattern:
//       fetchSection('resumeFunnel', getResumeFunnelMetrics, setter, currentFilters, signal, force)
//     — currentFilters is passed explicitly into fetchSection → forwarded to the
//       fetcher. No stale closure; signal comes from the batch AbortController.
//
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/metrics/overview
 *
 * Returns headline metrics for the Overview section.
 * Superset of resume funnel + performance top-level numbers.
 */
export async function getOverviewMetrics(
  filters?: MetricFilters,
  signal?: AbortSignal,
): Promise<OverviewMetrics> {
  warnInvalidParams('getOverviewMetrics', filters);
  if (INTEGRATION_ENABLED) {
    return resolveOverviewMetrics(filters ?? {}, signal);
  }
  return apiRequest<OverviewMetrics>({
    method: 'GET',
    url: '/api/v1/metrics/overview',
    params: filters as Record<string, unknown>,
    signal,
  });
}

/**
 * GET /api/v1/metrics/resume-funnel
 *
 * Returns session-scoped resume upload and processing funnel metrics.
 * All rates are deduplicated on sessionId per v4 schema fixes.
 */
export async function getResumeFunnelMetrics(
  filters?: MetricFilters,
  signal?: AbortSignal,
): Promise<ResumeFunnelMetrics> {
  warnInvalidParams('getResumeFunnelMetrics', filters);
  if (INTEGRATION_ENABLED) {
    return resolveResumeFunnelMetrics(filters ?? {}, signal);
  }
  return apiRequest<ResumeFunnelMetrics>({
    method: 'GET',
    url: '/api/v1/metrics/resume-funnel',
    params: filters as Record<string, unknown>,
    signal,
  });
}

/**
 * GET /api/v1/metrics/onboarding
 *
 * Returns onboarding funnel metrics including per-step breakdown.
 */
export async function getOnboardingMetrics(
  filters?: MetricFilters,
  signal?: AbortSignal,
): Promise<OnboardingFunnelMetrics> {
  warnInvalidParams('getOnboardingMetrics', filters);
  if (INTEGRATION_ENABLED) {
    return resolveOnboardingMetrics(filters ?? {}, signal);
  }
  return apiRequest<OnboardingFunnelMetrics>({
    method: 'GET',
    url: '/api/v1/metrics/onboarding',
    params: filters as Record<string, unknown>,
    signal,
  });
}

/**
 * GET /api/v1/metrics/performance
 *
 * Returns processing latency percentiles, attempt stats, and time-to-value.
 * MICRO-FIX v3: time_to_value excludes upload_failed sessions.
 */
export async function getPerformanceMetrics(
  filters?: MetricFilters,
  signal?: AbortSignal,
): Promise<PerformanceMetrics> {
  warnInvalidParams('getPerformanceMetrics', filters);
  if (INTEGRATION_ENABLED) {
    return resolvePerformanceMetrics(filters ?? {}, signal);
  }
  return apiRequest<PerformanceMetrics>({
    method: 'GET',
    url: '/api/v1/metrics/performance',
    params: filters as Record<string, unknown>,
    signal,
  });
}

/**
 * GET /api/v1/metrics/reliability
 *
 * Returns reliability/error rate metrics.
 * MICRO-FIX v4: all denominators aligned to upload_started.
 */
export async function getReliabilityMetrics(
  filters?: MetricFilters,
  signal?: AbortSignal,
): Promise<ReliabilityMetrics> {
  warnInvalidParams('getReliabilityMetrics', filters);
  if (INTEGRATION_ENABLED) {
    return resolveReliabilityMetrics(filters ?? {}, signal);
  }
  return apiRequest<ReliabilityMetrics>({
    method: 'GET',
    url: '/api/v1/metrics/reliability',
    params: filters as Record<string, unknown>,
    signal,
  });
}

/**
 * GET /api/v1/metrics/experiments
 *
 * Returns flag exposure counts and conversion rates by variant.
 */
export async function getExperimentMetrics(
  filters?: MetricFilters,
  signal?: AbortSignal,
): Promise<ExperimentMetrics> {
  warnInvalidParams('getExperimentMetrics', filters);
  if (INTEGRATION_ENABLED) {
    return resolveExperimentMetrics(filters ?? {}, signal);
  }
  return apiRequest<ExperimentMetrics>({
    method: 'GET',
    url: '/api/v1/metrics/experiments',
    params: filters as Record<string, unknown>,
    signal,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// RE-EXPORTS FROM metrics-types.ts
// StepCompletionBreakdown and VariantConversionRow live in metrics-types.ts
// (the canonical type file). Re-exported here for backward compatibility with
// existing imports from @/lib/api/metrics.
// ─────────────────────────────────────────────────────────────────────────────
export type { StepCompletionBreakdown, VariantConversionRow } from './metrics-types';

// ─────────────────────────────────────────────────────────────────────────────
// WP-7 — XAI & SYSTEM HEALTH API FUNCTIONS
//
// RULES (inherited from this file):
//   - All requests go through apiRequest<T>()
//   - NO UI, NO business logic, NO state — pure transport + type mapping
//
// INTEGRATION FLAG:
//   INTEGRATION_ENABLED is intentionally NOT applied to these three functions.
//   The XAI and system-health endpoints live only on the hirerise-core backend.
//   The metricsAdapter integration path is not used for these endpoints.
//   WP-13 replaces the backend stub implementations, not this API layer.
//
// WP-13 COMPATIBILITY:
//   When WP-13 replaces the backend stubs with real service calls the endpoint
//   paths, response types, and function signatures here are all unchanged.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  XaiUsageMetrics,
  XaiTierDistributionMetrics,
  SystemHealthResponse,
} from './metrics-types';

export type {
  XaiUsageMetrics,
  XaiTierDistributionMetrics,
  SystemHealthResponse,
} from './metrics-types';

/**
 * GET /api/v1/metrics/xai-usage
 *
 * Returns XAI explanation pipeline usage and latency metrics.
 * Phase 1: all numeric fields are 0 (zero-value stub).
 * WP-13 will replace the backend stub with real aggregation.
 *
 * @param filters - Optional date range and segment filters.
 * @param signal  - Optional AbortSignal for request cancellation.
 * @throws {ApiClientError} On network failure or backend error.
 */
export async function getXaiUsageMetrics(
  filters?: MetricFilters,
  signal?: AbortSignal,
): Promise<XaiUsageMetrics> {
  warnInvalidParams('getXaiUsageMetrics', filters);
  return apiRequest<XaiUsageMetrics>({
    method: 'GET',
    url:    '/api/v1/metrics/xai-usage',
    params: filters as Record<string, unknown>,
    signal,
  });
}

/**
 * GET /api/v1/metrics/xai-tier
 *
 * Returns XAI tier distribution and ai_augmentation exposure rate.
 * Phase 1: all tier counts and exposure rate are 0 (zero-value stub).
 * WP-13 will replace the backend stub with real scorecard aggregation.
 *
 * @param filters - Optional date range and segment filters.
 * @param signal  - Optional AbortSignal for request cancellation.
 * @throws {ApiClientError} On network failure or backend error.
 */
export async function getXaiTierMetrics(
  filters?: MetricFilters,
  signal?: AbortSignal,
): Promise<XaiTierDistributionMetrics> {
  warnInvalidParams('getXaiTierMetrics', filters);
  return apiRequest<XaiTierDistributionMetrics>({
    method: 'GET',
    url:    '/api/v1/metrics/xai-tier',
    params: filters as Record<string, unknown>,
    signal,
  });
}

/**
 * GET /api/v1/system/health
 *
 * Returns a lightweight system health snapshot.
 * Phase 1: status is always 'healthy', error_rate_24h is 0.
 * WP-13 will wire real Firestore / Claude API connectivity probes.
 *
 * No filters accepted — health is always a point-in-time snapshot.
 *
 * @param signal - Optional AbortSignal for request cancellation.
 * @throws {ApiClientError} On network failure. The backend catches its own
 *   errors and returns a 200 degraded response, so true 5xx is rare here.
 */
export async function getSystemHealth(
  signal?: AbortSignal,
): Promise<SystemHealthResponse> {
  return apiRequest<SystemHealthResponse>({
    method: 'GET',
    url:    '/api/v1/system/health',
    signal,
  });
}