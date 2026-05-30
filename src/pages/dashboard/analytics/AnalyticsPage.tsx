/**
 * @file app/dashboard/analytics/page.tsx
 * @description Analytics Dashboard Page — orchestrates all metric sections.
 *
 * RESPONSIBILITIES (pages layer only):
 *  - Call useMetrics() once — single data source
 *  - Call useAppContext() for hydration guard
 *  - Compose UI sections from components/analytics
 *  - Handle page-level loading + error + empty states
 *  - Pass filter callbacks from useMetrics down to FilterBar
 *  - Map raw metric data → display-ready props (formatting in fmtRate/fmtMs)
 *
 * HARD RULES:
 *  - NO API calls — ALL data comes through useMetrics()
 *  - NO business logic — data mapping only (label + value pairs)
 *  - Guards checked before rendering — redirect if not hydrated/authed
 *
 * Architecture position: Pages layer (fourth tier)
 *   API → Hooks → UI → Pages → Guards → Context
 *
 * PHASE 3 REFINEMENTS:
 *  - Each DashboardSection is wrapped in an ErrorBoundary with SectionErrorFallback.
 *    This isolates individual section crashes: a broken Experiments section does
 *    not take down Overview or Performance.
 *  - resetKey={filterKey} is applied to every section boundary. When the user
 *    changes a filter, all section boundaries auto-reset so stale error states
 *    from a previous filter combo are cleared before the new data renders.
 *  - The outer page-level ErrorBoundary catches any error that escapes the
 *    section boundaries (e.g. in PageShell itself).
 *
 * Dashboard sections:
 *  1. Overview        — headline KPIs
 *  2. Derived Signals — cross-section computed metrics
 *  3. Resume Funnel   — upload + processing funnel
 *  4. Onboarding      — completion + step breakdown
 *  5. Performance     — latency percentiles + attempt stats
 *  6. Reliability     — failure + timeout + error rates
 *  7. Experiments     — variant exposure + conversion
 */

import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/context/AppContext';
import { useMetrics } from '@/hooks/useMetrics';
import type { StepCompletionBreakdown, VariantConversionRow } from '@/lib/api/metrics';
import { assertExhaustive } from '@/lib/mappers/metricsMapper';
import { ErrorBoundary }        from '@/components/system';
import { SectionErrorFallback } from '@/components/system';
import { PageShell } from '@/components/ui';
import {
  FilterBar,
  DashboardSection,
  MetricGrid,
  MetricCard,
  FunnelChart,
  BarChart,
  PercentileDisplay,
  LoadingState,
  ErrorState,
  type MetricCardStatus,
} from '@/components/analytics';
import {
  fmtRate,
  fmtMs,
  fmtCount,
  fmtDecimal,
} from '@/components/analytics/formatters';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — pure mapping functions; no state, no side effects
// ─────────────────────────────────────────────────────────────────────────────

function rateStatus(
  value: number | null | undefined,
  goodThreshold = 0.8,
  warnThreshold = 0.6,
): MetricCardStatus | undefined {
  if (value == null || Number.isNaN(value)) return undefined;
  type Tier = 'good' | 'warning' | 'critical';
  const tier: Tier =
    value >= goodThreshold ? 'good'     :
    value >= warnThreshold ? 'warning'  : 'critical';
  switch (tier) {
    case 'good':     return 'good';
    case 'warning':  return 'warning';
    case 'critical': return 'critical';
    default:         return assertExhaustive(tier);
  }
}

function failureStatus(
  value: number | null | undefined,
  warnThreshold = 0.05,
  critThreshold = 0.1,
): MetricCardStatus | undefined {
  if (value == null || Number.isNaN(value)) return undefined;
  type Tier = 'good' | 'warning' | 'critical';
  const tier: Tier =
    value >= critThreshold ? 'critical' :
    value >= warnThreshold ? 'warning'  : 'good';
  switch (tier) {
    case 'good':     return 'good';
    case 'warning':  return 'warning';
    case 'critical': return 'critical';
    default:         return assertExhaustive(tier);
  }
}

function latencyStatus(
  valueMs: number | null | undefined,
  goodMs = 10_000,
  warnMs = 30_000,
): MetricCardStatus | undefined {
  if (valueMs == null || Number.isNaN(valueMs)) return undefined;
  type Tier = 'good' | 'warning' | 'critical';
  const tier: Tier =
    valueMs < goodMs ? 'good'    :
    valueMs < warnMs ? 'warning' : 'critical';
  switch (tier) {
    case 'good':     return 'good';
    case 'warning':  return 'warning';
    case 'critical': return 'critical';
    default:         return assertExhaustive(tier);
  }
}

function ratioStatus(
  ratio: number | null | undefined,
  goodMax = 2,
  warnMax = 4,
): MetricCardStatus | undefined {
  if (ratio == null || Number.isNaN(ratio)) return undefined;
  type Tier = 'good' | 'warning' | 'critical';
  const tier: Tier =
    ratio <= goodMax ? 'good'    :
    ratio <= warnMax ? 'warning' : 'critical';
  switch (tier) {
    case 'good':     return 'good';
    case 'warning':  return 'warning';
    case 'critical': return 'critical';
    default:         return assertExhaustive(tier);
  }
}

function gapStatus(
  gap: number | null | undefined,
  goodMaxAbs = 0.05,
  warnMaxAbs = 0.15,
): MetricCardStatus | undefined {
  if (gap == null || Number.isNaN(gap)) return undefined;
  const abs = Math.abs(gap);
  type Tier = 'good' | 'warning' | 'critical';
  const tier: Tier =
    abs < goodMaxAbs ? 'good'    :
    abs < warnMaxAbs ? 'warning' : 'critical';
  switch (tier) {
    case 'good':     return 'good';
    case 'warning':  return 'warning';
    case 'critical': return 'critical';
    default:         return assertExhaustive(tier);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function AnalyticsDashboardPage() {
  const navigate = useNavigate();
  const { user, isHydrated } = useAppContext();

  useEffect(() => {
    if (!isHydrated) return;
    if (!user) {
      navigate('/', { replace: true });
    }
  }, [isHydrated, user, navigate]);

  const {
    overview,
    resumeFunnel,
    onboarding,
    performance,
    reliability,
    experiments,
    derived,
    isAnyLoading,
    isAllError,
    isAnyStale,
    firstError,
    filters,
    setFilters,
    clearFilters,
    refetchAll,
  } = useMetrics();

  // ── Stable resetKey derived from active filters ────────────────────────────
  // JSON.stringify produces a stable string so ErrorBoundary's strict equality
  // check (prevProps.resetKey !== this.props.resetKey) correctly detects changes.
  // Memoized so the string is only recomputed when filters actually change.
  const filterKey = useMemo(() => JSON.stringify(filters, Object.keys(filters).sort()), [filters]);

  // ── Pre-render guards ─────────────────────────────────────────────────────
  if (!isHydrated) {
    return (
      <PageShell>
        <LoadingState rows={6} label="Checking session…" />
      </PageShell>
    );
  }
  if (!user) return null;

  if (firstError) {
    let errorMessage: string;
    if (firstError.isRateLimit) {
      errorMessage = 'Too many requests. Please wait and try again.';
    } else if (firstError.isServerError) {
      errorMessage = 'Server error. Please try again later.';
    } else {
      errorMessage = 'Something went wrong. Please try again.';
    }
    return (
      <PageShell>
        <ErrorState message={errorMessage} onRetry={refetchAll} />
      </PageShell>
    );
  }

  if (isAllError) {
    return (
      <PageShell>
        <ErrorState
          message="All metric sections failed to load. Check your connection and try again."
          onRetry={refetchAll}
        />
      </PageShell>
    );
  }

  const hasAnyData =
    overview.data != null ||
    resumeFunnel.data != null ||
    performance.data != null;

  if (isAnyLoading && !hasAnyData) {
    return (
      <PageShell>
        <FilterBar filters={filters} onFiltersChange={setFilters} onClear={clearFilters} />
        <div style={{ marginTop: 24 }}>
          <LoadingState rows={8} label="Loading analytics dashboard…" />
        </div>
      </PageShell>
    );
  }

  // ── Data shapes ───────────────────────────────────────────────────────────
  const ov = overview.data;
  const rf = resumeFunnel.data;
  const ob = onboarding.data;
  const pf = performance.data;
  const rl = reliability.data;
  const ex = experiments.data;

  const resumeFunnelSteps = rf ? [
    { label: 'Upload started',      value: rf.upload_start_count,         isRate: false, color: '#3b82f6' },
    { label: 'Upload success rate', value: rf.upload_success_rate,        isRate: true,  color: '#14b8a6' },
    { label: 'Processing success',  value: rf.processing_success_rate,    isRate: true,  color: '#22c55e' },
    { label: 'End-to-end conv.',    value: rf.end_to_end_conversion_rate, isRate: true,  color: '#a78bfa' },
    { label: 'Retry success',       value: rf.retry_success_rate,         isRate: true,  color: '#f59e0b' },
  ] : [];

  const stepCompletionRows = ob?.step_completion_rate?.map((s: StepCompletionBreakdown) => ({
    label: s.step_key,
    value: s.rate,
    isRate: true,
  })) ?? [];

  const variantRows = ex?.conversion_by_variant?.map((v: VariantConversionRow) => ({
    label:    v.variant,
    value:    v.conversion_rate,
    isRate:   true,
    sublabel: fmtCount(v.session_count),
  })) ?? [];

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <AnalyticsShell>
      {isAnyStale && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 14px',
          marginBottom: 12,
          background: '#1a2236',
          border: '1px solid #1f2d45',
          borderRadius: 8,
          fontSize: 12,
          color: '#8899b0',
        }}>
          <span style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#f59e0b',
            flexShrink: 0,
            animation: '_pulse 1.2s ease-in-out infinite',
          }} />
          <style>{`@keyframes _pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
          Refreshing data in the background…
          <button
            onClick={refetchAll}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              color: '#3b82f6',
              fontSize: 12,
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            Force refresh
          </button>
        </div>
      )}

      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        onClear={clearFilters}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 20 }}>

        {/* ── 1. Overview ──────────────────────────────────────────────── */}
        {/*
          resetKey={filterKey}: when the user changes a filter, any previously
          crashed overview section auto-resets so the new filter's data renders
          cleanly rather than showing a stale error state.
        */}
        <ErrorBoundary
          resetKey={filterKey}
          fallback={<SectionErrorFallback section="Overview" />}
        >
          <DashboardSection
            title="Overview"
            subtitle="Headline conversion, speed, and reliability KPIs"
            isLoading={overview.isLoading && !overview.data}
            error={overview.error}
            isEmpty={!overview.isLoading && !overview.data}
            onRetry={refetchAll}
            loadingRows={2}
            badge="Live"
            dataUpdatedAt={overview.dataUpdatedAt}
          >
            <MetricGrid>
              <MetricCard
                label="End-to-end conversion"
                value={fmtRate(ov?.resume_end_to_end_conversion_rate)}
                status={rateStatus(ov?.resume_end_to_end_conversion_rate ?? null)}
                detail="upload_started → processing_done  ·  session-scoped"
              />
              <MetricCard
                label="Time to value p50"
                value={fmtMs(ov?.time_to_value_p50_ms)}
                sublabel="p95"
                subvalue={fmtMs(ov?.time_to_value_p95_ms)}
                status={latencyStatus(ov?.time_to_value_p50_ms)}
                detail="upload_started → processing_done  ·  v3 edge-case fix applied"
              />
              <MetricCard
                label="Resume failure rate"
                value={fmtRate(ov?.resume_failure_rate)}
                status={failureStatus(ov?.resume_failure_rate ?? null)}
                detail="processing_failed / upload_started  ·  v4 denominator"
              />
            </MetricGrid>
          </DashboardSection>
        </ErrorBoundary>

        {/* ── 1b. Derived Signals ──────────────────────────────────────── */}
        <ErrorBoundary
          resetKey={filterKey}
          fallback={<SectionErrorFallback section="Derived Signals" />}
        >
          <DashboardSection
            title="Derived Signals"
            subtitle="Cross-section metrics computed from funnel, reliability, and performance data"
            isLoading={!resumeFunnel.data && !reliability.data && !performance.data && !onboarding.data}
            isEmpty={
              !resumeFunnel.isLoading &&
              !reliability.isLoading &&
              !resumeFunnel.data &&
              !reliability.data
            }
            onRetry={refetchAll}
            loadingRows={2}
            badge="computed"
            dataUpdatedAt={
              [resumeFunnel.dataUpdatedAt, reliability.dataUpdatedAt,
               performance.dataUpdatedAt, onboarding.dataUpdatedAt]
                .filter(Boolean)
                .reduce((min, t) => (t < min ? t : min), Infinity) || undefined
            }
          >
            <MetricGrid>
              <MetricCard
                label="Overall health score"
                value={derived.overallHealthScore != null
                  ? `${(derived.overallHealthScore * 100).toFixed(0)}/100`
                  : '—'}
                status={rateStatus(derived.overallHealthScore, 0.8, 0.6)}
                detail="0.6×conversion + 0.2×(1−failure) + 0.2×(1−timeout) — single-glance signal"
              />
              <MetricCard
                label="Processing drop-off"
                value={fmtRate(derived.processingDropOffRate)}
                status={failureStatus(derived.processingDropOffRate ?? null, 0.05, 0.15)}
                detail="upload_success_rate − e2e_conversion — pure backend loss after upload"
              />
              <MetricCard
                label="Upload drop-off"
                value={fmtRate(derived.uploadDropOffRate)}
                status={failureStatus(derived.uploadDropOffRate ?? null, 0.1, 0.2)}
                detail="1 − upload_success_rate — sessions lost before server"
              />
              <MetricCard
                label="Onboarding ↔ resume gap"
                value={derived.onboardingResumeGap != null
                  ? `${derived.onboardingResumeGap >= 0 ? '+' : ''}${(derived.onboardingResumeGap * 100).toFixed(1)}pp`
                  : '—'}
                status={gapStatus(derived.onboardingResumeGap)}
                detail="+pp → onboarding ahead of upload (cross-sell gap) · −pp → upload ahead of onboarding"
              />
              <MetricCard
                label="p95 / p50 latency ratio"
                value={derived.p95OverP50Ratio != null
                  ? `${derived.p95OverP50Ratio.toFixed(1)}×`
                  : '—'}
                status={ratioStatus(derived.p95OverP50Ratio)}
                detail="processing_p95 / processing_p50 — tail latency spread; >3× indicates outliers"
              />
              <MetricCard
                label="Est. retry waste"
                value={derived.estimatedRetryWaste != null
                  ? fmtCount(derived.estimatedRetryWaste)
                  : '—'}
                status="neutral"
                detail="sessions where retry was attempted but ultimately timed out again"
              />
            </MetricGrid>
          </DashboardSection>
        </ErrorBoundary>

        {/* ── 2. Resume Funnel ─────────────────────────────────────────── */}
        <ErrorBoundary
          resetKey={filterKey}
          fallback={<SectionErrorFallback section="Resume Funnel" />}
        >
          <DashboardSection
            title="Resume Funnel"
            subtitle="Session-scoped upload and processing pipeline (v4 schema · sessionId grain)"
            isLoading={resumeFunnel.isLoading && !resumeFunnel.data}
            error={resumeFunnel.error}
            isEmpty={!resumeFunnel.isLoading && !resumeFunnel.data}
            onRetry={refetchAll}
            dataUpdatedAt={resumeFunnel.dataUpdatedAt}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <FunnelChart steps={resumeFunnelSteps} title="Funnel rates" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <MetricCard
                  label="Upload start count"
                  value={fmtCount(rf?.upload_start_count)}
                  detail="COUNT(DISTINCT sessionId WHERE upload_started)"
                />
                <MetricCard
                  label="Timeout rate"
                  value={fmtRate(rf?.timeout_rate)}
                  status={failureStatus(rf?.timeout_rate ?? null, 0.03, 0.08)}
                  detail="processing_failed[timeout] / upload_started  ·  v4 denominator"
                />
                <MetricCard
                  label="Retry success rate"
                  value={fmtRate(rf?.retry_success_rate)}
                  status={rateStatus(rf?.retry_success_rate, 1.0, 0.3)}
                  detail="Time-ordered: failure T1 → success T2, T2 > T1"
                />
              </div>
            </div>
          </DashboardSection>
        </ErrorBoundary>

        {/* ── 3. Onboarding Funnel ──────────────────────────────────────── */}
        <ErrorBoundary
          resetKey={filterKey}
          fallback={<SectionErrorFallback section="Onboarding Funnel" />}
        >
          <DashboardSection
            title="Onboarding Funnel"
            subtitle="Completion and step-level breakdown by variant"
            isLoading={onboarding.isLoading && !onboarding.data}
            error={onboarding.error}
            isEmpty={!onboarding.isLoading && !onboarding.data}
            onRetry={refetchAll}
            dataUpdatedAt={onboarding.dataUpdatedAt}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <MetricCard
                  label="Onboarding start count"
                  value={fmtCount(ob?.onboarding_start_count)}
                  detail="COUNT(DISTINCT sessionId WHERE onboarding_started)"
                />
                <MetricCard
                  label="Completion rate"
                  value={fmtRate(ob?.onboarding_completion_rate)}
                  status={rateStatus(ob?.onboarding_completion_rate ?? null, 0.7, 0.5)}
                  detail="onboarding_completed / onboarding_started"
                />
              </div>
              {stepCompletionRows.length > 0 ? (
                <BarChart rows={stepCompletionRows} title="Step completion rates" />
              ) : (
                <div />
              )}
            </div>
          </DashboardSection>
        </ErrorBoundary>

        {/* ── 4. Performance ───────────────────────────────────────────── */}
        <ErrorBoundary
          resetKey={filterKey}
          fallback={<SectionErrorFallback section="Performance" />}
        >
          <DashboardSection
            title="Performance"
            subtitle="Processing latency percentiles, attempt counts, and time-to-value"
            isLoading={performance.isLoading && !performance.data}
            error={performance.error}
            isEmpty={!performance.isLoading && !performance.data}
            onRetry={refetchAll}
            dataUpdatedAt={performance.dataUpdatedAt}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <PercentileDisplay
                label="Resume processing latency"
                p50={pf?.processing_p50_ms ?? null}
                p95={pf?.processing_p95_ms ?? null}
                p99={pf?.processing_p99_ms ?? null}
                formatter={fmtMs}
              />
              <PercentileDisplay
                label="Time to value (upload_started → processing_done)"
                p50={pf?.time_to_value_p50_ms ?? null}
                p95={pf?.time_to_value_p95_ms ?? null}
                formatter={fmtMs}
              />
              <MetricGrid>
                <MetricCard
                  label="Avg attempts per resume"
                  value={fmtDecimal(pf?.avg_attempts_per_resume)}
                  detail="Average poll cycles before terminal state"
                />
                <MetricCard
                  label="Avg upload duration"
                  value={fmtMs(pf?.avg_upload_duration_ms)}
                  detail="Transport latency (not including processing)"
                />
                <MetricCard
                  label="Avg onboarding time"
                  value={fmtMs(pf?.avg_total_onboarding_time_ms)}
                  detail="onboarding_started → onboarding_completed"
                />
                <MetricCard
                  label="Avg step time"
                  value={fmtMs(pf?.avg_step_time_ms)}
                  detail="Per-step average across all steps"
                />
              </MetricGrid>
            </div>
          </DashboardSection>
        </ErrorBoundary>

        {/* ── 5. Reliability ───────────────────────────────────────────── */}
        <ErrorBoundary
          resetKey={filterKey}
          fallback={<SectionErrorFallback section="Reliability" />}
        >
          <DashboardSection
            title="Reliability"
            subtitle="Failure, timeout, and error rates — all denominated on upload_started (v4)"
            isLoading={reliability.isLoading && !reliability.data}
            error={reliability.error}
            isEmpty={!reliability.isLoading && !reliability.data}
            onRetry={refetchAll}
            dataUpdatedAt={reliability.dataUpdatedAt}
          >
            <MetricGrid>
              <MetricCard
                label="Resume failure rate"
                value={fmtRate(rl?.resume_failure_rate)}
                status={failureStatus(rl?.resume_failure_rate ?? null)}
                detail="processing_failed / upload_started"
              />
              <MetricCard
                label="Timeout rate"
                value={fmtRate(rl?.timeout_rate)}
                status={failureStatus(rl?.timeout_rate ?? null, 0.03, 0.08)}
                detail="processing_failed[timeout] / upload_started  ·  v4 unified denominator"
              />
              <MetricCard
                label="Retry success rate"
                value={fmtRate(rl?.retry_success_rate)}
                status={rateStatus(rl?.retry_success_rate, 1.0, 0.3)}
                detail="Time-ordered failure → success per session"
              />
              <MetricCard
                label="Errors per 100 sessions"
                value={fmtDecimal(rl?.resume_errors_per_session != null ? rl.resume_errors_per_session * 100 : null, 1)}
                status={failureStatus(rl?.resume_errors_per_session ?? null, 0.05, 0.1)}
                detail="resume_errors per 100 upload_started sessions"
              />
              <MetricCard
                label="Monitoring error rate"
                value={fmtRate(rl?.monitoring_error_rate)}
                status={failureStatus(rl?.monitoring_error_rate ?? null)}
                detail="captureError calls / upload_started"
              />
              <MetricCard
                label="Onboarding error rate"
                value={fmtRate(rl?.onboarding_error_rate)}
                status={failureStatus(rl?.onboarding_error_rate ?? null)}
                detail="onboarding_step_error / onboarding_started"
              />
            </MetricGrid>
          </DashboardSection>
        </ErrorBoundary>

        {/* ── 6. Experiments ───────────────────────────────────────────── */}
        <ErrorBoundary
          resetKey={filterKey}
          fallback={<SectionErrorFallback section="Experiments" />}
        >
          <DashboardSection
            title="Experiments"
            subtitle="Feature flag exposure counts and conversion by variant"
            isLoading={experiments.isLoading && !experiments.data}
            error={experiments.error}
            isEmpty={!experiments.isLoading && !experiments.data}
            onRetry={refetchAll}
            badge="A/B"
            dataUpdatedAt={experiments.dataUpdatedAt}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {ex?.flag_exposure_count && Object.keys(ex.flag_exposure_count).length > 0 && (
                <BarChart
                  title="Flag exposure counts"
                  rows={Object.entries(ex.flag_exposure_count).map(([variant, count]) => ({
                    label: variant,
                    value: count as number,
                    isRate: false,
                  }))}
                />
              )}
              {variantRows.length > 0 && (
                <BarChart title="Conversion by variant" rows={variantRows} />
              )}
            </div>

            {ex?.conversion_by_variant && ex.conversion_by_variant.length > 0 && (
              <div style={{ marginTop: 20, overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 12,
                  fontFamily: 'monospace',
                }}>
                  <thead>
                    <tr>
                      {(['Variant', 'Sessions', 'Conversion rate', 'Relative lift'] as const).map(h => (
                        <th key={h} style={{
                          textAlign: 'left',
                          padding: '8px 12px',
                          borderBottom: '1px solid #1f2d45',
                          color: '#4d6080',
                          textTransform: 'uppercase',
                          letterSpacing: '0.07em',
                          fontSize: 10,
                          fontWeight: 500,
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ex.conversion_by_variant.map((row: VariantConversionRow) => (
                      <tr key={row.variant} style={{ borderBottom: '1px solid #1a2236' }}>
                        <td style={{ padding: '10px 12px', color: '#e8edf5' }}>{row.variant}</td>
                        <td style={{ padding: '10px 12px', color: '#8899b0' }}>{fmtCount(row.session_count)}</td>
                        <td style={{ padding: '10px 12px', color: '#22c55e' }}>{fmtRate(row.conversion_rate)}</td>
                        <td style={{ padding: '10px 12px', color: row.relative_lift == null ? '#4d6080' : row.relative_lift >= 0 ? '#22c55e' : '#ef4444' }}>
                          {row.relative_lift != null ? `${row.relative_lift >= 0 ? '+' : ''}${(row.relative_lift * 100).toFixed(1)}%` : '— (control)'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DashboardSection>
        </ErrorBoundary>

      </div>
    </AnalyticsShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS SHELL — custom chrome for the analytics dashboard
//
// This is intentionally separate from the shared <PageShell> primitive
// (src/components/ui/PageShell.tsx). The analytics dashboard has a bespoke
// dark theme and header that does not fit the semantic layout primitive.
// Named AnalyticsShell to avoid shadowing the shared PageShell import.
// ─────────────────────────────────────────────────────────────────────────────

function AnalyticsShell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{
      minHeight: '100vh',
      background: '#0b0f1a',
      color: '#e8edf5',
      fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <h1 style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#e8edf5',
              margin: 0,
              letterSpacing: '-0.025em',
            }}>
              Analytics
            </h1>
            <span style={{
              fontSize: 10,
              fontFamily: 'monospace',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '3px 8px',
              borderRadius: 4,
              background: '#111827',
              border: '1px solid #1f2d45',
              color: '#14b8a6',
            }}>
              Phase 2 · v4 schema
            </span>
          </div>
          <p style={{ color: '#4d6080', fontSize: 13, margin: 0 }}>
            Product intelligence — resume funnel, onboarding, performance, reliability, experiments
          </p>
        </div>
        {children}
      </div>
    </main>
  );
}