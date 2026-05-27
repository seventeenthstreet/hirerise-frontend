/**
 * @file src/lib/mappers/analytics.mapper.ts
 * @description Transformation layer: raw API metric shapes → UiContractRoot.
 *
 * ARCHITECTURE POSITION: API → Contract → **Transform** → Hooks → UI
 *
 * RESPONSIBILITIES:
 *  - Accept raw API metric payloads (nullable — any field may be missing)
 *  - Normalise: null → safe fallback, missing arrays → [], invalid numbers → null
 *  - Format all display values (rates, durations, counts)
 *  - Compute status badges (MetricStatus) from raw values
 *  - Return a fully-populated UiContractRoot — no undefined, no raw API shape
 *
 * HARD RULES:
 *  - NO network calls, NO React, NO side effects
 *  - ONLY this file imports from lib/api/metrics.ts types — all others use analytics.ts
 *  - UI components NEVER call mapper functions directly
 *  - Hook calls mapper; mapper is invisible to page/UI layer
 *
 * NULL-SAFETY GUARANTEES:
 *  - Every field in UiContractRoot is always populated
 *  - metric.formatted: string → always a string (never undefined)
 *  - metric.status: MetricStatus → always one of four values
 *  - arrays → always [] when source is null/undefined
 *  - numbers → null when source is null/undefined/NaN
 */

import type {
  OverviewMetrics,
  ResumeFunnelMetrics,
  OnboardingFunnelMetrics,
  PerformanceMetrics,
  ReliabilityMetrics,
  ExperimentMetrics,
} from '@/lib/api/metrics';
import type {
  UiContractRoot,
  UiMetric,
  UiFunnelStep,
  UiBarChartRow,
  UiPercentileSet,
  UiOverviewSection,
  UiResumeFunnelSection,
  UiOnboardingSection,
  UiPerformanceSection,
  UiReliabilitySection,
  UiExperimentsSection,
  UiDerivedSection,
  UiVariantTableRow,
  MetricStatus,
} from '@/types/analytics';
import { exhaustiveMetricStatus } from '@/types/analytics';

// ─────────────────────────────────────────────────────────────────────────────
// INPUT TYPE — all sections nullable (any may not have loaded yet)
// ─────────────────────────────────────────────────────────────────────────────

export interface AnalyticsMapperInput {
  overview:     OverviewMetrics           | null;
  resumeFunnel: ResumeFunnelMetrics       | null;
  onboarding:   OnboardingFunnelMetrics   | null;
  performance:  PerformanceMetrics        | null;
  reliability:  ReliabilityMetrics        | null;
  experiments:  ExperimentMetrics         | null;
  /** Pre-computed derived values from useMetrics — passed in, not re-derived here */
  derived: {
    processingDropOffRate: number | null;
    uploadDropOffRate:     number | null;
    overallHealthScore:    number | null;
    onboardingResumeGap:   number | null;
    p95OverP50Ratio:       number | null;
    estimatedRetryWaste:   number | null;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL FORMATTERS
// Pure functions — no side effects.
// ─────────────────────────────────────────────────────────────────────────────

function safeNum(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return isFinite(n) ? n : null;
}

function fmtRate(value: number | null | undefined): string {
  const n = safeNum(value);
  if (n === null) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function fmtMs(ms: number | null | undefined): string {
  const n = safeNum(ms);
  if (n === null) return '—';
  if (n >= 60_000) return `${(n / 60_000).toFixed(1)}m`;
  if (n >= 1_000)  return `${(n / 1_000).toFixed(1)}s`;
  return `${Math.round(n)}ms`;
}

function fmtCount(n: number | null | undefined): string {
  const v = safeNum(n);
  if (v === null) return '—';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}k`;
  return v.toLocaleString();
}

function fmtDecimal(n: number | null | undefined, decimals = 2): string {
  const v = safeNum(n);
  if (v === null) return '—';
  return v.toFixed(decimals);
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS HELPERS
// All status switches are exhaustive — TypeScript enforces at compile time.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute status for a "higher is better" rate metric (e.g. conversion, completion).
 */
function rateStatus(
  value: number | null,
  goodThreshold = 0.8,
  warnThreshold = 0.6,
): MetricStatus {
  if (value === null) return 'neutral';
  if (value >= goodThreshold) return 'good';
  if (value >= warnThreshold) return 'warning';
  return 'critical';
}

/**
 * Compute status for a "lower is better" failure/error rate metric.
 */
function failureStatus(
  value: number | null,
  warnThreshold = 0.05,
  critThreshold = 0.1,
): MetricStatus {
  if (value === null) return 'neutral';
  if (value >= critThreshold) return 'critical';
  if (value >= warnThreshold) return 'warning';
  return 'good';
}

/**
 * Compute status for latency (lower = better), in milliseconds.
 */
function latencyStatus(
  ms: number | null,
  goodMs = 10_000,
  warnMs = 30_000,
): MetricStatus {
  if (ms === null) return 'neutral';
  if (ms < goodMs) return 'good';
  if (ms < warnMs) return 'warning';
  return 'critical';
}

/**
 * Exhaustive MetricStatus → CSS color string.
 * Used for variant table lift colour.
 */
export function metricStatusToColor(status: MetricStatus): string {
  switch (status) {
    case 'good':     return '#22c55e';
    case 'warning':  return '#f59e0b';
    case 'critical': return '#ef4444';
    case 'neutral':  return '#4d6080';
    default:         return exhaustiveMetricStatus(status);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// METRIC BUILDER
// Creates a UiMetric with all fields guaranteed to be populated.
// ─────────────────────────────────────────────────────────────────────────────

function buildMetric(
  label: string,
  rawValue: number | null | undefined,
  format: (v: number | null) => string,
  status: MetricStatus,
  opts?: {
    sublabel?: string;
    subvalue?: string;
    detail?: string;
  },
): UiMetric {
  const safe = safeNum(rawValue);
  return {
    label,
    formatted: format(safe) ?? '—',
    status: status ?? 'neutral',
    rawValue: safe,
    sublabel: opts?.sublabel,
    subvalue: opts?.subvalue,
    detail:   opts?.detail,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION MAPPERS
// Each maps one nullable API section to its fully-typed UiContractRoot section.
// ─────────────────────────────────────────────────────────────────────────────

function mapOverview(ov: OverviewMetrics | null): UiOverviewSection {
  const e2e   = safeNum(ov?.resume_end_to_end_conversion_rate);
  const p50   = safeNum(ov?.time_to_value_p50_ms);
  const p95   = safeNum(ov?.time_to_value_p95_ms);
  const fail  = safeNum(ov?.resume_failure_rate);

  return {
    endToEndConversion: buildMetric(
      'End-to-end conversion',
      e2e,
      fmtRate,
      rateStatus(e2e),
      { detail: 'upload_started → processing_done  ·  session-scoped' },
    ),
    timeToValueP50: buildMetric(
      'Time to value p50',
      p50,
      fmtMs,
      latencyStatus(p50),
      {
        sublabel: 'p95',
        subvalue: fmtMs(p95),
        detail: 'upload_started → processing_done  ·  v3 edge-case fix applied',
      },
    ),
    resumeFailureRate: buildMetric(
      'Resume failure rate',
      fail,
      fmtRate,
      failureStatus(fail),
      { detail: 'processing_failed / upload_started  ·  v4 denominator' },
    ),
  };
}

function mapResumeFunnel(rf: ResumeFunnelMetrics | null): UiResumeFunnelSection {
  const uploadStart  = safeNum(rf?.upload_start_count);
  const timeout      = safeNum(rf?.timeout_rate);
  const retrySuccess = safeNum(rf?.retry_success_rate);

  const funnelSteps: UiFunnelStep[] = rf ? [
    { label: 'Upload started',      value: rf.upload_start_count        ?? 0,   isRate: false, color: '#3b82f6' },
    { label: 'Upload success rate', value: rf.upload_success_rate       ?? 0,   isRate: true,  color: '#14b8a6' },
    { label: 'Processing success',  value: rf.processing_success_rate   ?? 0,   isRate: true,  color: '#22c55e' },
    { label: 'End-to-end conv.',    value: rf.end_to_end_conversion_rate ?? 0,  isRate: true,  color: '#a78bfa' },
    { label: 'Retry success',       value: rf.retry_success_rate        ?? 0,   isRate: true,  color: '#f59e0b' },
  ] : [];

  return {
    funnelSteps,
    uploadStartCount: buildMetric(
      'Upload start count',
      uploadStart,
      fmtCount,
      'neutral',
      { detail: 'COUNT(DISTINCT sessionId WHERE upload_started)' },
    ),
    timeoutRate: buildMetric(
      'Timeout rate',
      timeout,
      fmtRate,
      failureStatus(timeout, 0.03, 0.08),
      { detail: 'processing_failed[timeout] / upload_started  ·  v4 denominator' },
    ),
    retrySuccessRate: buildMetric(
      'Retry success rate',
      retrySuccess,
      fmtRate,
      retrySuccess !== null && retrySuccess < 0.3 ? 'critical' : 'neutral',
      { detail: 'Time-ordered: failure T1 → success T2, T2 > T1' },
    ),
  };
}

function mapOnboarding(ob: OnboardingFunnelMetrics | null): UiOnboardingSection {
  const startCount   = safeNum(ob?.onboarding_start_count);
  const completion   = safeNum(ob?.onboarding_completion_rate);

  const stepCompletionRows: UiBarChartRow[] =
    (ob?.step_completion_rate ?? []).map(s => ({
      label:   s?.step_key ?? '',
      value:   safeNum(s?.rate) ?? 0,
      isRate:  true,
    }));

  return {
    onboardingStartCount: buildMetric(
      'Onboarding start count',
      startCount,
      fmtCount,
      'neutral',
      { detail: 'COUNT(DISTINCT sessionId WHERE onboarding_started)' },
    ),
    completionRate: buildMetric(
      'Completion rate',
      completion,
      fmtRate,
      rateStatus(completion, 0.7, 0.5),
      { detail: 'onboarding_completed / onboarding_started' },
    ),
    stepCompletionRows,
  };
}

function mapPerformance(pf: PerformanceMetrics | null): UiPerformanceSection {
  const p50ms  = safeNum(pf?.processing_p50_ms);
  const p95ms  = safeNum(pf?.processing_p95_ms);
  const p99ms  = safeNum(pf?.processing_p99_ms);
  const tvP50  = safeNum(pf?.time_to_value_p50_ms);
  const tvP95  = safeNum(pf?.time_to_value_p95_ms);
  const avgAtt = safeNum(pf?.avg_attempts_per_resume);
  const avgUpl = safeNum(pf?.avg_upload_duration_ms);
  const avgOnb = safeNum(pf?.avg_total_onboarding_time_ms);
  const avgStp = safeNum(pf?.avg_step_time_ms);

  return {
    processingLatency: {
      label: 'Resume processing latency',
      p50: p50ms,
      p95: p95ms,
      p99: p99ms,
    } satisfies UiPercentileSet,
    timeToValue: {
      label: 'Time to value (upload_started → processing_done)',
      p50: tvP50,
      p95: tvP95,
    } satisfies UiPercentileSet,
    avgAttemptsPerResume: buildMetric(
      'Avg attempts per resume',
      avgAtt,
      v => fmtDecimal(v),
      'neutral',
      { detail: 'Average poll cycles before terminal state' },
    ),
    avgUploadDuration: buildMetric(
      'Avg upload duration',
      avgUpl,
      fmtMs,
      'neutral',
      { detail: 'Transport latency (not including processing)' },
    ),
    avgOnboardingTime: buildMetric(
      'Avg onboarding time',
      avgOnb,
      fmtMs,
      'neutral',
      { detail: 'onboarding_started → onboarding_completed' },
    ),
    avgStepTime: buildMetric(
      'Avg step time',
      avgStp,
      fmtMs,
      'neutral',
      { detail: 'Per-step average across all steps' },
    ),
  };
}

function mapReliability(rl: ReliabilityMetrics | null): UiReliabilitySection {
  const failRate    = safeNum(rl?.resume_failure_rate);
  const timeout     = safeNum(rl?.timeout_rate);
  const retry       = safeNum(rl?.retry_success_rate);
  const errPerSess  = safeNum(rl?.resume_errors_per_session);
  const monErr      = safeNum(rl?.monitoring_error_rate);
  const onbErr      = safeNum(rl?.onboarding_error_rate);

  return {
    resumeFailureRate: buildMetric(
      'Resume failure rate',
      failRate,
      fmtRate,
      failureStatus(failRate),
      { detail: 'processing_failed / upload_started' },
    ),
    timeoutRate: buildMetric(
      'Timeout rate',
      timeout,
      fmtRate,
      failureStatus(timeout, 0.03, 0.08),
      { detail: 'processing_failed[timeout] / upload_started  ·  v4 unified denominator' },
    ),
    retrySuccessRate: buildMetric(
      'Retry success rate',
      retry,
      fmtRate,
      retry !== null && retry < 0.3 ? 'warning' : 'neutral',
      { detail: 'Time-ordered failure → success per session' },
    ),
    errorsPer100Sessions: buildMetric(
      'Errors per 100 sessions',
      errPerSess !== null ? errPerSess * 100 : null,
      v => fmtDecimal(v, 1),
      failureStatus(errPerSess, 0.05, 0.1),
      { detail: 'resume_errors per 100 upload_started sessions' },
    ),
    monitoringErrorRate: buildMetric(
      'Monitoring error rate',
      monErr,
      fmtRate,
      failureStatus(monErr),
      { detail: 'captureError calls / upload_started' },
    ),
    onboardingErrorRate: buildMetric(
      'Onboarding error rate',
      onbErr,
      fmtRate,
      failureStatus(onbErr),
      { detail: 'onboarding_step_error / onboarding_started' },
    ),
  };
}

function mapExperiments(ex: ExperimentMetrics | null): UiExperimentsSection {
  const flagExposureRows: UiBarChartRow[] = ex?.flag_exposure_count
    ? Object.entries(ex.flag_exposure_count).map(([variant, count]) => ({
        label:  variant ?? '',
        value:  safeNum(count) ?? 0,
        isRate: false,
      }))
    : [];

  const variantConversionRows: UiBarChartRow[] =
    (ex?.conversion_by_variant ?? []).map(v => ({
      label:    v?.variant ?? '',
      value:    safeNum(v?.conversion_rate) ?? 0,
      isRate:   true,
      sublabel: fmtCount(v?.session_count),
    }));

  const variantTable: UiVariantTableRow[] =
    (ex?.conversion_by_variant ?? []).map(row => {
      const lift = safeNum(row?.relative_lift);
      return {
        variant:        row?.variant ?? '',
        sessions:       fmtCount(row?.session_count),
        conversionRate: fmtRate(row?.conversion_rate),
        relativeLift:   lift != null
          ? `${lift >= 0 ? '+' : ''}${(lift * 100).toFixed(1)}%`
          : '— (control)',
        liftIsPositive: lift != null ? lift >= 0 : null,
      };
    });

  return {
    flagExposureRows,
    variantConversionRows,
    variantTable,
  };
}

function mapDerived(d: AnalyticsMapperInput['derived']): UiDerivedSection {
  const health   = safeNum(d.overallHealthScore);
  const dropOff  = safeNum(d.processingDropOffRate);
  const upload   = safeNum(d.uploadDropOffRate);
  const gap      = safeNum(d.onboardingResumeGap);
  const ratio    = safeNum(d.p95OverP50Ratio);
  const waste    = safeNum(d.estimatedRetryWaste);

  // Health score: 0–100 display
  const healthFormatted = health != null
    ? `${(health * 100).toFixed(0)}/100`
    : '—';
  const healthStatus: MetricStatus =
    health === null     ? 'neutral'  :
    health >= 0.8       ? 'good'     :
    health >= 0.6       ? 'warning'  : 'critical';

  // Gap: signed pp display
  const gapFormatted = gap != null
    ? `${gap >= 0 ? '+' : ''}${(gap * 100).toFixed(1)}pp`
    : '—';
  const gapStatus: MetricStatus =
    gap === null                   ? 'neutral' :
    Math.abs(gap) < 0.05           ? 'good'    :
    Math.abs(gap) < 0.15           ? 'warning' : 'critical';

  // Ratio: multiplier display
  const ratioFormatted = ratio != null ? `${ratio.toFixed(1)}×` : '—';
  const ratioStatus: MetricStatus =
    ratio === null  ? 'neutral'  :
    ratio <= 2      ? 'good'     :
    ratio <= 4      ? 'warning'  : 'critical';

  return {
    overallHealthScore: {
      label:     'Overall health score',
      formatted: healthFormatted,
      status:    healthStatus,
      rawValue:  health,
      detail:    '0.6×conversion + 0.2×(1−failure) + 0.2×(1−timeout) — single-glance signal',
    },
    processingDropOffRate: {
      label:     'Processing drop-off',
      formatted: fmtRate(dropOff),
      status:    failureStatus(dropOff, 0.05, 0.15),
      rawValue:  dropOff,
      detail:    'upload_success_rate − e2e_conversion — pure backend loss after upload',
    },
    uploadDropOffRate: {
      label:     'Upload drop-off',
      formatted: fmtRate(upload),
      status:    failureStatus(upload, 0.1, 0.2),
      rawValue:  upload,
      detail:    '1 − upload_success_rate — sessions lost before server',
    },
    onboardingResumeGap: {
      label:     'Onboarding ↔ resume gap',
      formatted: gapFormatted,
      status:    gapStatus,
      rawValue:  gap,
      detail:    '+pp → onboarding ahead of upload (cross-sell gap) · −pp → upload ahead of onboarding',
    },
    p95OverP50Ratio: {
      label:     'p95 / p50 latency ratio',
      formatted: ratioFormatted,
      status:    ratioStatus,
      rawValue:  ratio,
      detail:    'processing_p95 / processing_p50 — tail latency spread; >3× indicates outliers',
    },
    estimatedRetryWaste: {
      label:     'Est. retry waste',
      formatted: waste != null ? fmtCount(waste) : '—',
      status:    'neutral',
      rawValue:  waste,
      detail:    'sessions where retry was attempted but ultimately timed out again',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT MAPPER — the single public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps raw API metric payloads → a fully-typed, null-safe UiContractRoot.
 *
 * Called inside the hook (useMetrics) after parsing — NEVER from UI components.
 *
 * Guarantees:
 *  - Returns UiContractRoot — all fields populated, no undefined
 *  - Every metric.formatted is a string (never undefined or null)
 *  - Every metric.status is a valid MetricStatus
 *  - Every array field is [] when source is missing
 *  - Every rawValue is number | null (never NaN, never undefined)
 *
 * @param input  All six sections (nullable) + pre-computed derived values
 */
export function mapApiToUiContract(input: AnalyticsMapperInput): UiContractRoot {
  return {
    overview:     mapOverview(input.overview),
    resumeFunnel: mapResumeFunnel(input.resumeFunnel),
    onboarding:   mapOnboarding(input.onboarding),
    performance:  mapPerformance(input.performance),
    reliability:  mapReliability(input.reliability),
    experiments:  mapExperiments(input.experiments),
    derived:      mapDerived(input.derived),
  };
}