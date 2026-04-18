'use client';

/**
 * app/daily-insights/page.tsx — Daily Career Insights Feed
 *
 * Feed layout displaying personalised career intelligence cards.
 * Each card shows the insight type, source engine badge, priority indicator,
 * description, and a read / unread state.
 *
 * Design: dark v3 system — cyan (#06b6d4) as accent for this module.
 */

import React, { CSSProperties } from 'react';
import { useInsightsFeed }      from '@/hooks/useEngagement';
import { LoadingSpinner }       from '@/components/ui/LoadingSpinner';
import type { CareerInsight, InsightType } from '@/services/engagementService';

// ─── Insight type config ──────────────────────────────────────────────────────

const TYPE_CONFIG: Record<InsightType, { icon: string; label: string; color: string; bg: string }> = {
  skill_demand:       { icon: '⚡', label: 'Skill Demand',   color: '#fbbf24', bg: 'rgba(251,191,36,0.10)'  },
  job_match:          { icon: '🎯', label: 'Job Match',      color: '#4ade80', bg: 'rgba(74,222,128,0.10)'  },
  market_trend:       { icon: '📈', label: 'Market Trend',   color: '#a78bfa', bg: 'rgba(167,139,250,0.10)' },
  opportunity_signal: { icon: '🔭', label: 'Opportunity',    color: '#06b6d4', bg: 'rgba(6,182,212,0.10)'   },
  risk_alert:         { icon: '⚠️', label: 'Risk Alert',     color: '#f87171', bg: 'rgba(248,113,113,0.10)' },
  salary_update:      { icon: '💰', label: 'Salary Update',  color: '#34d399', bg: 'rgba(52,211,153,0.10)'  },
};

const PRIORITY_DOTS: Record<number, string> = {
  1: '#f87171', 2: '#fb923c', 3: '#fbbf24', 4: '#94a3b8', 5: '#475569',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60)   return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Insight card ─────────────────────────────────────────────────────────────

function InsightCard({
  insight,
  onMarkRead,
}: {
  insight:    CareerInsight;
  onMarkRead: (id: string) => void;
}) {
  const cfg = TYPE_CONFIG[insight.insight_type] ?? TYPE_CONFIG.market_trend;

  return (
    <div
      style={{
        ...S.card,
        ...(insight.is_read ? S.cardRead : S.cardUnread),
      }}
    >
      {/* Priority dot */}
      <div
        style={{
          ...S.priorityDot,
          background: insight.is_read ? '#1e293b' : (PRIORITY_DOTS[insight.priority] ?? '#475569'),
        }}
      />

      {/* Type badge + timestamp */}
      <div style={S.cardHeader}>
        <span
          style={{
            ...S.typeBadge,
            color:      cfg.color,
            background: cfg.bg,
            border:     `1px solid ${cfg.color}25`,
          }}
        >
          {cfg.icon} {cfg.label}
        </span>
        <span style={S.timestamp}>{timeAgo(insight.created_at)}</span>
      </div>

      {/* Title + description */}
      <p style={{ ...S.cardTitle, ...(insight.is_read ? S.textDim : {}) }}>
        {insight.title}
      </p>
      <p style={S.cardDesc}>{insight.description}</p>

      {/* Footer */}
      <div style={S.cardFooter}>
        <span style={S.engineBadge}>
          {insight.source_engine.replace(/_/g, ' ')}
        </span>
        {!insight.is_read && (
          <button
            style={S.readBtn}
            onClick={() => onMarkRead(insight.id)}
          >
            Mark read
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DailyInsightsPage() {
  const { insights, actions } = useInsightsFeed();
  const feed = insights.data;

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>
            <span style={S.titleIcon}>✦</span> Daily Career Insights
          </h1>
          <p style={S.subtitle}>
            Fresh intelligence from your career engines, updated daily.
          </p>
        </div>
        <div style={S.headerRight}>
          {feed && feed.unread_count > 0 && (
            <span style={S.unreadBadge}>{feed.unread_count} new</span>
          )}
          <button
            style={{ ...S.btn, ...(insights.loading ? S.btnDisabled : {}) }}
            disabled={insights.loading}
            onClick={() => actions.refresh()}
          >
            {insights.loading ? 'Refreshing…' : '↺ Refresh'}
          </button>
          {feed && feed.unread_count > 0 && (
            <button
              style={{ ...S.btn, ...S.btnSecondary }}
              onClick={() => actions.markRead()}
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {insights.loading && !feed && (
        <div style={S.centred}>
          <LoadingSpinner />
          <p style={S.dimText}>Loading your insights…</p>
        </div>
      )}

      {/* Error */}
      {insights.error && (
        <div style={S.errorBanner}>⚠ {insights.error}</div>
      )}

      {/* Empty state */}
      {!insights.loading && feed && feed.insights.length === 0 && (
        <div style={S.centred}>
          <p style={S.dimText}>No insights yet — try refreshing or complete your profile.</p>
          <button style={S.btn} onClick={() => actions.refresh()}>
            Generate insights
          </button>
        </div>
      )}

      {/* Feed */}
      {feed && feed.insights.length > 0 && (
        <div style={S.feed}>
          {feed.insights.map(insight => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onMarkRead={(id) => actions.markRead([id])}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh', background: '#0a0f1e',
    padding: '32px 24px', color: '#e2e8f0',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  header: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', flexWrap: 'wrap',
    gap: 16, marginBottom: 28,
  },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  titleIcon: { color: '#06b6d4', marginRight: 8 },
  title: { fontSize: 26, fontWeight: 700, margin: 0, color: '#f1f5f9' },
  subtitle: { fontSize: 14, color: '#64748b', margin: '6px 0 0' },
  unreadBadge: {
    padding: '3px 10px', borderRadius: 20,
    background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.30)',
    color: '#06b6d4', fontSize: 12, fontWeight: 700,
  },
  btn: {
    padding: '8px 16px', background: '#06b6d4', color: '#0a0f1e',
    border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600,
    cursor: 'pointer',
  },
  btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  btnSecondary: {
    background: 'transparent', color: '#94a3b8',
    border: '1px solid rgba(255,255,255,0.10)',
  },
  centred: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 14, padding: '60px 0',
  },
  dimText: { color: '#475569', fontSize: 14 },
  errorBanner: {
    background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.25)',
    color: '#f87171', borderRadius: 8, padding: '12px 16px', marginBottom: 24, fontSize: 14,
  },
  // Feed
  feed: { display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 720 },
  card: {
    position: 'relative', background: '#111827',
    borderRadius: 12, padding: '16px 18px',
    display: 'flex', flexDirection: 'column', gap: 8,
    transition: 'border-color 0.2s',
  },
  cardUnread: { border: '1px solid rgba(6,182,212,0.20)' },
  cardRead:   { border: '1px solid rgba(255,255,255,0.05)', opacity: 0.75 },
  priorityDot: {
    position: 'absolute', top: 16, right: 16,
    width: 7, height: 7, borderRadius: '50%',
  },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  typeBadge: {
    padding: '2px 8px', borderRadius: 20, fontSize: 11,
    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  timestamp: { fontSize: 11, color: '#475569' },
  cardTitle: { margin: 0, fontSize: 15, fontWeight: 600, color: '#f1f5f9', lineHeight: 1.4 },
  textDim:   { color: '#64748b' },
  cardDesc:  { margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.6 },
  cardFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  engineBadge: { fontSize: 10, color: '#334155', textTransform: 'capitalize' },
  readBtn: {
    padding: '2px 10px', background: 'transparent',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#64748b', borderRadius: 6, fontSize: 11, cursor: 'pointer',
  },
};
