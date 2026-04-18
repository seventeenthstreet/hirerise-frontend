import React, { useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ROIOption {
  path:            string;
  duration_years:  number;
  estimated_cost:  number;
  expected_salary: number;
  roi_score:       number;
  roi_level:       'Very High' | 'High' | 'Moderate' | 'Low';
  matched_careers: string[];
}

interface Props {
  education_options: ROIOption[];
}

// ─── Config ───────────────────────────────────────────────────────────────────

const ROI_LEVEL_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  'Very High': { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.25)'   },
  'High':      { color: '#06b6d4', bg: 'rgba(6,182,212,0.08)',   border: 'rgba(6,182,212,0.25)'   },
  'Moderate':  { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.25)'  },
  'Low':       { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)'   },
};

const BAR_COLORS = ['#22c55e', '#06b6d4', '#6366f1', '#f59e0b', '#a78bfa',
                    '#f43f5e', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000)   return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000)     return `₹${(amount / 1000).toFixed(0)}K`;
  return `₹${amount}`;
}

function formatLPA(salary: number): string {
  const lpa = salary / 100000;
  return `₹${lpa % 1 === 0 ? lpa.toFixed(0) : lpa.toFixed(1)} LPA`;
}

// ─── ROI Bar Row ──────────────────────────────────────────────────────────────

function ROIBar({ option, rank, animated }: { option: ROIOption; rank: number; animated: boolean }) {
  const cfg   = ROI_LEVEL_CONFIG[option.roi_level] ?? ROI_LEVEL_CONFIG['Moderate'];
  const color = BAR_COLORS[rank % BAR_COLORS.length];
  const isTop = rank === 0;

  return (
    <div style={RC.barRow}>
      {/* Path name + badges */}
      <div style={RC.barHeader}>
        <div style={RC.barLeft}>
          <span style={{ ...RC.rankBadge, background: isTop ? color : '#1f2937', color: isTop ? '#000' : '#6b7280' }}>
            #{rank + 1}
          </span>
          <span style={{ ...RC.pathName, color: isTop ? '#f9fafb' : '#d1d5db' }}>{option.path}</span>
          {isTop && <span style={RC.bestPill}>BEST ROI</span>}
        </div>
        <div style={RC.barRight}>
          <span style={{ ...RC.roiLevelBadge, color: cfg.color, background: cfg.bg, borderColor: cfg.border }}>
            {option.roi_level}
          </span>
          <span style={{ ...RC.roiScore, color: color }}>{option.roi_score}</span>
        </div>
      </div>

      {/* Bar */}
      <div style={RC.trackWrap}>
        <div style={RC.track}>
          <div style={{
            ...RC.fill,
            width: animated ? `${option.roi_score}%` : '0%',
            background: isTop
              ? `linear-gradient(90deg, ${color}, ${color}cc)`
              : `linear-gradient(90deg, ${color}80, ${color}40)`,
            boxShadow: isTop ? `0 0 12px ${color}30` : 'none',
          }} />
        </div>
      </div>

      {/* Meta row */}
      <div style={RC.metaRow}>
        <span style={RC.metaItem}>
          <span style={RC.metaIcon}>💰</span>
          <span style={RC.metaLabel}>Cost:</span>
          <span style={RC.metaValue}>{formatINR(option.estimated_cost)}</span>
        </span>
        <span style={RC.metaItem}>
          <span style={RC.metaIcon}>💼</span>
          <span style={RC.metaLabel}>Starting:</span>
          <span style={{ ...RC.metaValue, color: '#22c55e' }}>{formatLPA(option.expected_salary)}</span>
        </span>
        <span style={RC.metaItem}>
          <span style={RC.metaIcon}>⏱</span>
          <span style={RC.metaLabel}>Duration:</span>
          <span style={RC.metaValue}>{option.duration_years} yrs</span>
        </span>
        {option.matched_careers.length > 0 && (
          <span style={RC.metaItem}>
            <span style={RC.metaIcon}>🎯</span>
            <span style={RC.metaLabel}>For:</span>
            <span style={{ ...RC.metaValue, color: '#a78bfa' }}>
              {option.matched_careers.slice(0, 2).join(', ')}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Summary stats ────────────────────────────────────────────────────────────

function SummaryStats({ options }: { options: ROIOption[] }) {
  const best  = options[0];
  const avgCost   = Math.round(options.reduce((s, o) => s + o.estimated_cost, 0)  / options.length);
  const avgSalary = Math.round(options.reduce((s, o) => s + o.expected_salary, 0) / options.length);

  return (
    <div style={RC.statsRow}>
      <div style={RC.statBox}>
        <span style={RC.statLabel}>Best ROI Path</span>
        <span style={{ ...RC.statValue, color: '#22c55e', fontSize: 13 }}>{best.path}</span>
      </div>
      <div style={RC.statBox}>
        <span style={RC.statLabel}>Avg. Education Cost</span>
        <span style={RC.statValue}>{formatINR(avgCost)}</span>
      </div>
      <div style={RC.statBox}>
        <span style={RC.statLabel}>Avg. Starting Salary</span>
        <span style={{ ...RC.statValue, color: '#22c55e' }}>{formatLPA(avgSalary)}</span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EducationROICard({ education_options = [] }: Props) {
  const [animated, setAnimated] = useState(false);
  const [showAll,  setShowAll]  = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 150);
    return () => clearTimeout(t);
  }, []);

  if (!education_options || education_options.length === 0) {
    return (
      <div style={RC.card}>
        <p style={RC.heading}>Education Investment Analysis</p>
        <p style={{ ...RC.sub, marginBottom: 0 }}>
          No ROI data available. Run the analysis to generate results.
        </p>
      </div>
    );
  }

  const displayed = showAll ? education_options : education_options.slice(0, 5);

  return (
    <div style={RC.card}>
      {/* Header */}
      <div style={RC.headerRow}>
        <span style={RC.headerIcon}>📈</span>
        <div>
          <p style={RC.heading}>Education Investment Analysis</p>
          <p style={RC.sub}>ROI comparison across education paths relevant to your career profile</p>
        </div>
      </div>

      {/* Summary stats */}
      <SummaryStats options={education_options} />

      {/* ROI scale legend */}
      <div style={RC.scaleLegend}>
        {(['Low', 'Moderate', 'High', 'Very High'] as const).map(level => {
          const cfg = ROI_LEVEL_CONFIG[level];
          return (
            <span key={level} style={{ ...RC.scalePill, color: cfg.color, background: cfg.bg, borderColor: cfg.border }}>
              {level}
            </span>
          );
        })}
      </div>

      {/* Bars */}
      <div style={RC.barList}>
        {displayed.map((option, i) => (
          <ROIBar key={option.path} option={option} rank={i} animated={animated} />
        ))}
      </div>

      {/* Show more / less */}
      {education_options.length > 5 && (
        <button
          style={RC.showMoreBtn}
          onClick={() => setShowAll(v => !v)}
          onMouseEnter={e => { (e.currentTarget).style.opacity = '0.75'; }}
          onMouseLeave={e => { (e.currentTarget).style.opacity = '1'; }}
        >
          {showAll
            ? '▲ Show fewer options'
            : `▼ Show all ${education_options.length} options`}
        </button>
      )}

      {/* Footer legend */}
      <div style={RC.footerRow}>
        <span style={RC.footerItem}>0 — Low ROI</span>
        <span style={RC.footerItem}>50 — Moderate ROI</span>
        <span style={RC.footerItem}>100 — Maximum ROI</span>
      </div>

      <p style={RC.disclaimer}>
        ROI scores are estimates based on market benchmarks and cognitive fit.
        Actual outcomes depend on institution, specialisation, and individual effort.
      </p>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const RC: Record<string, React.CSSProperties> = {
  card:          { background: '#111827', border: '1.5px solid #1f2937', borderRadius: 20, padding: '28px 28px 20px', marginTop: 20 },

  headerRow:     { display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 },
  headerIcon:    { fontSize: 28, lineHeight: '1' },
  heading:       { fontFamily: 'Syne, sans-serif', fontSize: 17, fontWeight: 700, color: '#f9fafb', margin: '0 0 4px' },
  sub:           { fontSize: 13, color: '#6b7280', margin: 0 },

  statsRow:      { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 },
  statBox:       { background: '#0d1117', border: '1px solid #1f2937', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 },
  statLabel:     { fontSize: 10, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' },
  statValue:     { fontSize: 14, fontWeight: 700, color: '#f9fafb' },

  scaleLegend:   { display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  scalePill:     { fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, border: '1.5px solid' },

  barList:       { display: 'flex', flexDirection: 'column', gap: 20 },

  barRow:        { display: 'flex', flexDirection: 'column', gap: 7 },
  barHeader:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  barLeft:       { display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  barRight:      { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },

  rankBadge:     { fontSize: 10, fontWeight: 800, width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pathName:      { fontSize: 13, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  bestPill:      { fontSize: 9, fontWeight: 800, color: '#22c55e', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: '2px 7px', letterSpacing: '0.08em', flexShrink: 0 },
  roiLevelBadge: { fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 10, border: '1.5px solid' },
  roiScore:      { fontSize: 15, fontWeight: 800, minWidth: 28, textAlign: 'right' },

  trackWrap:     { display: 'flex', alignItems: 'center', gap: 10 },
  track:         { flex: 1, height: 10, background: '#1f2937', borderRadius: 6, overflow: 'hidden' },
  fill:          { height: '100%', borderRadius: 6, transition: 'width 1s cubic-bezier(0.34,1.2,0.64,1)' },

  metaRow:       { display: 'flex', gap: 16, flexWrap: 'wrap' },
  metaItem:      { display: 'flex', alignItems: 'center', gap: 4 },
  metaIcon:      { fontSize: 12 },
  metaLabel:     { fontSize: 11, color: '#4b5563', fontWeight: 500 },
  metaValue:     { fontSize: 11, fontWeight: 700, color: '#9ca3af' },

  showMoreBtn:   { marginTop: 16, width: '100%', background: 'transparent', border: '1px solid #1f2937', borderRadius: 10, padding: '10px', color: '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.2s' },

  footerRow:     { display: 'flex', justifyContent: 'space-between', marginTop: 20, paddingTop: 14, borderTop: '1px solid #1f2937' },
  footerItem:    { fontSize: 10, color: '#374151' },
  disclaimer:    { fontSize: 11, color: '#374151', marginTop: 10, lineHeight: 1.6, textAlign: 'center' },
};
