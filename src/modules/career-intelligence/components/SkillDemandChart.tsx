/**
 * src/modules/career-intelligence/components/SkillDemandChart.tsx
 *
 * Two-part skill demand visualisation:
 *   1. Horizontal bar chart (demand_index) — primary view
 *   2. Industry tag pills per skill
 */

import React, { useEffect, useState } from 'react';
import type { SkillDemandItem } from '../services/analytics.api';

const PALETTE = [
  '#06b6d4','#6366f1','#22c55e','#f59e0b','#a78bfa',
  '#f43f5e','#10b981','#8b5cf6','#ec4899','#14b8a6',
  '#3b82f6','#ef4444','#84cc16','#f97316',
];

const INDUSTRY_COLORS: Record<string, string> = {
  Technology:   '#06b6d4',
  Finance:      '#22c55e',
  Healthcare:   '#a78bfa',
  Marketing:    '#f59e0b',
  Consulting:   '#6366f1',
  Research:     '#10b981',
  Government:   '#8b5cf6',
  All:          '#9ca3af',
};

interface Props { skills: SkillDemandItem[]; limit?: number; }

export default function SkillDemandChart({ skills, limit = 12 }: Props) {
  const [animated, setAnimated] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 100); return () => clearTimeout(t); }, []);

  const visible = skills.slice(0, limit);

  return (
    <div style={S.wrap}>
      {visible.map((s, i) => {
        const color   = PALETTE[i % PALETTE.length];
        const pct     = animated ? s.demand_index : 0;
        const isOpen  = selected === i;
        const growthPct = `+${(s.growth_rate * 100).toFixed(0)}%`;

        return (
          <div key={s.skill}>
            <div
              style={{ ...S.row, cursor: 'pointer' }}
              onClick={() => setSelected(isOpen ? null : i)}
            >
              <div style={S.labelCol}>
                <span style={{ ...S.rank, background: color }}>#{i + 1}</span>
                <span style={S.name}>{s.skill}</span>
              </div>

              <div style={S.track}>
                <div style={{
                  ...S.bar,
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${color}55, ${color})`,
                  transition: `width 0.75s cubic-bezier(0.34,1.1,0.64,1) ${i * 40}ms`,
                }} />
              </div>

              <div style={S.rightCol}>
                <span style={{ ...S.score, color }}>{s.demand_index}</span>
                <span style={{ ...S.growthBadge, color: '#22c55e' }}>{growthPct}/yr</span>
              </div>

              <span style={S.chevron}>{isOpen ? '▾' : '▸'}</span>
            </div>

            {/* Expanded industry tags */}
            {isOpen && (
              <div style={S.tagRow}>
                {s.industries.map(ind => (
                  <span
                    key={ind}
                    style={{ ...S.tag, color: INDUSTRY_COLORS[ind] ?? '#9ca3af', background: `${INDUSTRY_COLORS[ind] ?? '#9ca3af'}15` }}
                  >
                    {ind}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap:       { display: 'flex', flexDirection: 'column', gap: 6 },
  row:        { display: 'grid', gridTemplateColumns: '180px 1fr 80px 20px', alignItems: 'center', gap: 10, padding: '2px 0' },
  labelCol:   { display: 'flex', alignItems: 'center', gap: 7 },
  rank:       { fontSize: 9, fontWeight: 800, color: '#000', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  name:       { fontSize: 12, fontWeight: 600, color: '#d1d5db' },
  track:      { height: 9, background: '#1f2937', borderRadius: 5, overflow: 'hidden' },
  bar:        { height: '100%', borderRadius: 5 },
  rightCol:   { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 },
  score:      { fontSize: 14, fontWeight: 800 },
  growthBadge:{ fontSize: 9, fontWeight: 600 },
  chevron:    { fontSize: 11, color: '#4b5563', textAlign: 'center' },
  tagRow:     { display: 'flex', gap: 6, flexWrap: 'wrap', paddingLeft: 30, paddingBottom: 6 },
  tag:        { fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10 },
};
