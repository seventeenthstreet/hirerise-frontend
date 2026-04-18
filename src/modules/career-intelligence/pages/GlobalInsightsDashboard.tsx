/**
 * src/modules/career-intelligence/pages/GlobalInsightsDashboard.tsx
 *
 * Global Career Intelligence Dashboard (GCID)
 * Route: /intelligence
 *
 * Five-section macro intelligence view:
 *   1. Career Demand Index     — top growing careers ranked
 *   2. Skill Demand Index      — most demanded skills globally
 *   3. Education ROI Rankings  — degree paths by financial return
 *   4. Career Growth Forecast  — 10-year salary projections (SVG line chart)
 *   5. Industry Trend Analysis — emerging sectors with growth signals
 */

'use client';

import React, { useEffect, useState } from 'react';
import { getOverview, type OverviewResponse } from '../services/analytics.api';
import CareerDemandChart  from '../components/CareerDemandChart';
import SkillDemandChart   from '../components/SkillDemandChart';
import ROIRankingTable    from '../components/ROIRankingTable';
import IndustryTrendChart from '../components/IndustryTrendChart';

// ─── Palette / helpers ────────────────────────────────────────────────────────

const PALETTE = [
  '#06b6d4','#6366f1','#22c55e','#f59e0b','#a78bfa',
  '#f43f5e','#10b981','#8b5cf6',
];

function formatLPA(v: number) { return `₹${(v / 100000).toFixed(1)}L`; }

// ─── Career Growth SVG Line Chart ─────────────────────────────────────────────

function GrowthLineChart({ forecasts }: { forecasts: OverviewResponse['careerGrowth']['forecasts'] }) {
  const [animated, setAnimated] = useState(false);
  const [hovered,  setHovered]  = useState<number>(0);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 200); return () => clearTimeout(t); }, []);

  const top = forecasts.slice(0, 6);
  const W = 520, H = 200, PAD = { t: 16, r: 16, b: 36, l: 58 };
  const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b;

  const years = [1, 3, 5, 7, 10];
  const allSalaries = top.flatMap(f => f.milestones.map(m => m.salary));
  const maxSal = Math.max(...allSalaries, 1);
  const xOf = (yr: number) => PAD.l + ((years.indexOf(yr)) / (years.length - 1)) * iW;
  const yOf = (sal: number) => PAD.t + iH - (sal / maxSal) * iH;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(f * maxSal));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
        {/* Grid */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={PAD.l} y1={yOf(v)} x2={W - PAD.r} y2={yOf(v)} stroke="#1f2937" strokeWidth={1} strokeDasharray="3 3" />
            <text x={PAD.l - 6} y={yOf(v) + 4} textAnchor="end" fill="#4b5563" fontSize={9} fontFamily="DM Sans, sans-serif">
              {formatLPA(v)}
            </text>
          </g>
        ))}
        {years.map(yr => (
          <text key={yr} x={xOf(yr)} y={H - 8} textAnchor="middle" fill="#4b5563" fontSize={9} fontFamily="DM Sans, sans-serif">
            Yr {yr}
          </text>
        ))}

        {/* Career lines */}
        {top.map((f, idx) => {
          const color   = PALETTE[idx % PALETTE.length];
          const isActive = idx === hovered;
          const pts = years
            .map(yr => f.milestones.find(m => m.year === yr) ?? f.milestones[f.milestones.length - 1])
            .map(m => `${xOf(m.year)},${yOf(animated ? m.salary : 0)}`)
            .join(' ');

          return (
            <g key={f.career} style={{ cursor: 'pointer' }} onClick={() => setHovered(idx)}>
              <polyline points={pts} fill="none" stroke={color}
                strokeWidth={isActive ? 2.5 : 1}
                opacity={isActive ? 1 : 0.3}
                strokeLinecap="round" strokeLinejoin="round"
                style={{ transition: 'opacity 0.3s, stroke-width 0.3s' }}
              />
              {isActive && years.map(yr => {
                const m = f.milestones.find(mi => mi.year === yr);
                if (!m) return null;
                return (
                  <circle key={yr} cx={xOf(yr)} cy={yOf(animated ? m.salary : 0)} r={4}
                    fill={color} stroke="#0d1117" strokeWidth={1.5}
                    style={{ transition: `cy 0.8s cubic-bezier(0.34,1.1,0.64,1)` }}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid #1f2937', marginTop: 4 }}>
        {top.map((f, i) => (
          <button key={f.career} onClick={() => setHovered(i)} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            opacity: i === hovered ? 1 : 0.4, transition: 'opacity 0.2s',
          }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: PALETTE[i % PALETTE.length], flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#9ca3af' }}>{f.career}</span>
          </button>
        ))}
      </div>

      {/* Active detail */}
      {(() => {
        const f = top[hovered];
        if (!f) return null;
        const color = PALETTE[hovered % PALETTE.length];
        return (
          <div style={{ marginTop: 12, background: '#0d1117', borderRadius: 10, padding: '10px 14px', border: `1.5px solid ${color}30` }}>
            <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color }}>
              📊 {f.career} — Salary Trajectory
            </p>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[{ label: 'Entry', val: f.entry_salary }, { label: '3-Year', val: f.salary_3yr }, { label: '5-Year', val: f.salary_5yr }, { label: '10-Year', val: f.salary_10yr }].map(row => (
                <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 9, color: '#4b5563', fontWeight: 700, textTransform: 'uppercase' }}>{row.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color }}>{formatLPA(row.val)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 9, color: '#4b5563', fontWeight: 700, textTransform: 'uppercase' }}>Growth/yr</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#22c55e' }}>+{(f.annual_growth * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Section wrapper card ─────────────────────────────────────────────────────

function Section({ icon, title, sub, children }: { icon: string; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section style={GD.section}>
      <div style={GD.sectionHeader}>
        <span style={GD.sectionIcon}>{icon}</span>
        <div>
          <h2 style={GD.sectionTitle}>{title}</h2>
          <p style={GD.sectionSub}>{sub}</p>
        </div>
      </div>
      <div style={GD.sectionBody}>{children}</div>
    </section>
  );
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatBar({ data }: { data: OverviewResponse }) {
  const stats = [
    { label: 'Careers Tracked',    value: data.careerDemand.careers.length,   icon: '💼' },
    { label: 'Skills Indexed',      value: data.skillDemand.skills.length,     icon: '🧠' },
    { label: 'Education Paths',     value: data.educationROI.paths.length,     icon: '🎓' },
    { label: 'Industries Analysed', value: data.industryTrends.industries.length, icon: '🏭' },
  ];
  return (
    <div style={GD.statBar}>
      {stats.map(s => (
        <div key={s.label} style={GD.statItem}>
          <span style={GD.statIcon}>{s.icon}</span>
          <span style={GD.statNum}>{s.value}</span>
          <span style={GD.statLabel}>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function GlobalInsightsDashboard() {
  const [data,    setData]    = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    getOverview()
      .then(d  => { setData(d); setLoading(false); })
      .catch(e => { setError(e?.message ?? 'Failed to load dashboard'); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div style={GD.root}>
        <div style={GD.loadWrap}>
          <div style={GD.spinner} />
          <h2 style={GD.loadTitle}>Loading Global Career Intelligence…</h2>
          <p style={GD.loadSub}>Aggregating career demand, skill signals, education ROI, and industry trends</p>
          <div style={GD.loadSteps}>
            {['Career demand index','Skill demand index','Education ROI','Career growth forecast','Industry trends'].map((s, i) => (
              <div key={s} style={GD.loadStep}>
                <div style={GD.loadDot} />
                <span style={GD.loadStepText}>{s}</span>
              </div>
            ))}
          </div>
        </div>
        <style>{ANIM}</style>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={GD.root}>
        <div style={GD.errWrap}>
          <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>⚠️</span>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 700, color: '#f9fafb', margin: '0 0 8px' }}>
            Dashboard Unavailable
          </h2>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            {error ?? 'Could not load intelligence data. Please try again.'}
          </p>
        </div>
      </div>
    );
  }

  const { careerDemand, skillDemand, educationROI, careerGrowth, industryTrends } = data;
  const topCareer = careerDemand.careers[0];
  const topSkill  = skillDemand.skills[0];

  return (
    <div style={GD.root}>
      {/* ── Page header ── */}
      <header style={GD.pageHeader}>
        <div style={GD.headerInner}>
          <div style={GD.headerLeft}>
            <span style={GD.brand}>🌐 HireRise Intelligence</span>
            <span style={GD.sep}>·</span>
            <span style={GD.headerPage}>Global Career Intelligence Dashboard</span>
          </div>
          <div style={GD.headerMeta}>
            <span style={GD.liveTag}>● Live</span>
            <span style={GD.asOf}>Data as of {new Date(careerDemand.generated_at).toLocaleDateString()}</span>
          </div>
        </div>
      </header>

      <main style={GD.main}>
        {/* ── Hero KPI strip ── */}
        <div style={GD.hero}>
          <h1 style={GD.heroTitle}>Global Career Intelligence Dashboard</h1>
          <p style={GD.heroSub}>
            Macro-level career, skill, and education insights aggregated from live market signals,
            career graph data, and student outcomes.
          </p>
          <StatBar data={data} />
        </div>

        {/* ── Top-career + top-skill quick callouts ── */}
        <div style={GD.calloutRow}>
          <div style={{ ...GD.callout, borderColor: '#06b6d440' }}>
            <span style={GD.calloutIcon}>🏆</span>
            <div>
              <p style={GD.calloutLabel}>Highest Demand Career</p>
              <p style={{ ...GD.calloutValue, color: '#06b6d4' }}>{topCareer.career}</p>
              <p style={GD.calloutMeta}>Demand Index {topCareer.demand_index} · +{(topCareer.salary_growth * 100).toFixed(0)}%/yr growth</p>
            </div>
          </div>
          <div style={{ ...GD.callout, borderColor: '#6366f140' }}>
            <span style={GD.calloutIcon}>⚡</span>
            <div>
              <p style={GD.calloutLabel}>Most Demanded Skill</p>
              <p style={{ ...GD.calloutValue, color: '#6366f1' }}>{topSkill.skill}</p>
              <p style={GD.calloutMeta}>Demand {topSkill.demand_index} · +{(topSkill.growth_rate * 100).toFixed(0)}%/yr</p>
            </div>
          </div>
          <div style={{ ...GD.callout, borderColor: '#22c55e40' }}>
            <span style={GD.calloutIcon}>🎓</span>
            <div>
              <p style={GD.calloutLabel}>Best ROI Education Path</p>
              <p style={{ ...GD.calloutValue, color: '#22c55e', fontSize: 16 }}>{educationROI.paths[0].path}</p>
              <p style={GD.calloutMeta}>ROI Score {educationROI.paths[0].roi_score} · {educationROI.paths[0].roi_level} ROI</p>
            </div>
          </div>
        </div>

        {/* ── Section 1: Career Demand Index ── */}
        <Section
          icon="💼"
          title="Top Growing Careers"
          sub="Career Demand Index — composite of job market demand, salary growth trajectory, and automation resilience"
        >
          <CareerDemandChart careers={careerDemand.careers} limit={10} />
        </Section>

        {/* ── Section 2: Skill Demand Index ── */}
        <Section
          icon="🧠"
          title="Global Skill Demand Index"
          sub="Skills ranked by market demand score × growth velocity — click a skill to see industry breakdown"
        >
          <SkillDemandChart skills={skillDemand.skills} limit={12} />
        </Section>

        {/* ── Section 3: Education ROI Rankings ── */}
        <Section
          icon="🎓"
          title="Education ROI Rankings"
          sub="All education paths ranked by return-on-investment score — blended from market data and student outcomes"
        >
          <ROIRankingTable paths={educationROI.paths} />
        </Section>

        {/* ── Section 4: Career Growth Forecast ── */}
        <Section
          icon="📈"
          title="10-Year Career Growth Forecast"
          sub="Projected salary trajectories — click a career in the legend to highlight its growth curve"
        >
          <GrowthLineChart forecasts={careerGrowth.forecasts} />
        </Section>

        {/* ── Section 5: Industry Trend Analysis ── */}
        <Section
          icon="🏭"
          title="Industry Trend Analysis"
          sub="Emerging and contracting sectors — ranked by growth signal score derived from hiring volume and YoY expansion"
        >
          <IndustryTrendChart industries={industryTrends.industries} />
        </Section>

        <p style={GD.footer}>
          HireRise Global Career Intelligence Dashboard · Data aggregated from LMI layer, Skill Evolution Engine,
          Education ROI Engine, and Career Graph · Refresh frequency: hourly
        </p>
      </main>
      <style>{ANIM}</style>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const GD: Record<string, React.CSSProperties> = {
  root:         { minHeight: '100vh', background: '#080c14', fontFamily: "'DM Sans', sans-serif", color: '#f9fafb' },

  pageHeader:   { background: '#0d1117', borderBottom: '1px solid #1f2937', position: 'sticky', top: 0, zIndex: 50 },
  headerInner:  { maxWidth: 1100, margin: '0 auto', padding: '13px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft:   { display: 'flex', alignItems: 'center', gap: 8 },
  brand:        { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: '#f9fafb' },
  sep:          { color: '#374151' },
  headerPage:   { fontSize: 13, color: '#6b7280' },
  headerMeta:   { display: 'flex', alignItems: 'center', gap: 10 },
  liveTag:      { fontSize: 11, fontWeight: 700, color: '#22c55e' },
  asOf:         { fontSize: 11, color: '#374151' },

  main:         { maxWidth: 1100, margin: '0 auto', padding: '32px 28px 72px' },

  hero:         { marginBottom: 28, paddingBottom: 28, borderBottom: '1px solid #1f2937' },
  heroTitle:    { fontFamily: 'Syne, sans-serif', fontSize: 28, fontWeight: 800, color: '#f9fafb', margin: '0 0 10px' },
  heroSub:      { fontSize: 14, color: '#6b7280', margin: '0 0 24px', lineHeight: 1.7, maxWidth: 720 },

  statBar:      { display: 'flex', gap: 0 },
  statItem:     { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '14px 0', borderRight: '1px solid #1f2937', background: '#0d1117', borderRadius: 12 },
  statIcon:     { fontSize: 20 },
  statNum:      { fontFamily: 'Syne, sans-serif', fontSize: 26, fontWeight: 800, color: '#f9fafb' },
  statLabel:    { fontSize: 11, color: '#6b7280' },

  calloutRow:   { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 },
  callout:      { background: '#0d1117', border: '1.5px solid #1f2937', borderRadius: 16, padding: '16px 18px', display: 'flex', alignItems: 'flex-start', gap: 12 },
  calloutIcon:  { fontSize: 26, flexShrink: 0 },
  calloutLabel: { fontSize: 10, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' },
  calloutValue: { fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 800, margin: '0 0 4px' },
  calloutMeta:  { fontSize: 11, color: '#4b5563', margin: 0 },

  section:      { background: '#111827', border: '1.5px solid #1f2937', borderRadius: 20, padding: '24px 26px', marginBottom: 20 },
  sectionHeader:{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18 },
  sectionIcon:  { fontSize: 26, lineHeight: '1', flexShrink: 0 },
  sectionTitle: { fontFamily: 'Syne, sans-serif', fontSize: 17, fontWeight: 700, color: '#f9fafb', margin: '0 0 4px' },
  sectionSub:   { fontSize: 12, color: '#6b7280', margin: 0, lineHeight: 1.5 },
  sectionBody:  {},

  loadWrap:     { maxWidth: 480, margin: '0 auto', padding: '100px 24px', textAlign: 'center' },
  spinner:      { width: 44, height: 44, borderRadius: '50%', border: '3px solid #1f2937', borderTopColor: '#06b6d4', animation: 'spin 0.8s linear infinite', margin: '0 auto 24px' },
  loadTitle:    { fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 700, color: '#f9fafb', margin: '0 0 10px' },
  loadSub:      { fontSize: 13, color: '#6b7280', margin: '0 0 28px', lineHeight: 1.7 },
  loadSteps:    { display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', maxWidth: 280, margin: '0 auto' },
  loadStep:     { display: 'flex', alignItems: 'center', gap: 10 },
  loadDot:      { width: 8, height: 8, borderRadius: '50%', background: '#374151', flexShrink: 0 },
  loadStepText: { fontSize: 12, color: '#4b5563' },

  errWrap:      { maxWidth: 400, margin: '0 auto', padding: '100px 24px', textAlign: 'center' },

  footer:       { fontSize: 11, color: '#374151', textAlign: 'center', marginTop: 32, lineHeight: 1.7 },
};

const ANIM = `@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 720px) {
  .gcid-callout-row { grid-template-columns: 1fr !important; }
  .gcid-stat-bar    { flex-direction: column !important; }
}`;
