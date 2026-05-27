'use client';

/**
 * @file components/analytics/index.tsx
 * @description Pure UI components for the Analytics Dashboard.
 *
 * HARD RULES (enforced):
 *  - NO API calls — zero imports from lib/api/*
 *  - NO business logic — no computation beyond formatting
 *  - NO hooks that fetch data — only React state for local UI (open/close etc.)
 *  - ALL data arrives via props
 *  - ALL logic lives in useMetrics (hooks layer)
 *
 * Components exported:
 *  - MetricCard        — single KPI tile
 *  - FunnelChart       — horizontal bar funnel
 *  - LineChart         — SVG sparkline (no external deps)
 *  - BarChart          — horizontal bar comparison
 *  - DashboardSection  — titled section wrapper with loading/error/empty slots
 *  - LoadingState      — skeleton shimmer
 *  - EmptyState        — no-data message
 *  - ErrorState        — error message with retry button
 *  - FilterBar         — date range + user_type + variant controls
 *
 * Architecture position: UI layer (third tier)
 *   API → Hooks → UI → Pages → Guards → Context
 */

import { useState } from 'react';
import type { MetricFilters } from '@/lib/api/metrics';

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// Hard-coded here since no Tailwind compiler is available.
// All values sourced from the codebase's existing aesthetic (dark #0e0e0e paper).
// ─────────────────────────────────────────────────────────────────────────────

const T = {
  // Surfaces
  bg:           '#0b0f1a',
  surface:      '#111827',
  surfaceHover: '#1a2236',
  border:       '#1f2d45',
  borderLight:  '#243044',

  // Text
  textPrimary:  '#e8edf5',
  textSecondary:'#8899b0',
  textMuted:    '#4d6080',

  // Accent palette
  accentBlue:   '#3b82f6',
  accentTeal:   '#14b8a6',
  accentAmber:  '#f59e0b',
  accentRed:    '#ef4444',
  accentGreen:  '#22c55e',
  accentPurple: '#a78bfa',

  // Semantic
  success: '#22c55e',
  warning: '#f59e0b',
  danger:  '#ef4444',
  info:    '#3b82f6',

  // Skeleton shimmer
  shimmer1: '#131e30',
  shimmer2: '#1a2848',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// FORMATTERS  (pure functions — no state, no side effects)
// ─────────────────────────────────────────────────────────────────────────────

export function fmtRate(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

export function fmtMs(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`;
  if (ms >= 1_000)  return `${(ms / 1_000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

export function fmtCount(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

export function fmtDecimal(n: number | null | undefined, decimals = 2): string {
  if (n == null) return '—';
  return n.toFixed(decimals);
}

/**
 * Format a Unix timestamp (ms) as a human-readable relative time string.
 * Pure function — no side effects. Returns '' when ts is 0/null/undefined
 * so callers can use it directly in a conditional render.
 *
 * Examples: "just now", "2 min ago", "1 hr ago"
 *
 * Intentionally limited resolution (minutes / hours) — analytics sections
 * refresh on a 2-minute TTL so sub-minute precision adds no value.
 */
export function fmtRelativeTime(ts: number | undefined): string {
  if (!ts) return '';
  const diffMs = Date.now() - ts;
  if (diffMs < 10_000)          return 'just now';
  if (diffMs < 60_000)          return `${Math.floor(diffMs / 1_000)}s ago`;
  if (diffMs < 3_600_000)       return `${Math.floor(diffMs / 60_000)} min ago`;
  return `${Math.floor(diffMs / 3_600_000)} hr ago`;
}

// ─────────────────────────────────────────────────────────────────────────────
// LOADING STATE
// ─────────────────────────────────────────────────────────────────────────────

export interface LoadingStateProps {
  rows?: number;
  label?: string;
}

export function LoadingState({ rows = 3, label = 'Loading metrics…' }: LoadingStateProps) {
  return (
    <div role="status" aria-label={label} style={{ width: '100%' }}>
      <style>{`
        @keyframes _shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        ._sk {
          background: linear-gradient(90deg, ${T.shimmer1} 25%, ${T.shimmer2} 50%, ${T.shimmer1} 75%);
          background-size: 800px 100%;
          animation: _shimmer 1.4s infinite linear;
          border-radius: 6px;
        }
      `}</style>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="_sk" style={{
          height: 72,
          marginBottom: 12,
          opacity: 1 - i * 0.12,
        }} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

export interface EmptyStateProps {
  title?: string;
  message?: string;
}

export function EmptyState({
  title = 'No data yet',
  message = 'Metrics will appear once events are recorded.',
}: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      gap: 8,
      textAlign: 'center',
    }}>
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
        <circle cx="20" cy="20" r="18" stroke={T.border} strokeWidth="2"/>
        <path d="M14 26 L20 14 L26 26" stroke={T.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="20" cy="28" r="1.5" fill={T.textMuted}/>
      </svg>
      <p style={{ color: T.textPrimary, fontSize: 15, fontWeight: 600, margin: 0 }}>{title}</p>
      <p style={{ color: T.textSecondary, fontSize: 13, margin: 0 }}>{message}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR STATE
// ─────────────────────────────────────────────────────────────────────────────

export interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = 'Failed to load metrics. Check your connection and try again.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      gap: 12,
      textAlign: 'center',
    }}>
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden>
        <circle cx="18" cy="18" r="16" stroke={T.danger} strokeWidth="1.5" opacity="0.4"/>
        <path d="M18 10 L18 20" stroke={T.danger} strokeWidth="2" strokeLinecap="round"/>
        <circle cx="18" cy="25" r="1.5" fill={T.danger}/>
      </svg>
      <p style={{ color: T.textPrimary, fontSize: 14, fontWeight: 600, margin: 0 }}>
        Something went wrong
      </p>
      <p style={{ color: T.textSecondary, fontSize: 13, margin: 0, maxWidth: 320 }}>
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            marginTop: 8,
            padding: '8px 20px',
            background: 'transparent',
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            color: T.textPrimary,
            fontSize: 13,
            cursor: 'pointer',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = T.accentBlue)}
          onMouseLeave={e => (e.currentTarget.style.borderColor = T.border)}
        >
          Retry
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// METRIC CARD
// ─────────────────────────────────────────────────────────────────────────────

export type MetricCardTrend = 'up' | 'down' | 'neutral';
/**
 * Import MetricStatus for local use, then re-export as MetricCardStatus so
 * the UI component and the mapper share the exact same type identity.
 */
import type { MetricStatus } from '@/types/analytics';
export type MetricCardStatus = MetricStatus;

export interface MetricCardProps {
  label:       string;
  value:       string;
  sublabel?:   string;
  subvalue?:   string;
  trend?:      MetricCardTrend;
  trendLabel?: string;
  status?:     MetricCardStatus;
  detail?:     string;
}

const STATUS_COLOR: Record<MetricCardStatus, string> = {
  good:     T.accentGreen,
  warning:  T.accentAmber,
  critical: T.accentRed,
  neutral:  T.textMuted,
};

export function MetricCard({
  label,
  value,
  sublabel,
  subvalue,
  trend,
  trendLabel,
  status = 'neutral',
  detail,
}: MetricCardProps) {
  const statusColor = STATUS_COLOR[status];

  const TrendIcon = () => {
    if (!trend || trend === 'neutral') return null;
    const up = trend === 'up';
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden style={{ flexShrink: 0 }}>
        <path
          d={up ? 'M2 10 L7 4 L12 10' : 'M2 4 L7 10 L12 4'}
          stroke={up ? T.accentGreen : T.accentRed}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 12,
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Status indicator strip */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: 2,
        background: statusColor,
        opacity: status === 'neutral' ? 0.2 : 0.8,
      }} />

      <span style={{
        fontSize: 11,
        fontFamily: 'monospace',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: T.textMuted,
      }}>
        {label}
      </span>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{
          fontSize: 28,
          fontWeight: 700,
          color: T.textPrimary,
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
        }}>
          {value}
        </span>

        {trend && trendLabel && (
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            fontSize: 11,
            color: trend === 'up' ? T.accentGreen : trend === 'down' ? T.accentRed : T.textMuted,
            fontFamily: 'monospace',
          }}>
            <TrendIcon />
            {trendLabel}
          </span>
        )}
      </div>

      {sublabel && subvalue && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', marginTop: 2 }}>
          <span style={{ fontSize: 11, color: T.textMuted, fontFamily: 'monospace' }}>
            {sublabel}
          </span>
          <span style={{ fontSize: 13, color: T.textSecondary, fontWeight: 500 }}>
            {subvalue}
          </span>
        </div>
      )}

      {detail && (
        <span style={{ fontSize: 11, color: T.textMuted, marginTop: 4, lineHeight: 1.5 }}>
          {detail}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNNEL CHART
// Renders steps as horizontal percentage bars, top-to-bottom.
// ─────────────────────────────────────────────────────────────────────────────

export interface FunnelStep {
  label: string;
  value: number; // 0–1 rate OR raw count
  isRate?: boolean;
  color?: string;
}

export interface FunnelChartProps {
  steps: FunnelStep[];
  title?: string;
}

export function FunnelChart({ steps, title }: FunnelChartProps) {
  const maxVal = Math.max(...steps.map(s => s.value), 0.001);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {title && (
        <span style={{
          fontSize: 11,
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: T.textMuted,
        }}>
          {title}
        </span>
      )}
      {steps.map((step, i) => {
        const width = (step.value / maxVal) * 100;
        const color = step.color ?? (i === 0 ? T.accentBlue : T.accentTeal);
        return (
          <div key={step.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 12, color: T.textSecondary }}>{step.label}</span>
              <span style={{ fontSize: 13, color: T.textPrimary, fontWeight: 600, fontFamily: 'monospace' }}>
                {step.isRate ? fmtRate(step.value) : fmtCount(step.value)}
              </span>
            </div>
            <div style={{
              height: 6,
              background: T.border,
              borderRadius: 3,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${width}%`,
                background: color,
                borderRadius: 3,
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BAR CHART
// Horizontal bars for comparing discrete values (e.g. variant conversion).
// ─────────────────────────────────────────────────────────────────────────────

export interface BarChartRow {
  label: string;
  value: number;
  isRate?: boolean;
  highlight?: boolean;
  sublabel?: string;
}

export interface BarChartProps {
  rows: BarChartRow[];
  title?: string;
}

export function BarChart({ rows, title }: BarChartProps) {
  const maxVal = Math.max(...rows.map(r => r.value), 0.001);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {title && (
        <span style={{
          fontSize: 11,
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: T.textMuted,
        }}>
          {title}
        </span>
      )}
      {rows.map(row => {
        const width = (row.value / maxVal) * 100;
        const color = row.highlight ? T.accentPurple : T.accentBlue;
        return (
          <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              fontSize: 12,
              color: T.textSecondary,
              width: 110,
              flexShrink: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {row.label}
            </span>
            <div style={{ flex: 1, height: 20, background: T.border, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${width}%`,
                background: color,
                borderRadius: 4,
                transition: 'width 0.4s ease',
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 8,
              }}>
                {width > 25 && (
                  <span style={{ fontSize: 11, color: '#fff', fontWeight: 600, fontFamily: 'monospace' }}>
                    {row.isRate ? fmtRate(row.value) : fmtDecimal(row.value)}
                  </span>
                )}
              </div>
            </div>
            {width <= 25 && (
              <span style={{ fontSize: 11, color: T.textPrimary, fontFamily: 'monospace', width: 50 }}>
                {row.isRate ? fmtRate(row.value) : fmtDecimal(row.value)}
              </span>
            )}
            {row.sublabel && (
              <span style={{ fontSize: 11, color: T.textMuted, width: 60 }}>{row.sublabel}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE CHART (SVG sparkline — zero external dependencies)
// ─────────────────────────────────────────────────────────────────────────────

export interface LineChartPoint {
  label: string;
  value: number;
}

export interface LineChartProps {
  points: LineChartPoint[];
  title?: string;
  color?: string;
  height?: number;
  isRate?: boolean;
}

export function LineChart({
  points,
  title,
  color = T.accentBlue,
  height = 80,
  isRate = false,
}: LineChartProps) {
  if (!points.length) {
    return <EmptyState title="No trend data" message="Time-series data unavailable." />;
  }

  const W = 400;
  const H = height;
  const pad = { t: 8, r: 8, b: 20, l: 36 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;

  const vals = points.map(p => p.value);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const rangeV = maxV - minV || 1;

  const toX = (i: number) => pad.l + (i / (points.length - 1 || 1)) * innerW;
  const toY = (v: number) => pad.t + innerH - ((v - minV) / rangeV) * innerH;

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.value).toFixed(1)}`)
    .join(' ');

  const areaD = `${pathD} L ${toX(points.length - 1).toFixed(1)} ${(pad.t + innerH).toFixed(1)} L ${pad.l} ${(pad.t + innerH).toFixed(1)} Z`;

  // Show first, middle, last labels
  const labelIdxs = [0, Math.floor(points.length / 2), points.length - 1].filter(
    (v, i, a) => a.indexOf(v) === i,
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {title && (
        <span style={{
          fontSize: 11,
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: T.textMuted,
        }}>
          {title}
        </span>
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: H, overflow: 'visible' }}
        aria-hidden
      >
        <defs>
          <linearGradient id={`_lg_${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Area fill */}
        <path d={areaD} fill={`url(#_lg_${color.replace('#','')})`} />
        {/* Line */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots on first/last */}
        {[0, points.length - 1].map(i => (
          <circle key={i} cx={toX(i)} cy={toY(points[i].value)} r="3" fill={color} />
        ))}
        {/* X labels */}
        {labelIdxs.map(i => (
          <text
            key={i}
            x={toX(i)}
            y={H - 4}
            textAnchor="middle"
            fontSize="9"
            fill={T.textMuted}
            fontFamily="monospace"
          >
            {points[i].label}
          </text>
        ))}
        {/* Y labels (min / max) */}
        <text x={pad.l - 4} y={pad.t + 4} textAnchor="end" fontSize="9" fill={T.textMuted} fontFamily="monospace">
          {isRate ? fmtRate(maxV) : fmtDecimal(maxV, 1)}
        </text>
        <text x={pad.l - 4} y={pad.t + innerH} textAnchor="end" fontSize="9" fill={T.textMuted} fontFamily="monospace">
          {isRate ? fmtRate(minV) : fmtDecimal(minV, 1)}
        </text>
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD SECTION
// Titled wrapper with slot-based loading / error / empty handling.
// ─────────────────────────────────────────────────────────────────────────────

export interface DashboardSectionProps {
  title:          string;
  subtitle?:      string;
  isLoading?:     boolean;
  error?:         { message: string } | null;
  isEmpty?:       boolean;
  onRetry?:       () => void;
  children:       React.ReactNode;
  loadingRows?:   number;
  badge?:         string;
  /**
   * Unix timestamp (ms) from MetricSectionState.dataUpdatedAt.
   * Rendered as "Updated X min ago" in the section header.
   * 0 or undefined → label is omitted (section not yet fetched).
   */
  dataUpdatedAt?: number;
}

export function DashboardSection({
  title,
  subtitle,
  isLoading,
  error,
  isEmpty,
  onRetry,
  children,
  loadingRows = 3,
  badge,
  dataUpdatedAt,
}: DashboardSectionProps) {
  // Pure display value — formatting delegated to fmtRelativeTime, no logic here.
  const updatedLabel = fmtRelativeTime(dataUpdatedAt);

  return (
    <section style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 16,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '18px 24px 16px',
        borderBottom: `1px solid ${T.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{
              fontSize: 14,
              fontWeight: 600,
              color: T.textPrimary,
              margin: 0,
              letterSpacing: '-0.01em',
            }}>
              {title}
            </h2>
            {badge && (
              <span style={{
                fontSize: 10,
                fontFamily: 'monospace',
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                padding: '2px 7px',
                borderRadius: 4,
                background: T.border,
                color: T.textMuted,
              }}>
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p style={{ fontSize: 12, color: T.textMuted, margin: '3px 0 0', lineHeight: 1.4 }}>
              {subtitle}
            </p>
          )}
        </div>

        {/* "Updated X min ago" — only shown when we have a real timestamp */}
        {updatedLabel && (
          <span style={{
            fontSize: 10,
            fontFamily: 'monospace',
            color: T.textMuted,
            flexShrink: 0,
            letterSpacing: '0.03em',
          }}
            title={dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : undefined}
          >
            Updated {updatedLabel}
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '20px 24px' }}>
        {isLoading ? (
          <LoadingState rows={loadingRows} />
        ) : error ? (
          <ErrorState message={error.message} onRetry={onRetry} />
        ) : isEmpty ? (
          <EmptyState />
        ) : (
          children
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTER BAR
// Global filter controls. UI only — calls prop callbacks, owns NO state.
// ─────────────────────────────────────────────────────────────────────────────

export interface FilterBarProps {
  filters:    MetricFilters;
  onFiltersChange: (patch: Partial<MetricFilters>) => void;
  onClear:    () => void;
}

export function FilterBar({ filters, onFiltersChange, onClear }: FilterBarProps) {
  const inputStyle: React.CSSProperties = {
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    color: T.textPrimary,
    fontSize: 12,
    padding: '6px 10px',
    outline: 'none',
    cursor: 'pointer',
    fontFamily: 'monospace',
  };

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
      alignItems: 'center',
      padding: '14px 20px',
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 12,
    }}>
      <span style={{
        fontSize: 11,
        fontFamily: 'monospace',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: T.textMuted,
        marginRight: 4,
      }}>
        Filters
      </span>

      {/* Date from */}
      <input
        type="date"
        value={filters.date_from ?? ''}
        onChange={e => onFiltersChange({ date_from: e.target.value || undefined })}
        style={inputStyle}
        aria-label="From date"
      />

      <span style={{ color: T.textMuted, fontSize: 12 }}>→</span>

      {/* Date to */}
      <input
        type="date"
        value={filters.date_to ?? ''}
        onChange={e => onFiltersChange({ date_to: e.target.value || undefined })}
        style={inputStyle}
        aria-label="To date"
      />

      {/* User type */}
      <select
        value={filters.user_type ?? ''}
        onChange={e => onFiltersChange({ user_type: (e.target.value || undefined) as MetricFilters['user_type'] })}
        style={inputStyle}
        aria-label="User type"
      >
        <option value="">All users</option>
        <option value="student">Student</option>
        <option value="professional">Professional</option>
        <option value="market">Market</option>
      </select>

      {/* Variant */}
      <input
        type="text"
        placeholder="Variant (e.g. control)"
        value={filters.variant ?? ''}
        onChange={e => onFiltersChange({ variant: e.target.value || undefined })}
        style={{ ...inputStyle, width: 160 }}
        aria-label="Experiment variant"
      />

      {/* Grain */}
      <select
        value={filters.grain ?? 'weekly'}
        onChange={e => onFiltersChange({ grain: e.target.value as MetricFilters['grain'] })}
        style={inputStyle}
        aria-label="Grain"
      >
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
      </select>

      {/* Clear */}
      <button
        onClick={onClear}
        style={{
          ...inputStyle,
          cursor: 'pointer',
          color: T.textMuted,
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = T.accentRed)}
        onMouseLeave={e => (e.currentTarget.style.color = T.textMuted)}
      >
        Clear
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PERCENTILE DISPLAY
// Three-column p50 / p95 / p99 layout for latency metrics.
// ─────────────────────────────────────────────────────────────────────────────

export interface PercentileDisplayProps {
  p50: number | null;
  p95: number | null;
  p99?: number | null;
  label?: string;
  formatter?: (v: number | null | undefined) => string;
}

export function PercentileDisplay({ p50, p95, p99, label, formatter = fmtMs }: PercentileDisplayProps) {
  const cellStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '14px 16px',
    background: T.bg,
    borderRadius: 8,
    flex: 1,
    minWidth: 80,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {label && (
        <span style={{ fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: T.textMuted }}>
          {label}
        </span>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={cellStyle}>
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: T.textMuted, textTransform: 'uppercase' }}>p50</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary, letterSpacing: '-0.02em' }}>{formatter(p50)}</span>
        </div>
        <div style={cellStyle}>
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: T.textMuted, textTransform: 'uppercase' }}>p95</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: T.accentAmber, letterSpacing: '-0.02em' }}>{formatter(p95)}</span>
        </div>
        {p99 !== undefined && (
          <div style={cellStyle}>
            <span style={{ fontSize: 10, fontFamily: 'monospace', color: T.textMuted, textTransform: 'uppercase' }}>p99</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: T.accentRed, letterSpacing: '-0.02em' }}>{formatter(p99)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// METRIC GRID
// Responsive CSS-grid wrapper for MetricCard instances.
// ─────────────────────────────────────────────────────────────────────────────

export function MetricGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: 12,
    }}>
      {children}
    </div>
  );
}