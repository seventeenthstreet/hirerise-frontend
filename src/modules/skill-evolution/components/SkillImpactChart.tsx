/**
 * src/modules/skill-evolution/components/SkillImpactChart.tsx
 *
 * Two visualizations in one component:
 *
 *   1. Horizontal bar chart — "Skill Impact Score" (ordered by impact desc)
 *      Each bar shows a gradient fill proportional to the impact score,
 *      with the score label on the right.
 *
 *   2. Bubble / scatter chart — "Demand vs Growth Rate"
 *      X axis = demand_score (0–100)
 *      Y axis = growth_rate  (0–30%)
 *      Bubble size = career_relevance (0–1)
 *
 * Props:
 *   skills — SkillRecommendation[]
 *   mode   — 'impact' | 'demand'  (which chart to show)
 */

import React, { useEffect, useState } from 'react';
import type { SkillRecommendation } from '../services/skills.api';

// ─── Config ───────────────────────────────────────────────────────────────────

const PALETTE = [
  '#06b6d4', '#6366f1', '#22c55e', '#f59e0b', '#a78bfa',
  '#f43f5e', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6',
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface SkillImpactChartProps {
  skills: SkillRecommendation[];
}

// ─── Impact Bar Chart ─────────────────────────────────────────────────────────

function ImpactBarChart({ skills }: { skills: SkillRecommendation[] }) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  const maxImpact = Math.max(...skills.map(s => s.impact), 100);

  return (
    <div style={IC.barChartWrap}>
      {skills.map((s, i) => {
        const color     = PALETTE[i % PALETTE.length];
        const barPct    = animated ? (s.impact / maxImpact) * 100 : 0;

        return (
          <div key={s.skill} style={IC.barRow}>
            {/* Skill name label */}
            <span style={IC.barLabel}>{s.skill}</span>

            {/* Track + fill */}
            <div style={IC.barTrack}>
              <div
                style={{
                  ...IC.barFill,
                  width:      `${barPct}%`,
                  background: `linear-gradient(90deg, ${color}88, ${color})`,
                  transition:  `width 0.8s cubic-bezier(0.34,1.1,0.64,1) ${i * 50}ms`,
                }}
              />
            </div>

            {/* Score value */}
            <span style={{ ...IC.barValue, color }}>{s.impact}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Demand vs Growth Bubble Chart ───────────────────────────────────────────

function DemandBubbleChart({ skills }: { skills: SkillRecommendation[] }) {
  const W = 460, H = 200;
  const PAD = { t: 20, r: 20, b: 32, l: 44 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;

  const xOf = (demand: number)     => PAD.l + (demand / 100) * iW;
  const yOf = (growth: number)     => PAD.t + iH - (growth / 0.30) * iH;
  const rOf = (relevance: number)  => 5 + relevance * 10;

  const xTicks = [0, 25, 50, 75, 100];
  const yTicks = [0, 0.10, 0.20, 0.30];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
      {/* Grid */}
      {yTicks.map((v, i) => (
        <g key={i}>
          <line
            x1={PAD.l} y1={yOf(v)} x2={W - PAD.r} y2={yOf(v)}
            stroke="#1f2937" strokeWidth={1} strokeDasharray="3 3"
          />
          <text x={PAD.l - 6} y={yOf(v) + 4}
            textAnchor="end" fill="#4b5563" fontSize={9} fontFamily="DM Sans, sans-serif">
            {(v * 100).toFixed(0)}%
          </text>
        </g>
      ))}
      {xTicks.map((v, i) => (
        <text key={i} x={xOf(v)} y={H - 8}
          textAnchor="middle" fill="#4b5563" fontSize={9} fontFamily="DM Sans, sans-serif">
          {v}
        </text>
      ))}

      {/* Axis labels */}
      <text x={W / 2} y={H} textAnchor="middle" fill="#374151" fontSize={9} fontFamily="DM Sans, sans-serif">
        Demand Score
      </text>
      <text
        x={12} y={H / 2}
        textAnchor="middle" fill="#374151" fontSize={9} fontFamily="DM Sans, sans-serif"
        transform={`rotate(-90, 12, ${H / 2})`}
      >
        Growth Rate
      </text>

      {/* Bubbles */}
      {skills.map((s, i) => {
        const color = PALETTE[i % PALETTE.length];
        const cx    = xOf(s.demand_score);
        const cy    = yOf(Math.min(s.growth_rate, 0.30));
        const r     = rOf(s.career_relevance);

        return (
          <g key={s.skill}>
            <circle cx={cx} cy={cy} r={r}
              fill={`${color}30`} stroke={color} strokeWidth={1.5} />
            <text cx={cx} y={cy - r - 3}
              x={cx} textAnchor="middle" fill={color}
              fontSize={8} fontFamily="DM Sans, sans-serif" fontWeight={600}>
              {s.skill.length > 10 ? s.skill.slice(0, 9) + '…' : s.skill}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SkillImpactChart({ skills }: SkillImpactChartProps) {
  const [tab, setTab] = useState<'impact' | 'demand'>('impact');

  if (!skills || skills.length === 0) {
    return (
      <div style={IC.emptyWrap}>
        <p style={IC.emptyText}>No skill data to chart.</p>
      </div>
    );
  }

  return (
    <div style={IC.wrap}>
      {/* Tab switcher */}
      <div style={IC.tabs}>
        {(['impact', 'demand'] as const).map(t => (
          <button
            key={t}
            style={{
              ...IC.tab,
              ...(tab === t ? IC.tabActive : {}),
            }}
            onClick={() => setTab(t)}
          >
            {t === 'impact' ? '📊 Impact Score' : '🌐 Demand vs Growth'}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div style={IC.chartArea}>
        {tab === 'impact'
          ? <ImpactBarChart  skills={skills} />
          : <DemandBubbleChart skills={skills} />
        }
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const IC: Record<string, React.CSSProperties> = {
  wrap:         { background: '#0d1117', border: '1px solid #1f2937', borderRadius: 14, padding: '16px 18px' },

  tabs:         { display: 'flex', gap: 6, marginBottom: 14 },
  tab:          { fontSize: 11, fontWeight: 600, color: '#6b7280', background: 'transparent', border: '1.5px solid #1f2937', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', transition: 'all 0.2s' },
  tabActive:    { color: '#06b6d4', borderColor: '#06b6d4', background: 'rgba(6,182,212,0.08)' },

  chartArea:    { minHeight: 160 },

  // Bar chart
  barChartWrap: { display: 'flex', flexDirection: 'column', gap: 8 },
  barRow:       { display: 'flex', alignItems: 'center', gap: 8 },
  barLabel:     { fontSize: 12, color: '#9ca3af', flex: '0 0 130px', textAlign: 'right', fontWeight: 500 },
  barTrack:     { flex: 1, height: 10, background: '#1f2937', borderRadius: 6, overflow: 'hidden' },
  barFill:      { height: '100%', borderRadius: 6 },
  barValue:     { fontSize: 12, fontWeight: 800, flex: '0 0 28px', textAlign: 'right' },

  emptyWrap:    { padding: '32px', textAlign: 'center' },
  emptyText:    { fontSize: 13, color: '#4b5563', margin: 0 },
};
