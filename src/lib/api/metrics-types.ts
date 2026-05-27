/**
 * @file lib/api/metrics-types.ts
 * @description Shared metric interface types. No imports, no runtime code.
 *
 * WHY THIS FILE EXISTS — circular import chain in the original layout:
 *
 *   lib/api/metrics.ts
 *     → lib/integrations/metricsAdapter (resolver functions)
 *         → lib/api/endpoints/metrics   (metricsApi object)
 *             → lib/api/metrics         ← closes the cycle
 *
 *   With moduleResolution:"bundler" + isolatedModules:true, TypeScript cannot
 *   resolve any module in a cycle when approached from outside it, producing
 *   ts(2307) "Cannot find module" on every consumer (defaultMetrics, mappedMetrics,
 *   analytics.ts, etc.).
 *
 * FIX: The shared interfaces are the only thing crossing the cycle boundary.
 *   Extract them here. Both metricsAdapter and endpoints/metrics import from
 *   here instead of from each other. metrics.ts re-exports everything so all
 *   existing import paths remain valid without changes anywhere else.
 *
 * RULES:
 *   - NO imports. This file must remain fully dependency-free.
 *   - NO runtime code. Types only.
 *   - All interface changes must be made here, not in consumer files.
 *
 * CONSUMERS (import types from here directly):
 *   - lib/api/metrics.ts              re-exports for backward compat
 *   - lib/api/endpoints/metrics.ts    type imports
 *   - lib/integrations/metricsAdapter type imports
 *   - types/internal/mappedMetrics.ts type imports
 *   - lib/constants/defaultMetrics.ts via metrics.ts re-export (no change needed)
 */

// ─────────────────────────────────────────────────────────────────────────────
// FILTER TYPES  (shared across all metric endpoints)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Global filter params accepted by all /metrics/* endpoints.
 * UI layer builds a MetricFilters object; hooks pass it as `params`.
 */
export interface MetricFilters {
  /** ISO-8601 date string, inclusive start. Example: "2025-01-01" */
  date_from?: string;
  /** ISO-8601 date string, inclusive end. Example: "2025-03-31" */
  date_to?: string;
  /** Segment by user type. */
  user_type?: 'student' | 'professional' | 'market';
  /** Experiment variant slug for A/B filter. */
  variant?: string;
  /** Granularity for time-series metrics. */
  grain?: 'daily' | 'weekly';
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE TYPES — strictly follow v4 schema names
// ─────────────────────────────────────────────────────────────────────────────

// ── Resume Funnel ─────────────────────────────────────────────────────────────

/**
 * Funnel metrics for the resume upload + processing pipeline.
 * All rates are 0–1 floats. Counts are integers.
 * Schema ref: Section 1 — Funnel Metrics — Resume
 */
export interface ResumeFunnelMetrics {
  /** COUNT(DISTINCT sessionId WHERE resume_upload_started) */
  upload_start_count: number;
  /** session-scoped: upload_success / upload_started */
  upload_success_rate: number;
  /** session-scoped: processing_done / upload_success */
  processing_success_rate: number;
  /** session-scoped: processing_done / upload_started — headline metric */
  end_to_end_conversion_rate: number;
  /**
   * Share of upload_started sessions with processing_failed AND error_reason='timeout'
   * MICRO-FIX v4: denominator is upload_started (not upload_success)
   */
  timeout_rate: number;
  /**
   * Sessions where processing_failed at T1 AND processing_done at T2 > T1
   * / sessions where processing_failed exists
   */
  retry_success_rate: number;
}

// ── Onboarding Funnel ─────────────────────────────────────────────────────────

/**
 * Per-step completion data for the step_completion_rate breakdown.
 */
export interface StepCompletionBreakdown {
  step_key: string;
  /** Rate for this individual step: completed / started */
  rate: number;
  /** Raw count for this step */
  count: number;
}

/**
 * Funnel metrics for the onboarding flow.
 * Schema ref: Section 2 — Funnel Metrics — Onboarding
 */
export interface OnboardingFunnelMetrics {
  /** COUNT(DISTINCT sessionId WHERE onboarding_started) */
  onboarding_start_count: number;
  /** onboarding_completed / onboarding_started */
  onboarding_completion_rate: number;
  /**
   * Per-step completion rates — array of step_key → rate pairs.
   * Breakdown of onboarding_step_saved per step vs onboarding_started.
   */
  step_completion_rate: StepCompletionBreakdown[];
  /** Per-step error rates: onboarding_step_error / onboarding_started per step */
  step_error_rate: StepCompletionBreakdown[];
}

// ── Performance ───────────────────────────────────────────────────────────────

/**
 * Processing latency percentiles + attempt stats.
 * Schema ref: Section 3 — Performance Metrics
 */
export interface PerformanceMetrics {
  /** Resume processing duration at p50, p95, p99 in milliseconds */
  processing_p50_ms: number;
  processing_p95_ms: number;
  processing_p99_ms: number;
  /** Average upload transport duration in milliseconds */
  avg_upload_duration_ms: number;
  /** Average number of poll attempts before terminal state (done|failed) */
  avg_attempts_per_resume: number;
  /** Average total onboarding flow time in milliseconds */
  avg_total_onboarding_time_ms: number;
  /** Average per-step time in milliseconds */
  avg_step_time_ms: number;
  /**
   * Time-to-value: upload_started → processing_done
   * MICRO-FIX v3: excludes sessions where upload never reached upload_success
   * p50 and p95 in milliseconds
   */
  time_to_value_p50_ms: number;
  time_to_value_p95_ms: number;
}

// ── Reliability ───────────────────────────────────────────────────────────────

/**
 * Reliability/error metrics for the resume processing pipeline.
 * Schema ref: Section 4 — Reliability Metrics
 * MICRO-FIX v4: all reliability denominators are upload_started sessions
 */
export interface ReliabilityMetrics {
  /**
   * processing_failed / upload_started
   * v4 denominator: upload_started (aligned with timeout_rate)
   */
  resume_failure_rate: number;
  /** processing_failed[error_reason=timeout] / upload_started */
  timeout_rate: number;
  /**
   * retry_success: failure followed by success (time-ordered, T2 > T1)
   * See ResumeFunnelMetrics.retry_success_rate for same metric in funnel context
   */
  retry_success_rate: number;
  /** resume_errors per 100 upload_started sessions */
  resume_errors_per_session: number;
  /** Monitoring-captured errors / upload_started */
  monitoring_error_rate: number;
  /** Onboarding step errors / onboarding_started */
  onboarding_error_rate: number;
}

// ── Experiments ───────────────────────────────────────────────────────────────

/**
 * Single variant row for conversion_by_variant.
 */
export interface VariantConversionRow {
  variant: string;
  /** end_to_end_conversion_rate for this variant's sessions */
  conversion_rate: number;
  /** upload_start_count for this variant */
  session_count: number;
  /** Relative lift vs control (null if this row IS the control) */
  relative_lift?: number | null;
}

/**
 * Experiment exposure + conversion breakdown by variant.
 * Schema ref: Section 5 — Experiment Metrics
 */
export interface ExperimentMetrics {
  /** COUNT(DISTINCT sessionId WHERE flag_evaluated) per variant */
  flag_exposure_count: Record<string, number>;
  /** end_to_end_conversion_rate segmented by variant */
  conversion_by_variant: VariantConversionRow[];
}

// ── Overview ──────────────────────────────────────────────────────────────────

/**
 * High-level overview figures surfaced in the Overview section.
 * Derived from resume funnel + performance metrics.
 */
export interface OverviewMetrics {
  /** Headline funnel metric — end_to_end_conversion_rate */
  resume_end_to_end_conversion_rate: number;
  /** Time-to-value p50 and p95 in ms */
  time_to_value_p50_ms: number;
  time_to_value_p95_ms: number;
  /** resume_failure_rate (reliability denominator: upload_started) */
  resume_failure_rate: number;
}