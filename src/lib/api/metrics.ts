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
  StepCompletionBreakdown,
  OnboardingFunnelMetrics,
  PerformanceMetrics,
  ReliabilityMetrics,
  VariantConversionRow,
  ExperimentMetrics,
} from './metrics-types';

export type {
  MetricFilters,
  OverviewMetrics,
  ResumeFunnelMetrics,
  StepCompletionBreakdown,
  OnboardingFunnelMetrics,
  PerformanceMetrics,
  ReliabilityMetrics,
  VariantConversionRow,
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