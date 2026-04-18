/**
 * src/modules/career-intelligence/components/ROIRankingTable.tsx
 *
 * Ranked table of education paths by ROI score.
 * Includes ROI level badge, payback years, cost, and average salary.
 */

import React, { useState } from 'react';
import type { ROIPath } from '../services/analytics.api';

const ROI_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  'Very High': { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   icon: '🚀' },
  'High':      { color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',   icon: '📈' },
  'Moderate':  { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: '→'  },
  'Low':       { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   icon: '↘'  },
};

const STREAM_COLOR: Record<string, string> = {
  engineering: '#06b6d4',
  commerce:    '#f59e0b',
  medical:     '#22c55e',
  humanities:  '#a78bfa',
};

function fmt(n: number) { return `₹${(n / 100000).toFixed(1)}L`; }
function fmtK(n: number) { return n >= 100000 ? fmt(n) : `₹${(n / 1000).toFixed(0)}K`; }

interface Props { paths: ROIPath[]; }

export default function ROIRankingTable({ paths }: Props) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? paths : paths.slice(0, 8);

  return (
    <div style={T.wrap}>
      {/* Header */}
      <div style={T.header}>
        <span style={T.hCell}>Rank</span>
        <span style={{ ...T.hCell, flex: 3 }}>Education Path</span>
        <span style={T.hCell}>ROI Level</span>
        <span style={T.hCell}>Score</span>
        <span style={T.hCell}>Cost</span>
        <span style={T.hCell}>Avg Salary</span>
        <span style={T.hCell}>Payback</span>
      </div>

      {visible.map((p, i) => {
        const cfg = ROI_CONFIG[p.roi_level] ?? ROI_CONFIG['Moderate'];
        return (
          <div key={p.path} style={{ ...T.row, background: i % 2 === 0 ? '#0d1117' : '#111827' }}>
            <span style={T.rankNum}>#{i + 1}</span>

            <div style={{ ...T.pathCell, flex: 3 }}>
              <span style={T.pathName}>{p.path}</span>
              <div style={T.streamTags}>
                {p.streams.map(s => (
                  <span key={s} style={{ ...T.streamTag, color: STREAM_COLOR[s] ?? '#9ca3af', background: `${STREAM_COLOR[s] ?? '#9ca3af'}18` }}>
                    {s}
                  </span>
                ))}
                <span style={T.dur}>{p.duration_years}yr</span>
              </div>
            </div>

            <span style={{ ...T.roiBadge, color: cfg.color, background: cfg.bg }}>
              {cfg.icon} {p.roi_level}
            </span>

            <span style={{ ...T.scoreNum, color: cfg.color }}>{p.roi_score}</span>
            <span style={T.cell}>{fmtK(p.estimated_cost)}</span>
            <span style={{ ...T.cell, color: '#22c55e' }}>{fmt(p.avg_salary)}/yr</span>
            <span style={T.cell}>{p.payback_years}yr</span>
          </div>
        );
      })}

      {paths.length > 8 && (
        <button style={T.showMore} onClick={() => setShowAll(v => !v)}>
          {showAll ? '▲ Show less' : `▼ Show all ${paths.length} paths`}
        </button>
      )}
    </div>
  );
}

const T: Record<string, React.CSSProperties> = {
  wrap:      { overflow: 'hidden', borderRadius: 12, border: '1px solid #1f2937' },
  header:    { display: 'flex', gap: 8, padding: '10px 16px', background: '#1f2937', alignItems: 'center' },
  hCell:     { flex: 1, fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' },
  row:       { display: 'flex', gap: 8, padding: '11px 16px', alignItems: 'center', borderBottom: '1px solid #1f293720' },
  rankNum:   { flex: 1, fontSize: 12, fontWeight: 800, color: '#4b5563' },
  pathCell:  { display: 'flex', flexDirection: 'column', gap: 4 },
  pathName:  { fontSize: 13, fontWeight: 600, color: '#f9fafb' },
  streamTags:{ display: 'flex', gap: 4, flexWrap: 'wrap' },
  streamTag: { fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 8 },
  dur:       { fontSize: 9, color: '#4b5563', padding: '1px 6px', background: '#1f2937', borderRadius: 8 },
  roiBadge:  { flex: 1, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 10, textAlign: 'center' },
  scoreNum:  { flex: 1, fontSize: 15, fontWeight: 800, textAlign: 'center' },
  cell:      { flex: 1, fontSize: 11, color: '#9ca3af', textAlign: 'right' },
  showMore:  { width: '100%', padding: '10px', background: '#111827', border: 'none', color: '#6b7280', fontSize: 12, cursor: 'pointer', borderTop: '1px solid #1f2937' },
};
