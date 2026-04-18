/**
 * src/modules/skill-evolution/pages/SkillRecommendations.tsx
 *
 * Standalone page for the Skill Evolution Engine results.
 * Route: /education/skills/:studentId  (or embedded in the results dashboard)
 *
 * Sections:
 *   1. Hero header — top career + stream
 *   2. Skill Growth Plan — ranked skill cards with impact bars
 *   3. Skill Impact Chart — bar chart + demand/growth scatter
 *   4. Learning Roadmap — step-by-step learning sequence
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/components/AuthProvider';
import {
  getSkillRecommendations,
  type SkillRecommendationsResponse,
} from '../services/skills.api';
import SkillCard       from '../components/SkillCard';
import SkillImpactChart from '../components/SkillImpactChart';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  studentId?: string;
}

// ─── Stream config ────────────────────────────────────────────────────────────

const STREAM_LABEL: Record<string, string> = {
  engineering: 'Computer Science & Engineering',
  medical:     'Medical & Life Sciences',
  commerce:    'Commerce & Finance',
  humanities:  'Humanities & Social Sciences',
};

const STREAM_COLORS: Record<string, { color: string; bg: string }> = {
  engineering: { color: '#06b6d4', bg: 'rgba(6,182,212,0.12)'  },
  medical:     { color: '#22c55e', bg: 'rgba(34,197,94,0.12)'  },
  commerce:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  humanities:  { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)'},
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function SkillRecommendations({ studentId: propStudentId }: Props) {
  const { user } = useAuth();
  const studentId = propStudentId ?? user?.id;

  const [data,    setData]    = useState<SkillRecommendationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    getSkillRecommendations(studentId)
      .then(d => { setData(d); setLoading(false); })
      .catch(err => {
        setError(err?.message ?? 'Could not load skill recommendations.');
        setLoading(false);
      });
  }, [studentId]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={SR.loadWrap}>
        <div style={SR.loadSpinner} />
        <p style={SR.loadText}>Loading skill recommendations…</p>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div style={SR.errorWrap}>
        <span style={SR.errorIcon}>⚡</span>
        <p style={SR.errorTitle}>Skill recommendations not yet generated</p>
        <p style={SR.errorSub}>
          {error ?? 'Run your education analysis to generate personalised skill recommendations.'}
        </p>
      </div>
    );
  }

  const { skills, roadmap, top_career, recommended_stream } = data;
  const streamKey    = recommended_stream ?? 'engineering';
  const streamTheme  = STREAM_COLORS[streamKey] ?? STREAM_COLORS.engineering;

  return (
    <div style={SR.root}>
      {/* ── Hero ── */}
      <div style={SR.hero}>
        <div style={SR.heroBadge}>
          <span style={{ ...SR.streamBadge, color: streamTheme.color, background: streamTheme.bg }}>
            🎯 {STREAM_LABEL[streamKey] ?? streamKey}
          </span>
        </div>
        <h1 style={SR.heroTitle}>Skill Growth Plan</h1>
        {top_career && (
          <p style={SR.heroSub}>
            Optimised for your top predicted career:{' '}
            <strong style={{ color: '#f9fafb' }}>{top_career}</strong>
          </p>
        )}
        <p style={SR.heroMeta}>
          {skills.length} skills ranked by career impact score
        </p>
      </div>

      {/* ── Skill cards ── */}
      <section style={SR.section}>
        <h2 style={SR.sectionTitle}>📚 Recommended Skills</h2>
        <p style={SR.sectionSub}>
          Ranked by impact score — a composite of market demand, career relevance, and your cognitive strengths.
        </p>
        <div style={SR.skillGrid}>
          {skills.map((s, i) => (
            <SkillCard key={s.skill} skill={s} rank={i} animate={true} />
          ))}
        </div>
      </section>

      {/* ── Charts ── */}
      <section style={SR.section}>
        <h2 style={SR.sectionTitle}>📊 Skill Intelligence</h2>
        <p style={SR.sectionSub}>
          Visual breakdown of impact scores, market demand, and growth trajectories.
        </p>
        <SkillImpactChart skills={skills} />
      </section>

      {/* ── Roadmap ── */}
      <section style={SR.section}>
        <h2 style={SR.sectionTitle}>🗺️ Learning Roadmap</h2>
        <p style={SR.sectionSub}>
          The optimal sequence to build these skills — start from the foundation and progress upwards.
        </p>

        <div style={SR.roadmapWrap}>
          {roadmap.map((step, i) => (
            <div key={step.step} style={SR.roadmapStep}>
              {/* Connector line */}
              {i < roadmap.length - 1 && <div style={SR.roadmapLine} />}

              {/* Step node */}
              <div style={SR.stepNode}>
                <div style={SR.stepNodeInner}>
                  <span style={SR.stepNum}>{step.step}</span>
                </div>
              </div>

              {/* Step content */}
              <div style={SR.stepContent}>
                <div style={SR.stepHeader}>
                  <span style={SR.stepSkill}>{step.skill}</span>
                  <span style={SR.stepImpact}>Impact {step.impact}</span>
                </div>
                <p style={SR.stepRationale}>{step.rationale}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Inline compact impact list ── */}
      <section style={SR.section}>
        <h2 style={SR.sectionTitle}>⚡ Quick Reference</h2>
        <p style={SR.sectionSub}>All recommended skills at a glance.</p>
        <div style={SR.quickList}>
          {skills.map((s, i) => (
            <SkillCard key={s.skill} skill={s} rank={i + 1} animate={true} compact={true} />
          ))}
        </div>
      </section>

      <p style={SR.disclaimer}>
        Skills ranked by HireRise Skill Evolution Engine v{data.engine_version ?? '1.0.0'} ·
        Recommendations are tailored to your cognitive profile and live market demand signals.
      </p>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SR: Record<string, React.CSSProperties> = {
  root:          { fontFamily: "'DM Sans', sans-serif", color: '#f9fafb' },

  // Loading
  loadWrap:      { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 0' },
  loadSpinner:   { width: 36, height: 36, borderRadius: '50%', border: '3px solid #1f2937', borderTopColor: '#06b6d4', animation: 'spin 0.8s linear infinite' },
  loadText:      { fontSize: 13, color: '#6b7280', margin: 0 },

  // Error
  errorWrap:     { textAlign: 'center', padding: '48px 24px' },
  errorIcon:     { fontSize: 40, display: 'block', marginBottom: 12 },
  errorTitle:    { fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, color: '#f9fafb', margin: '0 0 8px' },
  errorSub:      { fontSize: 13, color: '#6b7280', margin: 0, lineHeight: 1.6 },

  // Hero
  hero:          { marginBottom: 28 },
  heroBadge:     { marginBottom: 10 },
  streamBadge:   { fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20 },
  heroTitle:     { fontFamily: 'Syne, sans-serif', fontSize: 26, fontWeight: 800, color: '#f9fafb', margin: '0 0 8px' },
  heroSub:       { fontSize: 14, color: '#9ca3af', margin: '0 0 6px', lineHeight: 1.6 },
  heroMeta:      { fontSize: 12, color: '#4b5563', margin: 0 },

  // Sections
  section:       { marginBottom: 28 },
  sectionTitle:  { fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700, color: '#f9fafb', margin: '0 0 6px' },
  sectionSub:    { fontSize: 13, color: '#6b7280', margin: '0 0 16px', lineHeight: 1.6 },
  skillGrid:     { display: 'flex', flexDirection: 'column', gap: 10 },

  // Roadmap
  roadmapWrap:   { display: 'flex', flexDirection: 'column', gap: 0 },
  roadmapStep:   { display: 'flex', gap: 16, alignItems: 'flex-start', position: 'relative' },
  roadmapLine:   { position: 'absolute', left: 19, top: 40, width: 2, height: 'calc(100% + 4px)', background: 'linear-gradient(#06b6d4, #1f2937)', zIndex: 0 },
  stepNode:      { flexShrink: 0, zIndex: 1 },
  stepNodeInner: { width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #06b6d4, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  stepNum:       { fontSize: 14, fontWeight: 800, color: '#fff' },
  stepContent:   { flex: 1, background: '#0d1117', border: '1.5px solid #1f2937', borderRadius: 12, padding: '12px 16px', marginBottom: 8 },
  stepHeader:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  stepSkill:     { fontSize: 15, fontWeight: 700, color: '#f9fafb' },
  stepImpact:    { fontSize: 12, fontWeight: 700, color: '#06b6d4', background: 'rgba(6,182,212,0.1)', padding: '2px 8px', borderRadius: 8 },
  stepRationale: { fontSize: 12, color: '#9ca3af', margin: 0, lineHeight: 1.6 },

  // Quick list
  quickList:     { background: '#111827', border: '1.5px solid #1f2937', borderRadius: 14, padding: '12px 16px' },

  disclaimer:    { fontSize: 11, color: '#374151', marginTop: 8, lineHeight: 1.6, textAlign: 'center' },
};