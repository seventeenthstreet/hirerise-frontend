/**
 * src/modules/skill-evolution/components/SkillGrowthPlanCard.tsx
 *
 * Dashboard card ⑨ — "Skill Growth Plan"
 * Embedded directly in ResultsDashboard.tsx after the Market Insights card.
 *
 * Displays:
 *   - Top career + stream header
 *   - Animated horizontal impact bars (terminal-block style)
 *   - Step-by-step learning roadmap
 *   - Toggle to full SkillImpactChart (demand vs growth scatter)
 *
 * Props:
 *   studentId — used to fetch recommendations on mount
 *   topCareer — optional pre-fill from careerResult (avoids re-fetch race)
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getSkillRecommendations,
  type SkillRecommendation,
  type RoadmapStep,
  type SkillRecommendationsResponse,
} from '../services/skills.api';
import SkillImpactChart from './SkillImpactChart';

// ─── Config ───────────────────────────────────────────────────────────────────

const IMPACT_COLORS = [
  '#06b6d4', '#6366f1', '#22c55e', '#f59e0b', '#a78bfa',
  '#f43f5e', '#10b981', '#8b5cf6',
];

const STREAM_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  engineering: { label: 'Computer Science & Engineering', color: '#06b6d4', bg: 'rgba(6,182,212,0.10)',   icon: '💻' },
  medical:     { label: 'Medical & Life Sciences',        color: '#22c55e', bg: 'rgba(34,197,94,0.10)',   icon: '🏥' },
  commerce:    { label: 'Commerce & Finance',             color: '#f59e0b', bg: 'rgba(245,158,11,0.10)',  icon: '📈' },
  humanities:  { label: 'Humanities & Social Sciences',   color: '#a78bfa', bg: 'rgba(167,139,250,0.10)', icon: '📚' },
};

// ─── Animated Impact Bar ──────────────────────────────────────────────────────

function ImpactBar({
  skill,
  impact,
  color,
  delay,
}: {
  skill:  string;
  impact: number;
  color:  string;
  delay:  number;
}) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setWidth(impact), delay);
    return () => clearTimeout(t);
  }, [impact, delay]);

  // Build terminal-style block string
  const filled  = Math.round((impact / 100) * 10);
  const empty   = 10 - filled;
  const blocks  = '█'.repeat(filled) + '░'.repeat(empty);

  return (
    <div style={SG.barRow}>
      <span style={SG.barLabel}>{skill}</span>
      <span style={{ ...SG.barBlocks, color }}>{blocks}</span>
      <span style={{ ...SG.barScore, color }}>{impact}</span>
    </div>
  );
}

// ─── Roadmap Steps ────────────────────────────────────────────────────────────

function RoadmapList({ steps }: { steps: RoadmapStep[] }) {
  return (
    <div style={SG.roadmapWrap}>
      {steps.map((step, i) => (
        <div key={step.step} style={SG.roadmapRow}>
          <div style={SG.roadmapConnector}>
            <div style={SG.roadmapDot} />
            {i < steps.length - 1 && <div style={SG.roadmapLine} />}
          </div>
          <div style={SG.roadmapContent}>
            <div style={SG.roadmapHeader}>
              <span style={SG.roadmapStep}>Step {step.step}</span>
              <span style={SG.roadmapSkill}>{step.skill}</span>
              <span style={SG.roadmapImpact}>⚡ {step.impact}</span>
            </div>
            <p style={SG.roadmapRationale}>{step.rationale}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  studentId: string;
  topCareer?: string;
}

export default function SkillGrowthPlanCard({ studentId, topCareer }: Props) {
  const [data,       setData]       = useState<SkillRecommendationsResponse | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(false);
  const [showChart,  setShowChart]  = useState(false);
  const [tab,        setTab]        = useState<'skills' | 'roadmap'>('skills');

  useEffect(() => {
    if (!studentId) return;
    getSkillRecommendations(studentId)
      .then(d  => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [studentId]);

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={SG.card}>
        <div style={SG.headerRow}>
          <span style={SG.headerIcon}>🌱</span>
          <div>
            <p style={SG.heading}>Skill Growth Plan</p>
            <p style={SG.sub}>Loading recommendations…</p>
          </div>
        </div>
        <div style={SG.skeletonWrap}>
          {[90, 76, 60, 44, 30].map((w, i) => (
            <div key={i} style={{ ...SG.skeleton, width: `${w}%` }} />
          ))}
        </div>
      </div>
    );
  }

  // ── Error / empty state ──────────────────────────────────────────────────
  if (error || !data || !data.skills?.length) {
    return (
      <div style={SG.card}>
        <div style={SG.headerRow}>
          <span style={SG.headerIcon}>🌱</span>
          <div>
            <p style={SG.heading}>Skill Growth Plan</p>
            <p style={SG.sub}>
              {error
                ? 'Could not load skill recommendations. Re-run your analysis to generate them.'
                : 'Skill recommendations will appear here after your analysis completes.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { skills, roadmap, recommended_stream, engine_version } = data;
  const career      = data.top_career ?? topCareer ?? 'Your Top Career';
  const streamKey   = recommended_stream ?? 'engineering';
  const theme       = STREAM_CONFIG[streamKey] ?? STREAM_CONFIG.engineering;

  return (
    <div style={SG.card}>
      {/* ── Card header ── */}
      <div style={SG.headerRow}>
        <span style={SG.headerIcon}>🌱</span>
        <div style={{ flex: 1 }}>
          <p style={SG.heading}>Skill Growth Plan</p>
          <p style={SG.sub}>
            Personalised skill roadmap based on your cognitive profile and live market demand
          </p>
        </div>
        <button
          style={{
            ...SG.chartToggle,
            ...(showChart ? SG.chartToggleActive : {}),
          }}
          onClick={() => setShowChart(v => !v)}
        >
          {showChart ? '📋 List' : '📊 Chart'}
        </button>
      </div>

      {/* ── Career + stream badge ── */}
      <div style={SG.metaRow}>
        <span style={{ ...SG.careerPill, color: theme.color, background: theme.bg }}>
          {theme.icon} Top Career: {career}
        </span>
        <span style={{ ...SG.streamPill }}>
          {theme.label}
        </span>
      </div>

      {/* ── Chart view ── */}
      {showChart && (
        <div style={{ marginBottom: 20 }}>
          <SkillImpactChart skills={skills} />
        </div>
      )}

      {/* ── Tab bar ── */}
      <div style={SG.tabBar}>
        {(['skills', 'roadmap'] as const).map(t => (
          <button
            key={t}
            style={{ ...SG.tabBtn, ...(tab === t ? SG.tabBtnActive : {}) }}
            onClick={() => setTab(t)}
          >
            {t === 'skills' ? `📚 Skills (${skills.length})` : '🗺️ Roadmap'}
          </button>
        ))}
      </div>

      {/* ── Skills tab ── */}
      {tab === 'skills' && (
        <div style={SG.skillsWrap}>
          {skills.map((s, i) => (
            <ImpactBar
              key={s.skill}
              skill={s.skill}
              impact={s.impact}
              color={IMPACT_COLORS[i % IMPACT_COLORS.length]}
              delay={100 + i * 70}
            />
          ))}
        </div>
      )}

      {/* ── Roadmap tab ── */}
      {tab === 'roadmap' && roadmap?.length > 0 && (
        <RoadmapList steps={roadmap} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <p style={SG.footer}>
          Skill Evolution Engine v{engine_version ?? '1.0.0'} ·
          Impact scores combine market demand, career relevance, and cognitive fit
        </p>
        <Link
          href={`/education/skills/${studentId}`}
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#06b6d4',
            textDecoration: 'none',
            flexShrink: 0,
            marginLeft: 12,
          }}
        >
          View Full Plan →
        </Link>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SG: Record<string, React.CSSProperties> = {
  card:            { background: '#111827', border: '1.5px solid #1f2937', borderRadius: 20, padding: '28px 28px 20px', marginTop: 20 },

  headerRow:       { display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  headerIcon:      { fontSize: 28, lineHeight: '1', flexShrink: 0 },
  heading:         { fontFamily: 'Syne, sans-serif', fontSize: 17, fontWeight: 700, color: '#f9fafb', margin: '0 0 4px' },
  sub:             { fontSize: 13, color: '#6b7280', margin: 0, lineHeight: 1.5 },

  chartToggle:     { fontSize: 11, fontWeight: 600, color: '#6b7280', background: 'transparent', border: '1.5px solid #1f2937', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s' },
  chartToggleActive:{ color: '#06b6d4', borderColor: '#06b6d4', background: 'rgba(6,182,212,0.08)' },

  metaRow:         { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' },
  careerPill:      { fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20 },
  streamPill:      { fontSize: 11, color: '#6b7280', padding: '4px 10px', background: '#1f2937', borderRadius: 20 },

  tabBar:          { display: 'flex', gap: 6, marginBottom: 16 },
  tabBtn:          { fontSize: 12, fontWeight: 600, color: '#6b7280', background: 'transparent', border: '1.5px solid #1f2937', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', transition: 'all 0.2s' },
  tabBtnActive:    { color: '#f9fafb', borderColor: '#374151', background: '#1f2937' },

  // Terminal-style bars
  skillsWrap:      { display: 'flex', flexDirection: 'column', gap: 6, background: '#0d1117', border: '1px solid #1f2937', borderRadius: 12, padding: '16px 18px', fontFamily: "'Fira Code', 'Courier New', monospace", marginBottom: 16 },
  barRow:          { display: 'flex', alignItems: 'center', gap: 10 },
  barLabel:        { fontSize: 12, color: '#9ca3af', flex: '0 0 150px', textAlign: 'right', fontFamily: "'DM Sans', sans-serif" },
  barBlocks:       { fontSize: 13, letterSpacing: '1px', flex: 1 },
  barScore:        { fontSize: 13, fontWeight: 800, flex: '0 0 30px', textAlign: 'right' },

  // Roadmap
  roadmapWrap:     { display: 'flex', flexDirection: 'column', marginBottom: 16 },
  roadmapRow:      { display: 'flex', gap: 14 },
  roadmapConnector:{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 },
  roadmapDot:      { width: 12, height: 12, borderRadius: '50%', background: 'linear-gradient(135deg, #06b6d4, #6366f1)', margin: '14px 0 0', flexShrink: 0 },
  roadmapLine:     { width: 2, flex: 1, background: 'linear-gradient(#374151, #1f2937)', margin: '4px 0' },
  roadmapContent:  { flex: 1, background: '#0d1117', border: '1.5px solid #1f2937', borderRadius: 12, padding: '12px 16px', marginBottom: 8 },
  roadmapHeader:   { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  roadmapStep:     { fontSize: 10, color: '#4b5563', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' },
  roadmapSkill:    { fontSize: 14, fontWeight: 700, color: '#f9fafb', flex: 1 },
  roadmapImpact:   { fontSize: 11, fontWeight: 700, color: '#06b6d4', background: 'rgba(6,182,212,0.1)', padding: '2px 8px', borderRadius: 8 },
  roadmapRationale:{ fontSize: 12, color: '#9ca3af', margin: 0, lineHeight: 1.6 },

  // Skeleton
  skeletonWrap:    { display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' },
  skeleton:        { height: 12, background: '#1f2937', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' },

  footer:          { fontSize: 11, color: '#374151', textAlign: 'center', marginTop: 4, lineHeight: 1.6 },
};
