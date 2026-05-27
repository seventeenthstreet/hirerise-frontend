/**
 * @file types/external/backend.ts
 * @description Raw wire types for the internal backend analytics API.
 *
 * RULES (NON-NEGOTIABLE):
 *  - These types ONLY model what the backend actually sends
 *  - NO business logic, NO derived fields, NO computed values
 *  - NEVER imported by UI components, hooks, or alerts
 *  - All fields optional — backend shape evolves independently
 *  - Schema version mismatches are absorbed here, not in the mapper
 *
 * BOUNDARY: These types stop at /lib/integrations/backendClient.ts
 * They are mapped to MetricsResponse types at /lib/mappers/metricsMapper.ts
 *
 * VERSIONING:
 *  When backend changes a field name or adds a section, add the new
 *  shape here (additive) and update only the mapper. Hooks and UI
 *  are never touched.
 */

// ─────────────────────────────────────────────────────────────────────────────
// BACKEND RESPONSE ENVELOPE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Standard success envelope for the backend analytics endpoints.
 * Mirrors the internal api-types.ts RawApiSuccess but scoped to external
 * analytics-specific usage — NOT sharing the internal type to keep layers decoupled.
 */
export interface BackendAnalyticsEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
  } | null;
  meta?: {
    generatedAt?: string;
    windowDays?: number;
    requestId?: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RESUME FUNNEL — raw backend shape
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Raw backend shape for the resume funnel endpoint.
 * Note: backend uses snake_case float strings in some versions — normalized here.
 */
export interface BackendRawResumeFunnel {
  /** Total distinct sessions that started an upload */
  upload_start_count?: number | string;
  /** Rate: upload_success / upload_started */
  upload_success_rate?: number | string;
  /** Rate: processing_done / upload_success */
  processing_success_rate?: number | string;
  /** Headline end-to-end rate: processing_done / upload_started */
  end_to_end_conversion_rate?: number | string;
  /** Rate: timeout failures / upload_started */
  timeout_rate?: number | string;
  /** Rate: failed → succeeded (time-ordered) / failed */
  retry_success_rate?: number | string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING FUNNEL — raw backend shape
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-step raw row from the backend onboarding endpoint.
 * Backend may omit `count` on older query paths.
 */
export interface BackendRawStepRow {
  step_key?: string;
  rate?: number | string;
  count?: number | string;
  /** Legacy field name used in v1 backend (step_name vs step_key) */
  step_name?: string;
  /** Legacy rate field name */
  completion_rate?: number | string;
}

/**
 * Raw backend shape for the onboarding funnel endpoint.
 */
export interface BackendRawOnboardingFunnel {
  onboarding_start_count?: number | string;
  onboarding_completion_rate?: number | string;
  /** Per-step completion array */
  step_completion_rate?: BackendRawStepRow[];
  /** Per-step error rate array */
  step_error_rate?: BackendRawStepRow[];
  /** Legacy flat shape: { step_key: rate } */
  steps?: Record<string, number | string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// PERFORMANCE — raw backend shape
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Raw backend shape for the performance endpoint.
 * Latency fields may come as seconds (float) on older endpoints — mapper
 * normalizes to milliseconds.
 */
export interface BackendRawPerformance {
  /** May be in ms or seconds depending on backend version */
  processing_p50_ms?: number | string;
  processing_p95_ms?: number | string;
  processing_p99_ms?: number | string;
  /** Legacy field: backend v1 used `avg_upload_ms` */
  avg_upload_duration_ms?: number | string;
  avg_upload_ms?: number | string;
  avg_attempts_per_resume?: number | string;
  avg_total_onboarding_time_ms?: number | string;
  avg_step_time_ms?: number | string;
  time_to_value_p50_ms?: number | string;
  time_to_value_p95_ms?: number | string;
  /**
   * Legacy shape: backend sometimes nests latencies under `latency` key.
   */
  latency?: {
    p50?: number | string;
    p95?: number | string;
    p99?: number | string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RELIABILITY — raw backend shape
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Raw backend shape for the reliability endpoint.
 */
export interface BackendRawReliability {
  resume_failure_rate?: number | string;
  timeout_rate?: number | string;
  retry_success_rate?: number | string;
  /** Absolute count — mapper computes `per_session` rate if raw count is given */
  resume_error_count?: number | string;
  /** Direct per-session rate (preferred over raw count) */
  resume_errors_per_session?: number | string;
  monitoring_error_rate?: number | string;
  onboarding_error_rate?: number | string;
  /** Legacy: some backends return `error_rate` instead of `resume_failure_rate` */
  error_rate?: number | string;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPERIMENTS — raw backend shape
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Raw per-variant row from the backend experiments endpoint.
 */
export interface BackendRawVariantRow {
  variant?: string;
  conversion_rate?: number | string;
  session_count?: number | string;
  relative_lift?: number | string | null;
  /** Legacy name */
  lift?: number | string | null;
}

/**
 * Raw backend shape for the experiments endpoint.
 */
export interface BackendRawExperiments {
  /** { variant_slug: count } */
  flag_exposure_count?: Record<string, number | string>;
  /** Per-variant conversion rows */
  conversion_by_variant?: BackendRawVariantRow[];
  /** Legacy flat structure */
  variants?: BackendRawVariantRow[];
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSITE RAW RESPONSE
// Assembled by backendClient.ts from per-section endpoint calls
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Composite raw payload assembled by backendClient.ts from 5 separate
 * backend API calls. All sections are optional — partial responses are expected
 * when endpoints return errors or the network is degraded.
 *
 * This is the ONLY shape that crosses the integration boundary.
 * metricsMapper.ts consumes this and produces normalized MetricsResponse types.
 */
export interface BackendRawPayload {
  resumeFunnel?: BackendAnalyticsEnvelope<BackendRawResumeFunnel>;
  onboardingFunnel?: BackendAnalyticsEnvelope<BackendRawOnboardingFunnel>;
  performance?: BackendAnalyticsEnvelope<BackendRawPerformance>;
  reliability?: BackendAnalyticsEnvelope<BackendRawReliability>;
  experiments?: BackendAnalyticsEnvelope<BackendRawExperiments>;
  /** Unix ms timestamp when the payload was assembled */
  fetchedAt?: number;
  /** Which sections completed without error */
  successfulSections?: Set<BackendSection>;
}

/** Section keys that can succeed or fail independently during backend fetch. */
export type BackendSection =
  | 'resumeFunnel'
  | 'onboardingFunnel'
  | 'performance'
  | 'reliability'
  | 'experiments';