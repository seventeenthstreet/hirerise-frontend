'use client';

/**
 * src/modules/employer-dashboard/components/SkillTrendChart.tsx
 *
 * Horizontal bar chart visualising which skills appear most frequently
 * across all of an employer's active job roles.
 *
 * Pure CSS/SVG — no external chart library dependency.
 */

import React from 'react';
import type { SkillTrend } from '../services/employer.api';

interface Props {
  trends:    SkillTrend[];
  maxItems?: number;
}

const PALETTE = [
  '#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4',
  '#a855f7', '#84cc16',
];

export default function SkillTrendChart({ trends, maxItems = 10 }: Props) {
  if (!trends || trends.length === 0) {
    return (
      <div style={S.empty}>
        No skill trend data yet. Add job roles with required skills to see demand analysis.
      </div>
    );
  }

  const display = trends.slice(0, maxItems);
  const maxCount = Math.max(...display.map(t => t.demand_count), 1);

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <span style={S.headerTitle}>Most In-Demand Skills</span>
        <span style={S.headerSub}>across all active roles</span>
      </div>

      <div style={S.chart}>
        {display.map((trend, i) => {
          const pct = Math.round((trend.demand_count / maxCount) * 100);
          const color = PALETTE[i % PALETTE.length];

          return (
            <div key={trend.skill} style={S.row}>
              <div style={S.label}>{trend.skill}</div>
              <div style={S.barTrack}>
                <div
                  style={{
                    ...S.bar,
                    width:      `${pct}%`,
                    background: color,
                    boxShadow:  `0 0 8px ${color}40`,
                  }}
                />
              </div>
              <div style={{ ...S.count, color }}>{trend.demand_count}</div>
            </div>
          );
        })}
      </div>

      <div style={S.legend}>
        <span style={S.legendDot} /> Demand count = number of roles requiring this skill
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap:       { background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 20 },
  header:     { display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 20 },
  headerTitle:{ fontSize: 15, fontWeight: 600, color: '#f1f5f9' },
  headerSub:  { fontSize: 12, color: '#475569' },
  chart:      { display: 'flex', flexDirection: 'column', gap: 10 },
  row:        { display: 'flex', alignItems: 'center', gap: 12 },
  label:      { width: 140, fontSize: 13, color: '#cbd5e1', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  barTrack:   { flex: 1, background: '#0f172a', borderRadius: 4, height: 10, overflow: 'hidden' },
  bar:        { height: '100%', borderRadius: 4, transition: 'width 0.5s ease' },
  count:      { width: 28, fontSize: 12, fontWeight: 700, textAlign: 'right', flexShrink: 0 },
  legend:     { marginTop: 16, fontSize: 11, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 },
  legendDot:  { width: 8, height: 8, background: '#3b82f6', borderRadius: '50%', display: 'inline-block' },
  empty:      { color: '#475569', padding: '24px 0', textAlign: 'center', fontSize: 14 },
};
