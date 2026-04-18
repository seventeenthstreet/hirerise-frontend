/**
 * src/modules/career-intelligence/components/CareerDemandChart.tsx
 *
 * Horizontal ranked bar chart for the Career Demand Index.
 * Each bar shows demand_index with colour-coded salary growth badge.
 */

import React, { useEffect, useState } from 'react';
import type { CareerDemandItem } from '../services/analytics.api';

const PALETTE = [
  '#06b6d4','#6366f1','#22c55e','#f59e0b','#a78bfa',
  '#f43f5e','#10b981','#8b5cf6','#ec4899','#14b8a6',
  '#3b82f6','#ef4444','#84cc16','#f97316',
];

function formatLPA(v: number) {
  return `₹${(v / 100000).toFixed(1)}L`;
}
function growthLabel(g: number) {
  if (g >= 0.18) return { text: '🚀 Very High', color: '#22c55e' };
  if (g >= 0.13) return { text: '📈 High',      color: '#06b6d4' };
  if (g >= 0.09) return { text: '→ Moderate',   color: '#f59e0b' };
  return             { text: '↗ Stable',         color: '#9ca3af' };
}

interface Props { careers: CareerDemandItem[]; limit?: number; }

export default function CareerDemandChart({ careers, limit = 10 }: Props) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 120); return () => clearTimeout(t); }, []);

  const visible = careers.slice(0, limit);
  const maxIdx  = Math.max(...visible.map(c => c.demand_index), 100);

  return (
    <div style={C.wrap}>
      {visible.map((c, i) => {
        const color = PALETTE[i % PALETTE.length];
        const pct   = animated ? (c.demand_index / maxIdx) * 100 : 0;
        const gl    = growthLabel(c.salary_growth);

        return (
          <div key={c.career} style={C.row}>
            {/* rank + name */}
            <div style={C.labelCol}>
              <span style={{ ...C.rank, background: color }}>#{i + 1}</span>
              <span style={C.name}>{c.career}</span>
            </div>

            {/* bar track */}
            <div style={C.track}>
              <div style={{
                ...C.bar,
                width: `${pct}%`,
                background: `linear-gradient(90deg, ${color}66, ${color})`,
                transition: `width 0.8s cubic-bezier(0.34,1.1,0.64,1) ${i * 45}ms`,
              }} />
            </div>

            {/* score + growth */}
            <div style={C.scoreCol}>
              <span style={{ ...C.score, color }}>{c.demand_index}</span>
              <span style={{ ...C.growth, color: gl.color }}>{gl.text}</span>
            </div>

            {/* salary */}
            <span style={C.salary}>
              {formatLPA(c.entry_salary)} → {formatLPA(c.salary_10yr)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const C: Record<string, React.CSSProperties> = {
  wrap:     { display: 'flex', flexDirection: 'column', gap: 8 },
  row:      { display: 'grid', gridTemplateColumns: '200px 1fr 110px 140px', alignItems: 'center', gap: 10 },
  labelCol: { display: 'flex', alignItems: 'center', gap: 7 },
  rank:     { fontSize: 9, fontWeight: 800, color: '#000', width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  name:     { fontSize: 12, fontWeight: 600, color: '#d1d5db', lineHeight: 1.2 },
  track:    { height: 10, background: '#1f2937', borderRadius: 6, overflow: 'hidden' },
  bar:      { height: '100%', borderRadius: 6 },
  scoreCol: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 },
  score:    { fontSize: 14, fontWeight: 800 },
  growth:   { fontSize: 9, fontWeight: 600 },
  salary:   { fontSize: 10, color: '#6b7280', textAlign: 'right' },
};
