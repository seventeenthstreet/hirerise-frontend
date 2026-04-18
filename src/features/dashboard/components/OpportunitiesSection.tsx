'use client';

/**
 * src/features/dashboard/components/OpportunitiesSection.tsx
 *
 * Student-facing "Opportunities" widget shown on the main dashboard.
 *
 * Shows:
 *   - Top 3 matched university programs
 *   - Top 3 matched job opportunities
 *
 * Each card links to a detail view.
 * Match scores are displayed to help students understand fit.
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/components/AuthProvider';
import {
  opportunitiesService,
  type StudentOpportunities,
  type UniversityOpportunity,
  type JobOpportunity,
} from '@/services/opportunitiesService';

// ─── Sub-components ───────────────────────────────────────────────────────────

function MatchScore({ score }: { score: number }) {
  const color = score >= 70 ? '#22c55e' : score >= 45 ? '#f59e0b' : '#94a3b8';
  return (
    <div style={{ ...S.scoreWrap, background: color + '15', border: `1px solid ${color}30` }}>
      <div style={{ ...S.scoreNum, color }}>{score}</div>
      <div style={S.scoreLabel}>match</div>
    </div>
  );
}

function UniCard({ u }: { u: UniversityOpportunity }) {
  return (
    <div style={S.card}>
      <div style={S.cardLeft}>
        <div style={S.cardIcon}>🎓</div>
        <div>
          <div style={S.cardTitle}>{u.program}</div>
          <div style={S.cardSub}>{u.university}</div>
          <div style={S.cardMeta}>
            {u.degree_type && <span style={S.metaTag}>{u.degree_type}</span>}
            {u.duration_years && <span style={S.metaTag}>{u.duration_years}y</span>}
            {u.country && <span style={S.metaTag}>{u.country}</span>}
            {u.tuition_cost > 0 && (
              <span style={S.metaTag}>${u.tuition_cost.toLocaleString()}/yr</span>
            )}
          </div>
        </div>
      </div>
      <MatchScore score={u.match_score} />
    </div>
  );
}

function JobCard({ j }: { j: JobOpportunity }) {
  return (
    <div style={S.card}>
      <div style={S.cardLeft}>
        <div style={S.cardIcon}>💼</div>
        <div>
          <div style={S.cardTitle}>{j.role}</div>
          <div style={S.cardSub}>{j.company}</div>
          <div style={S.cardMeta}>
            {j.industry && <span style={S.metaTag}>{j.industry}</span>}
            {j.salary_range?.min > 0 && (
              <span style={{ ...S.metaTag, color: '#a3e635' }}>
                {j.salary_range.currency} {j.salary_range.min.toLocaleString()}–{j.salary_range.max.toLocaleString()}
              </span>
            )}
            {j.required_skills?.slice(0, 2).map(sk => (
              <span key={sk} style={S.skillTag}>{sk}</span>
            ))}
          </div>
        </div>
      </div>
      <MatchScore score={j.match_score} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  studentId?: string;
}

export default function OpportunitiesSection({ studentId }: Props) {
  const { user }    = useAuth();
  const uid         = studentId ?? user?.id;

  const [data,    setData]    = useState<StudentOpportunities | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [tab,     setTab]     = useState<'universities' | 'jobs'>('universities');

  useEffect(() => {
    if (!uid) return;
    opportunitiesService.getOpportunities(uid)
      .then(res => setData(res))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [uid]);

  if (loading) {
    return (
      <div style={S.root}>
        <div style={S.header}>
          <div style={S.titleRow}>
            <span style={S.sparkle}>✨</span>
            <span style={S.title}>Opportunities</span>
          </div>
        </div>
        <div style={S.loadingRow}>
          <div style={S.shimmer} />
          <div style={S.shimmer} />
          <div style={S.shimmer} />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={S.root}>
        <div style={S.header}>
          <div style={S.titleRow}>
            <span style={S.sparkle}>✨</span>
            <span style={S.title}>Opportunities</span>
          </div>
        </div>
        <div style={S.errorMsg}>
          {error ?? 'Complete your profile to unlock personalised opportunities.'}
        </div>
      </div>
    );
  }

  const universities = data.universities.slice(0, 3);
  const jobs         = data.jobs.slice(0, 3);

  return (
    <div style={S.root}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.titleRow}>
          <span style={S.sparkle}>✨</span>
          <span style={S.title}>Opportunities For You</span>
          <span style={S.subtitle}>AI-matched to your profile</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        <button
          style={{ ...S.tab, ...(tab === 'universities' ? S.tabActive : {}) }}
          onClick={() => setTab('universities')}
        >
          🎓 Universities
          <span style={S.tabCount}>{universities.length}</span>
        </button>
        <button
          style={{ ...S.tab, ...(tab === 'jobs' ? S.tabActive : {}) }}
          onClick={() => setTab('jobs')}
        >
          💼 Jobs
          <span style={S.tabCount}>{jobs.length}</span>
        </button>
      </div>

      {/* Cards */}
      <div style={S.cardList}>
        {tab === 'universities' ? (
          universities.length > 0 ? (
            universities.map((u, i) => <UniCard key={i} u={u} />)
          ) : (
            <div style={S.empty}>No university matches yet. Complete your academic profile.</div>
          )
        ) : (
          jobs.length > 0 ? (
            jobs.map((j, i) => <JobCard key={i} j={j} />)
          ) : (
            <div style={S.empty}>No job matches yet. Add your skills to your profile.</div>
          )
        )}
      </div>

      {/* Footer CTA */}
      <div style={S.footer}>
        <span style={S.footerText}>
          Powered by your stream, career predictions & cognitive profile
        </span>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  root:        { background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  titleRow:    { display: 'flex', alignItems: 'center', gap: 8 },
  sparkle:     { fontSize: 18 },
  title:       { fontSize: 16, fontWeight: 700, color: '#f1f5f9' },
  subtitle:    { fontSize: 12, color: '#475569', marginLeft: 4 },
  tabs:        { display: 'flex', gap: 8 },
  tab:         { flex: 1, padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#64748b', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  tabActive:   { background: '#1d4ed820', border: '1px solid #3b82f6', color: '#60a5fa' },
  tabCount:    { background: '#334155', borderRadius: 10, padding: '0px 6px', fontSize: 11, color: '#94a3b8' },
  cardList:    { display: 'flex', flexDirection: 'column', gap: 10 },
  card:        { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: '12px 14px', gap: 12, transition: 'border-color 0.15s' },
  cardLeft:    { display: 'flex', gap: 10, alignItems: 'flex-start', flex: 1 },
  cardIcon:    { fontSize: 20, flexShrink: 0, marginTop: 1 },
  cardTitle:   { fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 2 },
  cardSub:     { fontSize: 12, color: '#64748b', marginBottom: 6 },
  cardMeta:    { display: 'flex', flexWrap: 'wrap', gap: 4 },
  metaTag:     { padding: '2px 6px', background: '#1e293b', border: '1px solid #334155', borderRadius: 4, fontSize: 11, color: '#94a3b8' },
  skillTag:    { padding: '2px 6px', background: '#1e3a5f20', border: '1px solid #1d4ed830', borderRadius: 4, fontSize: 11, color: '#93c5fd' },
  scoreWrap:   { display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: 8, padding: '6px 10px', flexShrink: 0 },
  scoreNum:    { fontSize: 17, fontWeight: 700, lineHeight: 1 },
  scoreLabel:  { fontSize: 9, color: '#475569', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' },
  empty:       { color: '#475569', fontSize: 13, padding: '12px 0', textAlign: 'center' },
  footer:      { borderTop: '1px solid #1e293b', paddingTop: 10 },
  footerText:  { fontSize: 11, color: '#334155' },
  errorMsg:    { color: '#64748b', fontSize: 13, padding: '8px 0' },
  loadingRow:  { display: 'flex', flexDirection: 'column', gap: 8 },
  shimmer:     { height: 64, background: 'linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%)', borderRadius: 8, backgroundSize: '200% 100%' },
};