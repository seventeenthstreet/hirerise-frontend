/**
 * src/modules/career-intelligence/components/IndustryTrendChart.tsx
 *
 * Industry growth signal visualisation.
 * Two views:
 *   1. Card grid — each sector with growth badge + description
 *   2. SVG bar chart — growth_signal comparison
 */

import React, { useEffect, useState } from 'react';
import type { IndustryItem } from '../services/analytics.api';

const LABEL_CONFIG: Record<string, { color: string; bg: string }> = {
  'Rapid Growth':  { color: '#22c55e', bg: 'rgba(34,197,94,0.12)'   },
  'High Growth':   { color: '#06b6d4', bg: 'rgba(6,182,212,0.12)'   },
  'Strong Growth': { color: '#6366f1', bg: 'rgba(99,102,241,0.12)'  },
  'Emerging':      { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  'Growing':       { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  'Stable':        { color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' },
  'Declining':     { color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
};

const INDUSTRY_ICONS: Record<string, string> = {
  'Artificial Intelligence': '🤖',
  'Cybersecurity':           '🔐',
  'Cloud Computing':         '☁️',
  'Data Engineering':        '🗄️',
  'Fintech':                 '💳',
  'Healthcare Technology':   '🏥',
  'Green Energy / CleanTech':'🌱',
  'EdTech':                  '📚',
  'Semiconductor / Chips':   '💾',
  'Legal Technology':        '⚖️',
  'Traditional Finance':     '🏦',
  'Traditional Media':       '📰',
};

interface Props { industries: IndustryItem[]; }

function formatJobs(n: number) {
  if (n < 0) return `-${Math.abs(n / 1000).toFixed(0)}K`;
  if (n >= 1000) return `+${(n / 1000).toFixed(0)}K`;
  return `+${n}`;
}

// ─── SVG Bar Chart View ───────────────────────────────────────────────────────

function BarChart({ industries }: Props) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 150); return () => clearTimeout(t); }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {industries.map((ind, i) => {
        const cfg = LABEL_CONFIG[ind.growth_label] ?? LABEL_CONFIG['Stable'];
        const pct = animated ? ind.growth_signal : 0;
        return (
          <div key={ind.industry} style={I.barRow}>
            <span style={I.barIcon}>{INDUSTRY_ICONS[ind.industry] ?? '📊'}</span>
            <span style={I.barName}>{ind.industry}</span>
            <div style={I.track}>
              <div style={{
                ...I.fill,
                width: `${pct}%`,
                background: `linear-gradient(90deg, ${cfg.color}44, ${cfg.color})`,
                transition: `width 0.9s cubic-bezier(0.34,1.1,0.64,1) ${i * 40}ms`,
              }} />
            </div>
            <span style={{ ...I.labelBadge, color: cfg.color, background: cfg.bg }}>
              {ind.growth_label}
            </span>
            <span style={{ ...I.jobs, color: ind.jobs_added >= 0 ? '#22c55e' : '#ef4444' }}>
              {formatJobs(ind.jobs_added)} jobs
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Card Grid View ───────────────────────────────────────────────────────────

function CardGrid({ industries }: Props) {
  return (
    <div style={I.cardGrid}>
      {industries.map((ind) => {
        const cfg = LABEL_CONFIG[ind.growth_label] ?? LABEL_CONFIG['Stable'];
        return (
          <div key={ind.industry} style={{ ...I.card, borderColor: `${cfg.color}30` }}>
            <div style={I.cardHeader}>
              <span style={I.cardIcon}>{INDUSTRY_ICONS[ind.industry] ?? '📊'}</span>
              <span style={{ ...I.cardBadge, color: cfg.color, background: cfg.bg }}>
                {ind.growth_label}
              </span>
            </div>
            <p style={I.cardTitle}>{ind.industry}</p>
            <p style={I.cardDesc}>{ind.description}</p>
            <div style={I.cardMeta}>
              <span style={I.cardStat}>
                <span style={{ color: '#6b7280' }}>YoY </span>
                <span style={{ color: ind.yoy >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                  {ind.yoy >= 0 ? '+' : ''}{(ind.yoy * 100).toFixed(0)}%
                </span>
              </span>
              <span style={I.cardStat}>
                <span style={{ color: '#6b7280' }}>Jobs </span>
                <span style={{ color: ind.jobs_added >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                  {formatJobs(ind.jobs_added)}
                </span>
              </span>
              <span style={{ ...I.cardSignal, color: cfg.color }}>
                Signal {ind.growth_signal}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function IndustryTrendChart({ industries }: Props) {
  const [view, setView] = useState<'cards' | 'bars'>('cards');

  return (
    <div>
      <div style={I.tabRow}>
        {(['cards', 'bars'] as const).map(v => (
          <button key={v} style={{ ...I.tab, ...(view === v ? I.tabActive : {}) }} onClick={() => setView(v)}>
            {v === 'cards' ? '🗂 Cards' : '📊 Chart'}
          </button>
        ))}
      </div>
      {view === 'cards' ? <CardGrid industries={industries} /> : <BarChart industries={industries} />}
    </div>
  );
}

const I: Record<string, React.CSSProperties> = {
  tabRow:      { display: 'flex', gap: 6, marginBottom: 16 },
  tab:         { fontSize: 11, fontWeight: 600, color: '#6b7280', background: 'transparent', border: '1.5px solid #1f2937', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' },
  tabActive:   { color: '#06b6d4', borderColor: '#06b6d4', background: 'rgba(6,182,212,0.08)' },

  barRow:      { display: 'grid', gridTemplateColumns: '22px 180px 1fr 110px 70px', alignItems: 'center', gap: 8 },
  barIcon:     { fontSize: 14, textAlign: 'center' },
  barName:     { fontSize: 12, color: '#d1d5db', fontWeight: 500 },
  track:       { height: 9, background: '#1f2937', borderRadius: 5, overflow: 'hidden' },
  fill:        { height: '100%', borderRadius: 5 },
  labelBadge:  { fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 9, textAlign: 'center' },
  jobs:        { fontSize: 10, fontWeight: 700, textAlign: 'right' },

  cardGrid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 },
  card:        { background: '#0d1117', border: '1.5px solid #1f2937', borderRadius: 14, padding: '14px 16px' },
  cardHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardIcon:    { fontSize: 22 },
  cardBadge:   { fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 },
  cardTitle:   { fontSize: 14, fontWeight: 700, color: '#f9fafb', margin: '0 0 6px' },
  cardDesc:    { fontSize: 11, color: '#6b7280', lineHeight: 1.6, margin: '0 0 10px' },
  cardMeta:    { display: 'flex', gap: 10, alignItems: 'center' },
  cardStat:    { fontSize: 11 },
  cardSignal:  { fontSize: 10, fontWeight: 700, marginLeft: 'auto' },
};
