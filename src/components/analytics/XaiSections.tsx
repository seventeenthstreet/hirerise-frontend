/**
 * @file src/components/analytics/XaiSections.tsx
 * @description WP-7 XAI Operations Dashboard section components.
 *
 * HARD RULES (inherited from components/analytics):
 *  - NO API calls — zero imports from lib/api/*
 *  - NO business logic — no computation beyond formatting
 *  - NO hooks that fetch data — only React state for local UI
 *  - ALL data arrives via props
 *  - ALL logic lives in useXaiDashboard (hooks layer)
 *
 * Components exported:
 *  - SystemHealthSection       — status badge + build info + error rate
 *  - XaiUsageSection           — explanation request counts + latency
 *  - XaiTierSection            — tier distribution bars + exposure rate
 *  - XaiPhase1EmptyState       — Phase 1 informational placeholder
 *
 * Existing components used exactly as exported from @/components/analytics:
 *  DashboardSection, MetricCard, MetricGrid, LoadingState, ErrorState
 *
 * Architecture position: UI layer (third tier)
 *   API → Hooks → UI → Pages → Guards → Context
 */

import type { SystemHealthResponse }       from '@/lib/api/metrics';
import type { XaiUsageMetrics }            from '@/lib/api/metrics';
import type { XaiTierDistributionMetrics } from '@/lib/api/metrics';
import type { MetricSectionState }         from '@/hooks/useMetrics';
import {
  DashboardSection,
  MetricCard,
  MetricGrid,
  LoadingState,
  ErrorState,
} from '@/components/analytics';

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS  (mirrors T object in components/analytics/index.tsx)
// ─────────────────────────────────────────────────────────────────────────────

const T = {
  surface:      '#111827',
  border:       '#1f2d45',
  textSecondary:'#8899b0',
  textMuted:    '#4d6080',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// FORMATTERS  (scoped to this file — no business logic)
// ─────────────────────────────────────────────────────────────────────────────

function fmtRate(v: number): string {
  if (v === 0) return '—';
  return `${(v * 100).toFixed(1)}%`;
}

function fmtMs(v: number): string {
  if (v === 0) return '—';
  return v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`;
}

function fmtCount(v: number): string {
  if (v === 0) return '—';
  return v.toLocaleString();
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS HELPERS
// ─────────────────────────────────────────────────────────────────────────────

import type { MetricCardStatus } from '@/components/analytics';

function healthStatus(status: SystemHealthResponse['status'] | undefined): MetricCardStatus {
  switch (status) {
    case 'healthy':  return 'good';
    case 'degraded': return 'warning';
    case 'down':     return 'critical';
    default:         return 'neutral';
  }
}

function rateStatus(value: number, good = 0.95, warn = 0.80): MetricCardStatus {
  if (value === 0) return 'neutral';
  return value >= good ? 'good' : value >= warn ? 'warning' : 'critical';
}

function failureStatus(value: number, warn = 0.05, crit = 0.10): MetricCardStatus {
  if (value === 0) return 'neutral';
  return value >= crit ? 'critical' : value >= warn ? 'warning' : 'good';
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — SYSTEM HEALTH
// ─────────────────────────────────────────────────────────────────────────────

interface SystemHealthSectionProps {
  state: MetricSectionState<SystemHealthResponse>;
  onRetry?: () => void;
}

export function SystemHealthSection({ state, onRetry }: SystemHealthSectionProps) {
  const { data, isLoading, error, dataUpdatedAt } = state;

  return (
    <DashboardSection
      title="System Health"
      subtitle="Live environment status, build version, and error rate."
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      dataUpdatedAt={dataUpdatedAt}
    >
      {data && (
        <MetricGrid>
          <MetricCard
            label="Status"
            value={data.status}
            status={healthStatus(data.status)}
          />
          <MetricCard
            label="Environment"
            value={data.environment}
          />
          <MetricCard
            label="Build version"
            value={data.build_version}
          />
          <MetricCard
            label="Error rate (24 h)"
            value={data.error_rate_24h === 0 ? '—' : `${data.error_rate_24h.toFixed(2)}/hr`}
            status={data.error_rate_24h === 0 ? 'good' : data.error_rate_24h < 1 ? 'warning' : 'critical'}
            sublabel={`Checked ${new Date(data.checked_at).toLocaleTimeString()}`}
          />
        </MetricGrid>
      )}
    </DashboardSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — XAI USAGE
// ─────────────────────────────────────────────────────────────────────────────

interface XaiUsageSectionProps {
  state:       MetricSectionState<XaiUsageMetrics>;
  phase1Empty: boolean;
  onRetry?:    () => void;
}

export function XaiUsageSection({ state, phase1Empty, onRetry }: XaiUsageSectionProps) {
  const { data, isLoading, error, dataUpdatedAt } = state;

  return (
    <DashboardSection
      title="AI Operations"
      subtitle="XAI explanation pipeline usage, latency, and fallback rate."
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      dataUpdatedAt={dataUpdatedAt}
    >
      {phase1Empty && !isLoading && !error && (
        <XaiPhase1EmptyState
          section="AI Operations"
          detail="Explanation request counts and latency will appear here once the XAI pipeline is live (WP-13)."
        />
      )}
      {data && !phase1Empty && (
        <MetricGrid>
          <MetricCard
            label="Explanation requests"
            value={fmtCount(data.explanation_request_count)}
          />
          <MetricCard
            label="Success rate"
            value={fmtRate(data.explanation_success_rate)}
            status={rateStatus(data.explanation_success_rate)}
          />
          <MetricCard
            label="Failure rate"
            value={fmtRate(data.explanation_failure_rate)}
            status={failureStatus(data.explanation_failure_rate)}
          />
          <MetricCard
            label="Latency p50"
            value={fmtMs(data.explanation_p50_ms)}
            status={data.explanation_p50_ms === 0 ? 'neutral' : data.explanation_p50_ms < 2000 ? 'good' : 'warning'}
          />
          <MetricCard
            label="Latency p95"
            value={fmtMs(data.explanation_p95_ms)}
            status={data.explanation_p95_ms === 0 ? 'neutral' : data.explanation_p95_ms < 5000 ? 'good' : 'warning'}
          />
          <MetricCard
            label="Fallback count"
            value={fmtCount(data.fallback_explanation_count)}
            status={data.fallback_explanation_count > 0 ? 'warning' : 'neutral'}
            sublabel="Non-AI path"
          />
        </MetricGrid>
      )}
    </DashboardSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — XAI TIER DISTRIBUTION
// ─────────────────────────────────────────────────────────────────────────────

interface XaiTierSectionProps {
  state:       MetricSectionState<XaiTierDistributionMetrics>;
  phase1Empty: boolean;
  onRetry?:    () => void;
}

export function XaiTierSection({ state, phase1Empty, onRetry }: XaiTierSectionProps) {
  const { data, isLoading, error, dataUpdatedAt } = state;

  return (
    <DashboardSection
      title="XAI Tier Distribution"
      subtitle="Candidate tier breakdown and AI augmentation exposure rate."
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      dataUpdatedAt={dataUpdatedAt}
    >
      {phase1Empty && !isLoading && !error && (
        <XaiPhase1EmptyState
          section="Tier Distribution"
          detail="Tier counts will populate once candidates have been scored through the XAI pipeline (WP-13)."
        />
      )}
      {data && !phase1Empty && (
        <>
          <MetricGrid>
            <MetricCard
              label="HIGH tier"
              value={fmtCount(data.tier_distribution.HIGH)}
              status="good"
            />
            <MetricCard
              label="MEDIUM tier"
              value={fmtCount(data.tier_distribution.MEDIUM)}
              status="warning"
            />
            <MetricCard
              label="LOW tier"
              value={fmtCount(data.tier_distribution.LOW)}
              status="critical"
            />
            <MetricCard
              label="NO DATA"
              value={fmtCount(data.tier_distribution.NO_DATA)}
            />
          </MetricGrid>

          <div style={{ marginTop: 12 }}>
            <MetricGrid>
              <MetricCard
                label="AI augmentation exposure rate"
                value={fmtRate(data.ai_augmentation_exposure_rate)}
                status={rateStatus(data.ai_augmentation_exposure_rate, 0.5, 0.2)}
                sublabel="Sessions with ai_augmentation_enabled = true"
              />
            </MetricGrid>
          </div>
        </>
      )}
    </DashboardSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1 EMPTY STATE
// Informational placeholder when all XAI metrics are zero.
// Not an error — Phase 1 stubs intentionally return zeros.
// ─────────────────────────────────────────────────────────────────────────────

interface XaiPhase1EmptyStateProps {
  section: string;
  detail:  string;
}

export function XaiPhase1EmptyState({ section, detail }: XaiPhase1EmptyStateProps) {
  return (
    <div
      style={{
        padding:       '24px 20px',
        borderRadius:  8,
        border:        `1px dashed ${T.border}`,
        background:    T.surface,
        display:       'flex',
        flexDirection: 'column',
        gap:           8,
      }}
    >
      <p style={{ margin: 0, color: T.textSecondary, fontSize: 13, fontWeight: 600 }}>
        {section} — Phase 1
      </p>
      <p style={{ margin: 0, color: T.textMuted, fontSize: 13, lineHeight: 1.6 }}>
        {detail}
      </p>
      <p style={{ margin: 0, color: T.textMuted, fontSize: 12 }}>
        Live data will appear automatically when WP-13 is deployed. No frontend changes required.
      </p>
    </div>
  );
}