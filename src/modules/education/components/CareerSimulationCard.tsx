import React, { useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Milestone { year: number; salary: number; }

export interface Simulation {
  career:              string;
  probability:         number;
  entry_salary:        number;
  salary_3_year:       number;
  salary_5_year:       number;
  salary_10_year:      number;
  annual_growth_rate:  number;
  demand_level:        string;
  roi_level:           string;
  best_education_path: string | null;
  milestones:          Milestone[];
}

interface Props { simulations: Simulation[]; }

// ─── Config ───────────────────────────────────────────────────────────────────

const CAREER_COLORS = [
  '#06b6d4', '#6366f1', '#22c55e', '#f59e0b', '#a78bfa',
  '#f43f5e', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6',
];

const DEMAND_CONFIG: Record<string, { color: string; bg: string }> = {
  'Exceptional': { color: '#22c55e', bg: 'rgba(34,197,94,0.12)'   },
  'Very High':   { color: '#06b6d4', bg: 'rgba(6,182,212,0.12)'   },
  'High':        { color: '#6366f1', bg: 'rgba(99,102,241,0.12)'  },
  'Stable':      { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  'Moderate':    { color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' },
};

const ROI_COLOR: Record<string, string> = {
  'Very High': '#22c55e',
  'High':      '#06b6d4',
  'Moderate':  '#f59e0b',
  'Low':       '#ef4444',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLPA(salary: number): string {
  const lpa = salary / 100000;
  return `₹${lpa % 1 === 0 ? lpa.toFixed(0) : lpa.toFixed(1)}L`;
}

function formatINRShort(salary: number): string {
  if (salary >= 10000000) return `₹${(salary / 10000000).toFixed(1)}Cr`;
  if (salary >= 100000)   return `₹${(salary / 100000).toFixed(1)}L`;
  return `₹${salary}`;
}

// ─── SVG Line Chart ───────────────────────────────────────────────────────────

function SalaryChart({
  simulations,
  activeIndex,
  animated,
}: {
  simulations: Simulation[];
  activeIndex: number;
  animated: boolean;
}) {
  const W = 500, H = 200, PAD = { t: 16, r: 16, b: 36, l: 52 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;

  // Year axis: 1–10
  const years = Array.from({ length: 10 }, (_, i) => i + 1);

  // Global salary scale across all visible simulations
  const allSalaries = simulations.flatMap(s => s.milestones.map(m => m.salary));
  const maxSal = Math.max(...allSalaries, 1);
  const minSal = 0;

  const xOf  = (year: number)   => PAD.l + ((year - 1) / 9) * iW;
  const yOf  = (salary: number) => PAD.t + iH - ((salary - minSal) / (maxSal - minSal)) * iH;

  // Y-axis labels (4 ticks)
  const yTicks = [0, 0.33, 0.67, 1].map(f => minSal + f * maxSal);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: 'auto', overflow: 'visible' }}
    >
      {/* Grid lines */}
      {yTicks.map((v, i) => (
        <line key={i}
          x1={PAD.l} y1={yOf(v)} x2={W - PAD.r} y2={yOf(v)}
          stroke="#1f2937" strokeWidth={1} strokeDasharray="3 3" />
      ))}

      {/* Y-axis labels */}
      {yTicks.map((v, i) => (
        <text key={i} x={PAD.l - 6} y={yOf(v) + 4}
          textAnchor="end" fill="#4b5563" fontSize={9} fontFamily="DM Sans, sans-serif">
          {formatINRShort(v)}
        </text>
      ))}

      {/* X-axis labels — Yr 1, 3, 5, 10 */}
      {[1, 3, 5, 10].map(yr => (
        <text key={yr} x={xOf(yr)} y={H - 8}
          textAnchor="middle" fill="#4b5563" fontSize={9} fontFamily="DM Sans, sans-serif">
          Yr {yr}
        </text>
      ))}

      {/* Career lines — dimmed except active */}
      {simulations.map((sim, idx) => {
        if (!sim.milestones?.length) return null;
        const color   = CAREER_COLORS[idx % CAREER_COLORS.length];
        const isActive = idx === activeIndex;
        const pts = sim.milestones
          .map(m => `${xOf(m.year)},${yOf(animated ? m.salary : 0)}`)
          .join(' ');

        return (
          <g key={sim.career}>
            <polyline
              points={pts}
              fill="none"
              stroke={color}
              strokeWidth={isActive ? 2.5 : 1}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={isActive ? 1 : 0.25}
              style={{ transition: 'all 0.4s ease' }}
            />
            {/* Active line dots at milestones */}
            {isActive && [0, 2, 4, 9].map(mi => {
              const m = sim.milestones[mi];
              if (!m) return null;
              return (
                <circle key={mi}
                  cx={xOf(m.year)} cy={yOf(animated ? m.salary : 0)} r={3.5}
                  fill={color} stroke="#0d1117" strokeWidth={1.5}
                  style={{ transition: `cy 0.8s cubic-bezier(0.34,1.1,0.64,1) ${mi * 0.05}s` }}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Simulation Card ──────────────────────────────────────────────────────────

function SimCard({
  sim,
  rank,
  color,
  isActive,
  onClick,
}: {
  sim: Simulation;
  rank: number;
  color: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const demand = DEMAND_CONFIG[sim.demand_level] ?? DEMAND_CONFIG['Moderate'];
  const roiCol = ROI_COLOR[sim.roi_level] ?? '#9ca3af';
  const growthPct = `+${(sim.annual_growth_rate * 100).toFixed(1)}%/yr`;

  return (
    <button
      style={{
        ...SC.card,
        borderColor: isActive ? color : '#1f2937',
        background:  isActive ? `${color}10` : '#0d1117',
      }}
      onClick={onClick}
    >
      {/* Rank + career name */}
      <div style={SC.cardHeader}>
        <span style={{ ...SC.rankDot, background: color }}>#{rank + 1}</span>
        <span style={{ ...SC.careerName, color: isActive ? '#f9fafb' : '#9ca3af' }}>
          {sim.career}
        </span>
      </div>

      {/* Salary milestones */}
      <div style={SC.salaryRow}>
        <div style={SC.salaryItem}>
          <span style={SC.salaryLabel}>Entry</span>
          <span style={{ ...SC.salaryValue, color }}>{formatLPA(sim.entry_salary)}</span>
        </div>
        <span style={SC.arrow}>→</span>
        <div style={SC.salaryItem}>
          <span style={SC.salaryLabel}>5-Yr</span>
          <span style={{ ...SC.salaryValue, color }}>{formatLPA(sim.salary_5_year)}</span>
        </div>
        <span style={SC.arrow}>→</span>
        <div style={SC.salaryItem}>
          <span style={SC.salaryLabel}>10-Yr</span>
          <span style={{ ...SC.salaryValue, color: '#22c55e' }}>{formatLPA(sim.salary_10_year)}</span>
        </div>
      </div>

      {/* Badges */}
      <div style={SC.badgeRow}>
        <span style={{ ...SC.badge, color: demand.color, background: demand.bg }}>
          {sim.demand_level}
        </span>
        <span style={{ ...SC.badge, color: roiCol, background: `${roiCol}18` }}>
          ROI: {sim.roi_level}
        </span>
        <span style={{ ...SC.growthBadge }}>📈 {growthPct}</span>
      </div>

      {/* Education path */}
      {sim.best_education_path && (
        <div style={SC.eduPath}>
          🎓 <span style={SC.eduPathText}>{sim.best_education_path}</span>
        </div>
      )}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CareerSimulationCard({ simulations = [] }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [animated,    setAnimated]    = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 200);
    return () => clearTimeout(t);
  }, []);

  if (!simulations || simulations.length === 0) {
    return (
      <div style={CS.card}>
        <p style={CS.heading}>Future Career Simulation</p>
        <p style={{ ...CS.sub, marginBottom: 0 }}>
          No simulation data available. Run the analysis to generate projections.
        </p>
      </div>
    );
  }

  const active = simulations[activeIndex];
  const activeColor = CAREER_COLORS[activeIndex % CAREER_COLORS.length];

  return (
    <div style={CS.card}>
      {/* Header */}
      <div style={CS.headerRow}>
        <span style={CS.headerIcon}>🔮</span>
        <div>
          <p style={CS.heading}>Future Career Simulation</p>
          <p style={CS.sub}>10-year salary trajectory based on your cognitive profile and career fit</p>
        </div>
      </div>

      {/* Chart */}
      <div style={CS.chartWrap}>
        <div style={CS.chartTitle}>
          <span style={{ color: activeColor, fontWeight: 700 }}>{active.career}</span>
          <span style={CS.chartSub}> — salary projection (INR)</span>
        </div>
        <SalaryChart
          simulations={simulations}
          activeIndex={activeIndex}
          animated={animated}
        />
        <div style={CS.chartLegend}>
          {simulations.map((s, i) => (
            <button
              key={s.career}
              style={{
                ...CS.legendItem,
                opacity: i === activeIndex ? 1 : 0.45,
                cursor: 'pointer',
              }}
              onClick={() => setActiveIndex(i)}
            >
              <span style={{ ...CS.legendDot, background: CAREER_COLORS[i % CAREER_COLORS.length] }} />
              <span style={CS.legendLabel}>{s.career}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Simulation cards */}
      <div style={CS.cardGrid}>
        {simulations.map((sim, i) => (
          <SimCard
            key={sim.career}
            sim={sim}
            rank={i}
            color={CAREER_COLORS[i % CAREER_COLORS.length]}
            isActive={i === activeIndex}
            onClick={() => setActiveIndex(i)}
          />
        ))}
      </div>

      {/* Active detail panel */}
      <div style={{ ...CS.detailPanel, borderColor: `${activeColor}40` }}>
        <p style={{ ...CS.detailTitle, color: activeColor }}>
          📊 {active.career} — Detailed Projection
        </p>
        <div style={CS.detailGrid}>
          {active.milestones?.filter((_, i) => [0, 1, 2, 4, 6, 9].includes(i)).map(m => (
            <div key={m.year} style={CS.detailItem}>
              <span style={CS.detailYear}>Year {m.year}</span>
              <span style={{ ...CS.detailSalary, color: activeColor }}>
                {formatLPA(m.salary)}
              </span>
            </div>
          ))}
        </div>
        <p style={CS.detailMeta}>
          Growth rate: <strong style={{ color: activeColor }}>
            +{(active.annual_growth_rate * 100).toFixed(1)}%/yr
          </strong>
          &nbsp;·&nbsp;
          Demand: <strong style={{ color: DEMAND_CONFIG[active.demand_level]?.color ?? '#9ca3af' }}>
            {active.demand_level}
          </strong>
          {active.best_education_path && (
            <>&nbsp;·&nbsp; Best path: <strong style={{ color: '#a78bfa' }}>
              {active.best_education_path}
            </strong></>
          )}
        </p>
      </div>

      <p style={CS.disclaimer}>
        Projections are estimates based on market benchmarks and your cognitive assessment.
        Actual salaries depend on institution, specialisation, location, and individual performance.
      </p>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CS: Record<string, React.CSSProperties> = {
  card:        { background: '#111827', border: '1.5px solid #1f2937', borderRadius: 20, padding: '28px 28px 20px', marginTop: 20 },
  headerRow:   { display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 },
  headerIcon:  { fontSize: 28, lineHeight: '1' },
  heading:     { fontFamily: 'Syne, sans-serif', fontSize: 17, fontWeight: 700, color: '#f9fafb', margin: '0 0 4px' },
  sub:         { fontSize: 13, color: '#6b7280', margin: 0 },

  chartWrap:   { background: '#0d1117', border: '1px solid #1f2937', borderRadius: 14, padding: '16px 16px 8px', marginBottom: 20 },
  chartTitle:  { fontSize: 13, color: '#6b7280', marginBottom: 8 },
  chartSub:    { fontWeight: 400, color: '#4b5563' },
  chartLegend: { display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, paddingTop: 8, borderTop: '1px solid #1f2937' },
  legendItem:  { display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', padding: 0, transition: 'opacity 0.2s' },
  legendDot:   { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  legendLabel: { fontSize: 11, color: '#9ca3af' },

  cardGrid:    { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 },
};

const SC: Record<string, React.CSSProperties> = {
  card:        { background: '#0d1117', border: '1.5px solid #1f2937', borderRadius: 14, padding: '14px 16px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.2s, background 0.2s', width: '100%' },
  cardHeader:  { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 },
  rankDot:     { fontSize: 10, fontWeight: 800, color: '#000', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  careerName:  { fontSize: 14, fontWeight: 700, flex: 1 },
  salaryRow:   { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  salaryItem:  { display: 'flex', flexDirection: 'column', gap: 2 },
  salaryLabel: { fontSize: 9, color: '#4b5563', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' },
  salaryValue: { fontSize: 14, fontWeight: 800 },
  arrow:       { fontSize: 12, color: '#374151' },
  badgeRow:    { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
  badge:       { fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10 },
  growthBadge: { fontSize: 10, fontWeight: 600, color: '#22c55e', background: 'rgba(34,197,94,0.08)', padding: '2px 8px', borderRadius: 10 },
  eduPath:     { fontSize: 11, color: '#4b5563', marginTop: 4 },
  eduPathText: { color: '#a78bfa' },
};

Object.assign(CS, {
  detailPanel: { background: '#0d1117', border: '1.5px solid #1f2937', borderRadius: 14, padding: '16px 18px', marginBottom: 16 },
  detailTitle: { fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, margin: '0 0 12px' },
  detailGrid:  { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 10 },
  detailItem:  { display: 'flex', flexDirection: 'column', gap: 3 },
  detailYear:  { fontSize: 9, color: '#4b5563', fontWeight: 600, textTransform: 'uppercase' },
  detailSalary:{ fontSize: 13, fontWeight: 700 },
  detailMeta:  { fontSize: 12, color: '#6b7280', margin: 0, lineHeight: 1.6 },
  disclaimer:  { fontSize: 11, color: '#374151', marginTop: 8, lineHeight: 1.6, textAlign: 'center' },
});
