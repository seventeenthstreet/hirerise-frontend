'use client';

/**
 * app/career-alerts/page.tsx — Career Opportunity Alerts
 *
 * Notification panel displaying career alerts sorted by priority then recency.
 * Priority 1 (critical) alerts appear at the top with a red accent;
 * lower priority alerts fade progressively.
 *
 * Features:
 *   - Filter bar: All / Unread / by alert type
 *   - Priority tier labels (Critical, High, Medium, Low, Info)
 *   - Inline "Mark read" per alert + "Mark all read" bulk action
 *   - Action URL deep-link button when present
 *
 * Design: dark v3 system — orange (#fb923c) as accent for alerts.
 */

import React, { CSSProperties, useState } from 'react';
import Link               from 'next/link';
import { useAlertsFeed }  from '@/hooks/useEngagement';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { CareerAlert, AlertType } from '@/services/engagementService';

// ─── Alert type config ────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<AlertType, { icon: string; label: string }> = {
  job_match:          { icon: '🎯', label: 'Job Match'          },
  skill_demand:       { icon: '⚡', label: 'Skill Demand'       },
  career_opportunity: { icon: '🔭', label: 'Opportunity'        },
  salary_trend:       { icon: '💰', label: 'Salary Trend'       },
  risk_warning:       { icon: '⚠️', label: 'Risk Warning'       },
  market_shift:       { icon: '📈', label: 'Market Shift'       },
};

const PRIORITY_CONFIG: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: 'Critical', color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  2: { label: 'High',     color: '#fb923c', bg: 'rgba(251,146,60,0.12)'  },
  3: { label: 'Medium',   color: '#fbbf24', bg: 'rgba(251,191,36,0.10)'  },
  4: { label: 'Low',      color: '#94a3b8', bg: 'rgba(148,163,184,0.10)' },
  5: { label: 'Info',     color: '#475569', bg: 'rgba(71,85,105,0.10)'   },
};

const FILTER_TABS: { label: string; value: string }[] = [
  { label: 'All',              value: 'all'                },
  { label: '🔔 Unread',        value: 'unread'             },
  { label: '🎯 Job Match',     value: 'job_match'          },
  { label: '⚡ Skill Demand',  value: 'skill_demand'       },
  { label: '🔭 Opportunity',   value: 'career_opportunity' },
  { label: '⚠️ Risk',         value: 'risk_warning'       },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Alert card ───────────────────────────────────────────────────────────────

function AlertCard({
  alert,
  onMarkRead,
}: {
  alert:       CareerAlert;
  onMarkRead:  (id: string) => void;
}) {
  const typeConf = TYPE_CONFIG[alert.alert_type];
  const priConf  = PRIORITY_CONFIG[alert.alert_priority] ?? PRIORITY_CONFIG[5];

  return (
    <div style={{
      ...S.card,
      ...(alert.is_read ? S.cardRead : S.cardUnread),
      borderLeft: `3px solid ${alert.is_read ? 'rgba(255,255,255,0.05)' : priConf.color}`,
    }}>
      {/* Top row */}
      <div style={S.cardTop}>
        <div style={S.cardTopLeft}>
          <span style={{ ...S.typePill, color: priConf.color, background: priConf.bg }}>
            {typeConf?.icon} {typeConf?.label}
          </span>
          <span style={{ ...S.priorityPill, color: priConf.color }}>
            {priConf.label}
          </span>
        </div>
        <span style={S.timestamp}>{timeAgo(alert.created_at)}</span>
      </div>

      {/* Content */}
      <p style={{ ...S.alertTitle, ...(alert.is_read ? S.textDim : {}) }}>
        {alert.title}
      </p>
      <p style={S.alertDesc}>{alert.description}</p>

      {/* Actions */}
      <div style={S.cardFooter}>
        {alert.action_url && !alert.is_read && (
          <Link href={alert.action_url} style={S.actionLink}>
            View →
          </Link>
        )}
        {!alert.is_read && (
          <button style={S.readBtn} onClick={() => onMarkRead(alert.id)}>
            Mark read
          </button>
        )}
        {alert.is_read && (
          <span style={S.readLabel}>✓ Read</span>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CareerAlertsPage() {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const { alerts, actions } = useAlertsFeed();
  const feed = alerts.data;

  // Derive the opts to pass when switching filters
  const filterOpts =
    activeFilter === 'all'    ? {} :
    activeFilter === 'unread' ? { unread_only: true } :
    { type: activeFilter as AlertType };

  const visibleAlerts = feed?.alerts.filter(a => {
    if (activeFilter === 'unread')  return !a.is_read;
    if (activeFilter !== 'all')     return a.alert_type === activeFilter;
    return true;
  }) ?? [];

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}><span style={S.titleIcon}>🔔</span> Career Alerts</h1>
          <p style={S.subtitle}>
            Actionable notifications for jobs, skills, opportunities, and market shifts.
          </p>
        </div>
        <div style={S.headerRight}>
          {feed && feed.unread_count > 0 && (
            <span style={S.unreadBadge}>{feed.unread_count} unread</span>
          )}
          {feed && feed.unread_count > 0 && (
            <button
              style={{ ...S.btn, ...S.btnSecondary }}
              onClick={() => actions.markRead()}
            >
              Mark all read
            </button>
          )}
          <button
            style={{ ...S.btn, ...(alerts.loading ? S.btnDisabled : {}) }}
            disabled={alerts.loading}
            onClick={() => actions.load(filterOpts)}
          >
            {alerts.loading ? 'Loading…' : '↺ Refresh'}
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={S.filters}>
        {FILTER_TABS.map(tab => (
          <button
            key={tab.value}
            style={{
              ...S.filterTab,
              ...(activeFilter === tab.value ? S.filterTabActive : {}),
            }}
            onClick={() => setActiveFilter(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {alerts.loading && !feed && (
        <div style={S.centred}><LoadingSpinner /></div>
      )}

      {/* Error */}
      {alerts.error && (
        <div style={S.errorBanner}>⚠ {alerts.error}</div>
      )}

      {/* Empty */}
      {!alerts.loading && visibleAlerts.length === 0 && (
        <div style={S.centred}>
          <p style={S.dimText}>
            {activeFilter !== 'all'
              ? 'No alerts matching this filter.'
              : "You're all caught up — no alerts right now."}
          </p>
        </div>
      )}

      {/* Alert list */}
      {visibleAlerts.length > 0 && (
        <div style={S.list}>
          {visibleAlerts.map(alert => (
            <AlertCard
              key={alert.id}
              alert={alert}
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
  page: { minHeight: '100vh', background: '#0a0f1e', padding: '32px 24px', color: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  titleIcon: { color: '#fb923c', marginRight: 8 },
  title: { fontSize: 26, fontWeight: 700, margin: 0, color: '#f1f5f9' },
  subtitle: { fontSize: 14, color: '#64748b', margin: '6px 0 0' },
  unreadBadge: { padding: '3px 10px', borderRadius: 20, background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.30)', color: '#fb923c', fontSize: 12, fontWeight: 700 },
  btn: { padding: '8px 16px', background: '#fb923c', color: '#0a0f1e', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  btnSecondary: { background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.10)' },
  // Filters
  filters: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 },
  filterTab: { padding: '6px 14px', background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', color: '#64748b', borderRadius: 20, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s' },
  filterTabActive: { background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.35)', color: '#fb923c' },
  centred: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '60px 0' },
  dimText: { color: '#475569', fontSize: 14 },
  errorBanner: { background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', borderRadius: 8, padding: '12px 16px', marginBottom: 24, fontSize: 14 },
  // List
  list: { display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 720 },
  card: { background: '#111827', borderRadius: 12, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8, transition: 'opacity 0.2s' },
  cardUnread: { border: '1px solid rgba(255,255,255,0.08)' },
  cardRead:   { border: '1px solid rgba(255,255,255,0.04)', opacity: 0.65 },
  cardTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  cardTopLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  typePill: { padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 },
  priorityPill: { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' },
  timestamp: { fontSize: 11, color: '#475569' },
  alertTitle: { margin: 0, fontSize: 14, fontWeight: 600, color: '#f1f5f9', lineHeight: 1.4 },
  textDim: { color: '#64748b' },
  alertDesc: { margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.6 },
  cardFooter: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 },
  actionLink: { padding: '3px 10px', background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.25)', color: '#fb923c', borderRadius: 6, fontSize: 12, fontWeight: 600, textDecoration: 'none' },
  readBtn: { padding: '2px 10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b', borderRadius: 6, fontSize: 11, cursor: 'pointer' },
  readLabel: { fontSize: 11, color: '#334155' },
};
