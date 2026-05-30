/**
 * @file lib/mappers/metricsMapper.ts
 * @description Normalization layer: external raw data → internal MetricsResponse types.
 *
 * RULES (NON-NEGOTIABLE):
 *  - This file is the ONLY place where external types are converted to internal types
 *  - ZERO imports from React, hooks, UI, or pages
 *  - ZERO network calls — pure data transformation
 *  - NO undefined in output — every field has a type-safe default
 *  - NO NaN in output — all numbers pass through safeData utilities
 *  - NO raw values passed directly — ALL values go through safe* utilities
 *  - Partial / missing input is handled gracefully — always returns full shape
 *  - Mapper functions are pure — same input always produces same output
 *
 * ARCHITECTURE POSITION:
 *
 *   External Source             Integration Layer           Core System
 *   ─────────────────           ─────────────────           ───────────
 *   PostHog API      ──→  posthogClient.ts  ──→  metricsMapper.ts  ──→  /lib/api/metrics.ts
 *   Backend API      ──→  backendClient.ts  ──→  metricsMapper.ts  ──→  /lib/api/metrics.ts
 *
 *   metricsMapper.ts is the controlled boundary.
 *   Everything downstream (hooks, UI, alerts) is NEVER aware of the source.
 *
 * MERGE PRECEDENCE RULES (deterministic, per-section):
 *  - resumeFunnel  → PostHog preferred (behavioral event accuracy)
 *  - onboarding    → PostHog preferred (step-level funnel data)
 *  - performance   → Backend preferred (infrastructure-level latency)
 *  - reliability   → Backend preferred (server-side error tracking)
 *  - experiments   → Backend preferred (authoritative flag assignment)
 *  - overview      → Always derived (never merged directly)
 *
 * ADDING A NEW SOURCE:
 *  1. Create types/external/newsource.ts
 *  2. Create lib/integrations/newsourceClient.ts
 *  3. Add mapFromNewSource() here
 *  4. Wire into lib/integrations/metricsAdapter.ts
 *  Hooks, UI, and alerts require zero changes.
 */

import type {
  OverviewMetrics,
  ResumeFunnelMetrics,
  OnboardingFunnelMetrics,
  PerformanceMetrics,
  ReliabilityMetrics,
  ExperimentMetrics,
  StepCompletionBreakdown,
  VariantConversionRow,
} from '@/lib/api/metrics';

import type {
  PostHogRawPayload,
  PostHogFunnelStep,
  PostHogExperimentVariant,
  PostHogTrendSeries,
  PostHogEventAggregation,
} from '@/types/external/posthog';

import type {
  BackendRawPayload,
  BackendRawStepRow,
  BackendRawVariantRow,
} from '@/types/external/backend';

import type { MappedMetrics } from '@/types/internal/mappedMetrics';

import {
  safeNumber,
  safeRate,
  safePositiveNumber,
  safeInteger,
  safeArray,
  safeString,
  safeRecord,
  safeNullableNumber,
} from './safeData';

import {
  DEFAULT_RESUME_FUNNEL,
  DEFAULT_ONBOARDING,
  DEFAULT_PERFORMANCE,
  DEFAULT_RELIABILITY,
  DEFAULT_EXPERIMENTS,
} from '@/lib/constants/defaultMetrics';

import { MERGE_RULES } from '@/lib/constants/mergeRules';

// Re-export MappedMetrics so adapter doesn't need to know the internal type path.
export type { MappedMetrics };

// ─────────────────────────────────────────────────────────────────────────────
// STRICT MAPPER INPUT TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Unified strict input contract for ALL mapper entry points.
 *
 * Previously two separate types existed (PostHogMapperInput / BackendMapperInput).
 * They are replaced by this single type to enforce one mapping contract
 * regardless of data source. All sections are nullable — mappers must handle
 * every null combination gracefully and always return a fully-shaped output.
 *
 * Fields use internal MetricsResponse types, not raw external wire shapes,
 * so source adapters normalise before passing in and mappers never see raw bytes.
 *
 * Exported for use by metricsAdapter.ts, integration tests, and any future
 * third-party source adapters.
 */
export type AnalyticsMapperInput = {
  /** Overview / headline KPI section — null when not yet fetched or unavailable. */
  overview:     OverviewMetrics         | null;
  /** Resume funnel section — null when not yet fetched or unavailable. */
  funnel:       ResumeFunnelMetrics     | null;
  /** Server-side performance / latency section — null when unavailable. */
  performance:  PerformanceMetrics      | null;
  /** Reliability / error-rate section — null when unavailable. */
  reliability:  ReliabilityMetrics      | null;
  /** Onboarding funnel section — null when unavailable. */
  onboarding:   OnboardingFunnelMetrics | null;
  /**
   * Pre-derived cross-section metrics — null when no source provides them.
   * (Neither PostHog nor the backend currently pre-derives these;
   * derivation happens in useMetrics via computeDerived().)
   */
  derived:      null;
};

/**
 * Runtime exhaustiveness guard.
 * Call at the `default:` of every MetricStatus / MetricCardStatus switch to
 * surface unhandled branches immediately in development.
 *
 * Usage:
 *   default:
 *     console.error('Unhandled MetricStatus:', status);
 *     assertExhaustive(status);
 */
export function assertExhaustive(value: never): never {
  throw new Error(`[metricsMapper] Unhandled case: ${String(value)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// POSTHOG → INTERNAL MAPPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map a PostHog funnel step array to ResumeFunnelMetrics.
 *
 * PostHog funnels represent conversion as step[n].count / step[0].count.
 * We derive rates from adjacent step counts where possible.
 */
function mapPostHogResumeFunnel(payload: PostHogRawPayload): ResumeFunnelMetrics {
  const steps = safeArray<PostHogFunnelStep>(
    Array.isArray(payload.resumeFunnel?.result?.[0])
      ? (payload.resumeFunnel!.result as PostHogFunnelStep[][])[0]
      : payload.resumeFunnel?.result
  );

  if (steps.length === 0) return DEFAULT_RESUME_FUNNEL;

  const uploadStartCount     = safeInteger(steps[0]?.count);
  const uploadSuccessCount   = safeInteger(steps[1]?.count);
  const processingDoneCount  = safeInteger(steps[2]?.count);

  const uploadSuccessRate      = uploadStartCount   > 0 ? uploadSuccessCount  / uploadStartCount   : 0;
  const processingSuccessRate  = uploadSuccessCount > 0 ? processingDoneCount / uploadSuccessCount : 0;
  const endToEndRate           = uploadStartCount   > 0 ? processingDoneCount / uploadStartCount   : 0;

  return {
    upload_start_count:         safeInteger(uploadStartCount),
    upload_success_rate:        safeRate(uploadSuccessRate),
    processing_success_rate:    safeRate(processingSuccessRate),
    end_to_end_conversion_rate: safeRate(endToEndRate),
    timeout_rate:               safeRate(0),  // Not available from PostHog funnel; hybrid fills this
    retry_success_rate:         safeRate(0),  // Not available from PostHog funnel; hybrid fills this
  };
}

/**
 * Map PostHog onboarding funnel to OnboardingFunnelMetrics.
 */
function mapPostHogOnboardingFunnel(payload: PostHogRawPayload): OnboardingFunnelMetrics {
  const steps = safeArray<PostHogFunnelStep>(
    Array.isArray(payload.onboardingFunnel?.result?.[0])
      ? (payload.onboardingFunnel!.result as PostHogFunnelStep[][])[0]
      : payload.onboardingFunnel?.result
  );

  if (steps.length === 0) return DEFAULT_ONBOARDING;

  const startCount     = safeInteger(steps[0]?.count);
  const lastStep       = steps[steps.length - 1];
  const completedCount = safeInteger(lastStep?.count);
  const completionRate = startCount > 0 ? completedCount / startCount : 0;

  const stepCompletionRate: StepCompletionBreakdown[] = steps.map(step => ({
    step_key: safeString(step.name, `step_${safeInteger(step.order)}`),
    rate:     safeRate(step.conversion_rate),
    count:    safeInteger(step.count),
  }));

  return {
    onboarding_start_count:     safeInteger(startCount),
    onboarding_completion_rate: safeRate(completionRate),
    step_completion_rate:       stepCompletionRate,
    step_error_rate:            [],  // PostHog funnels don't expose error rates directly
  };
}

/**
 * Map PostHog trends data to PerformanceMetrics.
 * PostHog latency insights return time-series; we take the latest bucket's value.
 */
function mapPostHogPerformance(payload: PostHogRawPayload): PerformanceMetrics {
  const latencySeries = safeArray<PostHogTrendSeries>(payload.processingLatency?.result);
  const uploadSeries  = safeArray<PostHogTrendSeries>(payload.uploadDuration?.result);

  const latestValue = (seriesLabel: string, seriesArray: PostHogTrendSeries[]): number => {
    const series = seriesArray.find(s => safeString(s?.label).includes(seriesLabel));
    const data   = safeArray<number>(series?.data);
    const last   = data.filter(v => safeNumber(v) > 0).pop();
    return safePositiveNumber(last);
  };

  const p50       = safePositiveNumber(latestValue('p50', latencySeries));
  const p95       = safePositiveNumber(latestValue('p95', latencySeries));
  const p99       = safePositiveNumber(latestValue('p99', latencySeries));
  const avgUpload = safePositiveNumber(latestValue('upload', uploadSeries));

  return {
    ...DEFAULT_PERFORMANCE,
    processing_p50_ms:      p50,
    processing_p95_ms:      p95,
    processing_p99_ms:      p99,
    avg_upload_duration_ms: avgUpload,
    time_to_value_p50_ms:   p50,  // PostHog model: processing time ≈ time-to-value
    time_to_value_p95_ms:   p95,
  };
}

/**
 * Map PostHog error aggregations to ReliabilityMetrics.
 */
function mapPostHogReliability(payload: PostHogRawPayload): ReliabilityMetrics {
  const errorEvents = safeArray<PostHogEventAggregation>(payload.errorAggregations?.results);

  const totalErrors   = errorEvents.reduce((sum, e) => sum + safeInteger(e?.count), 0);
  const timeoutErrors = errorEvents
    .filter(e => safeString(e?.event).toLowerCase().includes('timeout'))
    .reduce((sum, e) => sum + safeInteger(e?.count), 0);

  const resumeFunnel  = mapPostHogResumeFunnel(payload);
  const uploadStarts  = resumeFunnel.upload_start_count;

  const failureRate   = uploadStarts > 0 ? totalErrors   / uploadStarts : 0;
  const timeoutRate   = uploadStarts > 0 ? timeoutErrors / uploadStarts : 0;
  const errPerSession = uploadStarts > 0 ? totalErrors   / uploadStarts : 0;

  return {
    resume_failure_rate:        safeRate(failureRate),
    timeout_rate:               safeRate(timeoutRate),
    retry_success_rate:         safeRate(0),    // Not available from PostHog error events
    resume_errors_per_session:  safePositiveNumber(errPerSession),
    monitoring_error_rate:      safeRate(0),    // Internal system only
    onboarding_error_rate:      safeRate(0),
  };
}

/**
 * Map PostHog experiment data to ExperimentMetrics.
 */
function mapPostHogExperiments(payload: PostHogRawPayload): ExperimentMetrics {
  const experiment = payload.experimentResults;
  if (!experiment) return DEFAULT_EXPERIMENTS;

  const variants = safeArray<PostHogExperimentVariant>(experiment.variants);

  const flagExposureCount: Record<string, number> = {};
  for (const variant of variants) {
    const key = safeString(variant.key, 'unknown');
    flagExposureCount[key] = safeInteger(variant.count);
  }

  const control = variants.find(v => safeString(v.key) === 'control') ?? variants[0];
  const controlConversionRate = control
    ? safeInteger(control.success_count) / Math.max(1, safeInteger(control.count))
    : 0;

  const conversionByVariant: VariantConversionRow[] = variants.map(variant => {
    const count     = safeInteger(variant.count);
    const successes = safeInteger(variant.success_count);
    const rate      = count > 0 ? successes / count : 0;
    const isControl = safeString(variant.key) === safeString(control?.key);

    return {
      variant:         safeString(variant.key, 'unknown'),
      conversion_rate: safeRate(rate),
      session_count:   safeInteger(count),
      relative_lift:   isControl
        ? null
        : safeNullableNumber(controlConversionRate > 0
          ? (rate - controlConversionRate) / controlConversionRate
          : null),
    };
  });

  return {
    flag_exposure_count:   flagExposureCount,
    conversion_by_variant: conversionByVariant,
  };
}

/**
 * Derive OverviewMetrics from mapped section data.
 * Overview is always derived — never mapped directly from a single source field.
 * All inputs are nullable for defensive callers (e.g. partial merge scenarios).
 */
function deriveOverview(
  funnel:      ResumeFunnelMetrics | null,
  performance: PerformanceMetrics  | null,
  reliability: ReliabilityMetrics  | null,
): OverviewMetrics {
  return {
    resume_end_to_end_conversion_rate: safeRate(funnel?.end_to_end_conversion_rate ?? null),
    time_to_value_p50_ms:              safePositiveNumber(performance?.time_to_value_p50_ms ?? null),
    time_to_value_p95_ms:              safePositiveNumber(performance?.time_to_value_p95_ms ?? null),
    resume_failure_rate:               safeRate(reliability?.resume_failure_rate ?? null),
  };
}

/**
 * Master mapper: PostHogRawPayload → all normalized MetricsResponse sections.
 * Attaches _meta to mark source participation and timestamp.
 */
export function mapFromPostHog(payload: PostHogRawPayload): MappedMetrics {
  const resumeFunnel = mapPostHogResumeFunnel(payload);
  const onboarding   = mapPostHogOnboardingFunnel(payload);
  const performance  = mapPostHogPerformance(payload);
  const reliability  = mapPostHogReliability(payload);
  const experiments  = mapPostHogExperiments(payload);
  const overview     = deriveOverview(resumeFunnel, performance, reliability);

  return {
    overview,
    resumeFunnel,
    onboarding,
    performance,
    reliability,
    experiments,
    _meta: {
      sources:   { posthog: true, backend: false },
      timestamp: Date.now(),
      partial:   false,
      // mode is set to 'single' as a safe initial default; the adapter
      // always overwrites _meta entirely before returning to callers,
      // so this value is only visible within the mapper→adapter pipeline.
      mode:      'single',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKEND → INTERNAL MAPPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map a single BackendRawStepRow to StepCompletionBreakdown.
 * Handles both v1 (step_name, completion_rate) and v2 (step_key, rate) shapes.
 */
function mapBackendStepRow(raw: BackendRawStepRow): StepCompletionBreakdown {
  return {
    step_key: safeString(raw.step_key ?? raw.step_name, 'unknown_step'),
    rate:     safeRate(raw.rate ?? raw.completion_rate),
    count:    safeInteger(raw.count),
  };
}

/**
 * Map a single BackendRawVariantRow to VariantConversionRow.
 * Handles legacy `lift` field alias.
 */
function mapBackendVariantRow(raw: BackendRawVariantRow): VariantConversionRow {
  return {
    variant:         safeString(raw.variant, 'unknown'),
    conversion_rate: safeRate(raw.conversion_rate),
    session_count:   safeInteger(raw.session_count),
    relative_lift:   safeNullableNumber(raw.relative_lift ?? raw.lift),
  };
}

/**
 * Map backend resume funnel response to ResumeFunnelMetrics.
 */
function mapBackendResumeFunnel(payload: BackendRawPayload): ResumeFunnelMetrics {
  const raw = payload.resumeFunnel?.data;
  if (!raw) return DEFAULT_RESUME_FUNNEL;

  return {
    upload_start_count:         safeInteger(raw.upload_start_count),
    upload_success_rate:        safeRate(raw.upload_success_rate),
    processing_success_rate:    safeRate(raw.processing_success_rate),
    end_to_end_conversion_rate: safeRate(raw.end_to_end_conversion_rate),
    timeout_rate:               safeRate(raw.timeout_rate),
    retry_success_rate:         safeRate(raw.retry_success_rate),
  };
}

/**
 * Map backend onboarding response to OnboardingFunnelMetrics.
 * Handles both the v2 array shape and the legacy flat `steps` map.
 */
function mapBackendOnboarding(payload: BackendRawPayload): OnboardingFunnelMetrics {
  const raw = payload.onboardingFunnel?.data;
  if (!raw) return DEFAULT_ONBOARDING;

  let stepCompletionRate: StepCompletionBreakdown[] = [];
  let stepErrorRate: StepCompletionBreakdown[] = [];

  if (Array.isArray(raw.step_completion_rate)) {
    stepCompletionRate = safeArray<BackendRawStepRow>(raw.step_completion_rate).map(mapBackendStepRow);
  } else if (raw.steps && typeof raw.steps === 'object') {
    // v1 legacy: flat { step_key: rate } map
    stepCompletionRate = Object.entries(raw.steps).map(([step_key, rate]) => ({
      step_key,
      rate:  safeRate(rate),
      count: safeInteger(0),
    }));
  }

  if (Array.isArray(raw.step_error_rate)) {
    stepErrorRate = safeArray<BackendRawStepRow>(raw.step_error_rate).map(mapBackendStepRow);
  }

  return {
    onboarding_start_count:     safeInteger(raw.onboarding_start_count),
    onboarding_completion_rate: safeRate(raw.onboarding_completion_rate),
    step_completion_rate:       stepCompletionRate,
    step_error_rate:            stepErrorRate,
  };
}

/**
 * Map backend performance response to PerformanceMetrics.
 * Handles both flat fields and legacy nested `latency` object.
 * Handles seconds-vs-milliseconds normalization (values < 1000 assumed seconds).
 */
function mapBackendPerformance(payload: BackendRawPayload): PerformanceMetrics {
  const raw = payload.performance?.data;
  if (!raw) return DEFAULT_PERFORMANCE;

  const toMs = (value: unknown): number => {
    const num = safePositiveNumber(value);
    return num > 0 && num < 1000 ? num * 1000 : num;
  };

  const p50       = toMs(raw.processing_p50_ms ?? raw.latency?.p50);
  const p95       = toMs(raw.processing_p95_ms ?? raw.latency?.p95);
  const p99       = toMs(raw.processing_p99_ms ?? raw.latency?.p99);
  const avgUpload = toMs(raw.avg_upload_duration_ms ?? raw.avg_upload_ms);

  return {
    processing_p50_ms:            safePositiveNumber(p50),
    processing_p95_ms:            safePositiveNumber(p95),
    processing_p99_ms:            safePositiveNumber(p99),
    avg_upload_duration_ms:       safePositiveNumber(avgUpload),
    avg_attempts_per_resume:      safePositiveNumber(raw.avg_attempts_per_resume),
    avg_total_onboarding_time_ms: safePositiveNumber(toMs(raw.avg_total_onboarding_time_ms)),
    avg_step_time_ms:             safePositiveNumber(toMs(raw.avg_step_time_ms)),
    time_to_value_p50_ms:         safePositiveNumber(toMs(raw.time_to_value_p50_ms)),
    time_to_value_p95_ms:         safePositiveNumber(toMs(raw.time_to_value_p95_ms)),
  };
}

/**
 * Map backend reliability response to ReliabilityMetrics.
 * Handles legacy `error_rate` alias.
 */
function mapBackendReliability(payload: BackendRawPayload): ReliabilityMetrics {
  const raw = payload.reliability?.data;
  if (!raw) return DEFAULT_RELIABILITY;

  return {
    resume_failure_rate:       safeRate(raw.resume_failure_rate ?? raw.error_rate),
    timeout_rate:              safeRate(raw.timeout_rate),
    retry_success_rate:        safeRate(raw.retry_success_rate),
    resume_errors_per_session: safePositiveNumber(raw.resume_errors_per_session),
    monitoring_error_rate:     safeRate(raw.monitoring_error_rate),
    onboarding_error_rate:     safeRate(raw.onboarding_error_rate),
  };
}

/**
 * Map backend experiments response to ExperimentMetrics.
 * Handles both v2 `conversion_by_variant` array and legacy `variants` array.
 */
function mapBackendExperiments(payload: BackendRawPayload): ExperimentMetrics {
  const raw = payload.experiments?.data;
  if (!raw) return DEFAULT_EXPERIMENTS;

  const rawVariants = Array.isArray(raw.conversion_by_variant)
    ? raw.conversion_by_variant
    : safeArray<BackendRawVariantRow>(raw.variants);

  return {
    flag_exposure_count:   safeRecord(raw.flag_exposure_count),
    conversion_by_variant: rawVariants.map(mapBackendVariantRow),
  };
}

/**
 * Master mapper: BackendRawPayload → all normalized MetricsResponse sections.
 * Attaches _meta to mark source participation and timestamp.
 */
export function mapFromBackend(payload: BackendRawPayload): MappedMetrics {
  const resumeFunnel = mapBackendResumeFunnel(payload);
  const onboarding   = mapBackendOnboarding(payload);
  const performance  = mapBackendPerformance(payload);
  const reliability  = mapBackendReliability(payload);
  const experiments  = mapBackendExperiments(payload);
  const overview     = deriveOverview(resumeFunnel, performance, reliability);

  return {
    overview,
    resumeFunnel,
    onboarding,
    performance,
    reliability,
    experiments,
    _meta: {
      sources:   { posthog: false, backend: true },
      timestamp: Date.now(),
      partial:   false,
      // mode is set to 'single' as a safe initial default; the adapter
      // always overwrites _meta entirely before returning to callers,
      // so this value is only visible within the mapper→adapter pipeline.
      mode:      'single',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HYBRID MERGE STRATEGY — DETERMINISTIC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Merge two MappedMetrics with explicit, documented precedence rules.
 *
 * PRECEDENCE RULES (per section):
 *
 *   resumeFunnel  → PostHog preferred
 *     Reason: PostHog captures behavioral events at the client side with
 *     session-level deduplication. Backend funnel counts can be inflated by
 *     server-side retries that aren't user-initiated.
 *
 *   onboarding    → PostHog preferred
 *     Reason: Step-level funnel data is richer in PostHog (step.conversion_rate,
 *     step ordering). Backend only has aggregate counts.
 *
 *   performance   → Backend preferred
 *     Reason: Processing latency (p50/p95/p99) is measured server-side.
 *     PostHog latency trends are approximations from client timestamps.
 *
 *   reliability   → Backend preferred
 *     Reason: Server-side error tracking (monitoring_error_rate, retry counts)
 *     is authoritative. PostHog only sees client-observable failures.
 *
 *   experiments   → Backend preferred
 *     Reason: Flag assignment is server-authoritative. PostHog exposure counts
 *     are behavioral; backend is the source of truth for variant membership.
 *
 *   overview      → Always re-derived from merged sections (never merged directly)
 *
 * FALLBACK BEHAVIOR:
 *   If the preferred source has zero/empty for a field, the secondary fills in.
 *   This handles partial failures gracefully (one source down, other partial).
 *
 * @param posthog  - PostHog mapped metrics
 * @param backend  - Backend mapped metrics
 * @returns Merged MappedMetrics with deterministic per-section precedence
 */
/**
 * NOTE: precedence rules here MUST mirror MERGE_RULES in metricsAdapter.ts.
 * If you change a section's preferred source, update MERGE_RULES too.
 *
 * @param posthog   - PostHog mapped metrics
 * @param backend   - Backend mapped metrics
 * @param timestamp - Optional pre-computed timestamp from the adapter (preferred).
 *                    When provided, _meta.timestamp is set to this value for
 *                    consistency across the entire resolve cycle. When omitted,
 *                    falls back to max of both sources (safe, but less precise).
 */
export function mergeMetrics(posthog: MappedMetrics, backend: MappedMetrics, timestamp?: number): MappedMetrics {
  // ─────────────────────────────────────────────────────────────────────────
  // MERGE_RULES RUNTIME ENFORCEMENT
  //
  // Every section is resolved by reading MERGE_RULES[section] and branching
  // on its value. No hardcoded source preferences exist outside this table.
  // If MERGE_RULES changes, merge behavior changes automatically — zero drift.
  //
  // Rule semantics:
  //   'posthog'  → posthog value used when non-zero/non-empty; backend fills gaps
  //   'backend'  → backend value used when non-zero/non-empty; posthog fills gaps
  //   'derived'  → section is always re-computed from already-merged sections
  //                (never merged directly from either raw source)
  // ─────────────────────────────────────────────────────────────────────────

  // Helper: pick preferred numeric value; fall back to secondary when preferred is 0
  const pick = (preferred: number, secondary: number): number =>
    preferred !== 0 ? preferred : secondary;

  const pickArr = <T>(preferred: T[], secondary: T[]): T[] =>
    preferred.length > 0 ? preferred : secondary;

  const pickRec = (preferred: Record<string, number>, secondary: Record<string, number>): Record<string, number> =>
    ({ ...secondary, ...preferred });  // preferred keys win

  // Convenience: select (primary, fallback) pair for a section based on its MERGE_RULE.
  // Returns [primary, fallback] where primary is the preferred source's data.
  type SourcePair = [MappedMetrics, MappedMetrics];
  function sourcesFor(section: keyof typeof MERGE_RULES): SourcePair {
    const rule = MERGE_RULES[section];
    if (rule === 'posthog') return [posthog, backend];
    if (rule === 'backend') return [backend, posthog];
    // 'derived' sections never use this helper — they re-compute from merged data
    throw new Error(`[mergeMetrics] Unexpected rule for section "${section}": "${rule}"`);
  }

  // ── resumeFunnel ─────────────────────────────────────────────────────────
  // MERGE_RULES.resumeFunnel = 'posthog'
  // PostHog preferred for behavioral event accuracy.
  // timeout_rate / retry_success_rate are backend-only fields;
  // they never appear in PostHog data, so backend always wins for those two.
  const [rfPrimary, rfFallback] = sourcesFor('resumeFunnel');
  const resumeFunnel: ResumeFunnelMetrics = {
    upload_start_count:         pick(rfPrimary.resumeFunnel.upload_start_count,         rfFallback.resumeFunnel.upload_start_count),
    upload_success_rate:        pick(rfPrimary.resumeFunnel.upload_success_rate,        rfFallback.resumeFunnel.upload_success_rate),
    processing_success_rate:    pick(rfPrimary.resumeFunnel.processing_success_rate,    rfFallback.resumeFunnel.processing_success_rate),
    end_to_end_conversion_rate: pick(rfPrimary.resumeFunnel.end_to_end_conversion_rate, rfFallback.resumeFunnel.end_to_end_conversion_rate),
    // timeout_rate / retry_success_rate: backend-only fields; always use backend regardless of rule
    timeout_rate:               pick(backend.resumeFunnel.timeout_rate,    posthog.resumeFunnel.timeout_rate),
    retry_success_rate:         pick(backend.resumeFunnel.retry_success_rate, posthog.resumeFunnel.retry_success_rate),
  };

  // ── onboarding ───────────────────────────────────────────────────────────
  // MERGE_RULES.onboarding = 'posthog'
  // PostHog preferred for richer step-level funnel data.
  // step_error_rate is backend-only; backend always wins for that field.
  const [obPrimary, obFallback] = sourcesFor('onboarding');
  const onboarding: OnboardingFunnelMetrics = {
    onboarding_start_count:     pick(obPrimary.onboarding.onboarding_start_count,     obFallback.onboarding.onboarding_start_count),
    onboarding_completion_rate: pick(obPrimary.onboarding.onboarding_completion_rate, obFallback.onboarding.onboarding_completion_rate),
    step_completion_rate:       pickArr(obPrimary.onboarding.step_completion_rate,    obFallback.onboarding.step_completion_rate),
    // step_error_rate: backend-only field; backend always wins
    step_error_rate:            pickArr(backend.onboarding.step_error_rate, posthog.onboarding.step_error_rate),
  };

  // ── performance ──────────────────────────────────────────────────────────
  // MERGE_RULES.performance = 'backend'
  // Backend preferred — server-side latency is authoritative.
  const [perfPrimary, perfFallback] = sourcesFor('performance');
  const performance: PerformanceMetrics = {
    processing_p50_ms:            pick(perfPrimary.performance.processing_p50_ms,            perfFallback.performance.processing_p50_ms),
    processing_p95_ms:            pick(perfPrimary.performance.processing_p95_ms,            perfFallback.performance.processing_p95_ms),
    processing_p99_ms:            pick(perfPrimary.performance.processing_p99_ms,            perfFallback.performance.processing_p99_ms),
    avg_upload_duration_ms:       pick(perfPrimary.performance.avg_upload_duration_ms,       perfFallback.performance.avg_upload_duration_ms),
    avg_attempts_per_resume:      pick(perfPrimary.performance.avg_attempts_per_resume,      perfFallback.performance.avg_attempts_per_resume),
    avg_total_onboarding_time_ms: pick(perfPrimary.performance.avg_total_onboarding_time_ms, perfFallback.performance.avg_total_onboarding_time_ms),
    avg_step_time_ms:             pick(perfPrimary.performance.avg_step_time_ms,             perfFallback.performance.avg_step_time_ms),
    time_to_value_p50_ms:         pick(perfPrimary.performance.time_to_value_p50_ms,         perfFallback.performance.time_to_value_p50_ms),
    time_to_value_p95_ms:         pick(perfPrimary.performance.time_to_value_p95_ms,         perfFallback.performance.time_to_value_p95_ms),
  };

  // ── reliability ──────────────────────────────────────────────────────────
  // MERGE_RULES.reliability = 'backend'
  // Backend preferred — server-side error tracking is authoritative.
  const [relPrimary, relFallback] = sourcesFor('reliability');
  const reliability: ReliabilityMetrics = {
    resume_failure_rate:       pick(relPrimary.reliability.resume_failure_rate,       relFallback.reliability.resume_failure_rate),
    timeout_rate:              pick(relPrimary.reliability.timeout_rate,              relFallback.reliability.timeout_rate),
    retry_success_rate:        pick(relPrimary.reliability.retry_success_rate,        relFallback.reliability.retry_success_rate),
    resume_errors_per_session: pick(relPrimary.reliability.resume_errors_per_session, relFallback.reliability.resume_errors_per_session),
    monitoring_error_rate:     pick(relPrimary.reliability.monitoring_error_rate,     relFallback.reliability.monitoring_error_rate),
    onboarding_error_rate:     pick(relPrimary.reliability.onboarding_error_rate,     relFallback.reliability.onboarding_error_rate),
  };

  // ── experiments ──────────────────────────────────────────────────────────
  // MERGE_RULES.experiments = 'backend'
  // Backend preferred — flag assignment is server-authoritative.
  const [expPrimary, expFallback] = sourcesFor('experiments');
  const experiments: ExperimentMetrics = {
    flag_exposure_count:   pickRec(expPrimary.experiments.flag_exposure_count,   expFallback.experiments.flag_exposure_count),
    conversion_by_variant: pickArr(expPrimary.experiments.conversion_by_variant, expFallback.experiments.conversion_by_variant),
  };

  // ── overview ─────────────────────────────────────────────────────────────
  // MERGE_RULES.overview = 'derived'
  // Always re-computed from the already-merged sections above.
  // Never merged directly from either raw source — this enforces the 'derived'
  // rule at the implementation level, not just by documentation.
  if (MERGE_RULES.overview !== 'derived') {
    // Runtime guard: if MERGE_RULES.overview is ever changed away from 'derived'
    // this will throw in development, forcing the author to update this logic.
    if (process.env.NODE_ENV === 'development') {
      throw new Error(
        `[mergeMetrics] MERGE_RULES.overview must be 'derived'. ` +
        `Current value: "${MERGE_RULES.overview}". Update mergeMetrics() to handle the new rule.`
      );
    }
  }
  const overview = deriveOverview(resumeFunnel, performance, reliability);

  // ── _meta ─────────────────────────────────────────────────────────────────
  // Merge source participation; prefer caller timestamp for cycle consistency.
  // mode is set by the adapter after mergeMetrics returns — not derived here.
  const _meta = {
    sources: {
      posthog: posthog._meta.sources.posthog ?? false,
      backend: backend._meta.sources.backend  ?? false,
    },
    timestamp: timestamp ?? Math.max(posthog._meta.timestamp, backend._meta.timestamp),
    partial:   posthog._meta.partial || backend._meta.partial,
    // mode is always overwritten by the adapter; 'hybrid' is the only valid
    // value in mergeMetrics context (it is only called from the hybrid branch).
    mode:      'hybrid' as const,
  };

  return { overview, resumeFunnel, onboarding, performance, reliability, experiments, _meta };
}