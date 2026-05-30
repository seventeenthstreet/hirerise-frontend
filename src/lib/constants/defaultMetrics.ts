/**
 * @file lib/constants/defaultMetrics.ts
 * @description Centralized safe defaults for all MetricsResponse sections.
 *
 * RULES (NON-NEGOTIABLE):
 *  - This is the SINGLE source of truth for zero/empty metric fallbacks
 *  - Used by: metricsAdapter (full fallback), metricsMapper (section fallback)
 *  - Values are intentionally zero/empty so alert thresholds never false-fire
 *  - NEVER import from hooks, UI, or pages
 *  - NEVER define defaults inline in adapter or mapper - import from here
 *
 * USAGE:
 *  import { SAFE_DEFAULT_METRICS, DEFAULT_OVERVIEW } from '@/lib/constants/defaultMetrics';
 */

import type {
  OverviewMetrics,
  ResumeFunnelMetrics,
  OnboardingFunnelMetrics,
  PerformanceMetrics,
  ReliabilityMetrics,
  ExperimentMetrics,
} from '@/lib/api/metrics';

import type { MappedMetrics } from '@/types/internal/mappedMetrics';

export const DEFAULT_OVERVIEW: OverviewMetrics = {
  resume_end_to_end_conversion_rate: 0,
  time_to_value_p50_ms:              0,
  time_to_value_p95_ms:              0,
  resume_failure_rate:               0,
} as const;

export const DEFAULT_RESUME_FUNNEL: ResumeFunnelMetrics = {
  upload_start_count:           0,
  upload_success_rate:          0,
  processing_success_rate:      0,
  end_to_end_conversion_rate:   0,
  timeout_rate:                 0,
  retry_success_rate:           0,
} as const;

export const DEFAULT_ONBOARDING: OnboardingFunnelMetrics = {
  onboarding_start_count:     0,
  onboarding_completion_rate: 0,
  step_completion_rate:       [],
  step_error_rate:            [],
} as const;

export const DEFAULT_PERFORMANCE: PerformanceMetrics = {
  processing_p50_ms:            0,
  processing_p95_ms:            0,
  processing_p99_ms:            0,
  avg_upload_duration_ms:       0,
  avg_attempts_per_resume:      0,
  avg_total_onboarding_time_ms: 0,
  avg_step_time_ms:             0,
  time_to_value_p50_ms:         0,
  time_to_value_p95_ms:         0,
} as const;

export const DEFAULT_RELIABILITY: ReliabilityMetrics = {
  resume_failure_rate:       0,
  timeout_rate:              0,
  retry_success_rate:        0,
  resume_errors_per_session: 0,
  monitoring_error_rate:     0,
  onboarding_error_rate:     0,
} as const;

export const DEFAULT_EXPERIMENTS: ExperimentMetrics = {
  flag_exposure_count:   {},
  conversion_by_variant: [],
} as const;

/**
 * Full safe default returned when both sources fail.
 * _meta marks this as a partial (degraded) result so monitoring can detect it.
 * FIX TS2741: Added required mode field to satisfy MetricsMeta interface.
 */
export const SAFE_DEFAULT_METRICS: MappedMetrics = {
  overview:     DEFAULT_OVERVIEW,
  resumeFunnel: DEFAULT_RESUME_FUNNEL,
  onboarding:   DEFAULT_ONBOARDING,
  performance:  DEFAULT_PERFORMANCE,
  reliability:  DEFAULT_RELIABILITY,
  experiments:  DEFAULT_EXPERIMENTS,
  _meta: {
    sources:   { posthog: false, backend: false },
    timestamp: 0,
    partial:   true,
    mode:      'single',
  },
} as const;