'use client';

/**
 * components/student/StudentProfileSummary.tsx
 *
 * Issue 6 — Student Profile Summary card shown on the student dashboard
 * after onboarding is complete.
 *
 * Reads the studentCareerProfile from the backend (/student-profile/me)
 * and computes career matches using careerDiscoveryEngine.
 */

import React, { useEffect, useState } from 'react';
import { cn } from '@/utils/cn';
import { topCareerMatches, academicAverages, markLabel, type CareerMatch } from '@/lib/careerDiscoveryEngine';
import type { AcademicMarks, InterestArea, LearningStyle } from '@/services/studentOnboardingService';
import { apiFetch } from '@/services/apiClient';

// ── Types ─────────────────────────────────────────────────────────────────────

interface StudentCareerProfile {
  interests?:          string[];
  strengths?:          Record<string, number>;
  learning_styles?:    string[];
  career_curiosities?: string[];
  academic_marks?:     AcademicMarks | null;
}

// ── Small UI atoms ────────────────────────────────────────────────────────────

function Pill({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize"
      style={{ background: `${color}1a`, color }}
    >
      {children}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.35)' }}>
      {children}
    </p>
  );
}

// ── Career match bar ──────────────────────────────────────────────────────────

function MatchBar({ match }: { match: CareerMatch }) {
  const color = match.score >= 80 ? '#a78bfa' : match.score >= 65 ? '#3d65f6' : '#64748b';
  return (
    <div className="flex items-center gap-3">
      <span className="text-base shrink-0">{match.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-xs font-semibold text-white/75 truncate">{match.title}</p>
          <p className="text-xs font-bold ml-2 shrink-0" style={{ color }}>{match.score}%</p>
        </div>
        <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${match.score}%`, background: color }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Academic strength row ─────────────────────────────────────────────────────

function AcademicRow({ label, avg }: { label: string; avg: number }) {
  const lbl   = markLabel(avg);
  const color = lbl === 'Excellent' ? '#4ade80' : lbl === 'Strong' ? '#a78bfa' : lbl === 'Average' ? '#fbbf24' : '#f87171';
  return (
    <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
      <p className="text-xs text-white/55">{label}</p>
      <Pill color={color}>{lbl}</Pill>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function StudentProfileSummary() {
  const [profile, setProfile] = useState<StudentCareerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ profile: StudentCareerProfile | null }>('/onboarding/profile')
      .then(res => setProfile(res.profile))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl p-5 animate-pulse" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="h-4 w-32 rounded-lg mb-3" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-3 w-full rounded" style={{ background: 'rgba(255,255,255,0.05)' }} />)}
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const safeProfile = {
    interests:          (profile.interests          ?? []) as InterestArea[],
    strengths:          { problem_solving: 3, creativity: 3, communication: 3, mathematics: 3, leadership: 3, ...(profile.strengths ?? {}) },
    learning_styles:    (profile.learning_styles    ?? []) as LearningStyle[],
    career_curiosities: profile.career_curiosities ?? [],
    academic_marks:     profile.academic_marks     ?? null,
  };

  const topMatches = topCareerMatches(safeProfile, 5);
  const avgs       = academicAverages(safeProfile.academic_marks);
  const hasAcademic = safeProfile.academic_marks !== null;

  const interestLabels: Record<string, string> = {
    technology: 'Technology', business: 'Business', design: 'Design',
    science: 'Science', healthcare: 'Healthcare', law: 'Law', arts: 'Arts',
  };
  const learningLabels: Record<string, string> = {
    hands_on: 'Hands-on', research: 'Research', team_collaboration: 'Team', independent: 'Independent',
  };
  const strengthLabels: Record<string, string> = {
    problem_solving: 'Problem Solving', creativity: 'Creativity',
    communication: 'Communication', mathematics: 'Mathematics', leadership: 'Leadership',
  };
  const topStrengths = Object.entries(safeProfile.strengths)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([k]) => strengthLabels[k] ?? k);

  const cardStyle = {
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(255,255,255,0.07)',
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* ── Profile card ──────────────────────────────────────────────── */}
      <div className="rounded-2xl p-5 space-y-4" style={cardStyle}>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(167,139,250,0.15)' }}>
            <span className="text-sm">🎓</span>
          </div>
          <h3 className="text-sm font-black text-white">Student Profile</h3>
        </div>

        <div>
          <SectionTitle>Interests</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {safeProfile.interests.length > 0
              ? safeProfile.interests.map(i => <Pill key={i} color="#a78bfa">{interestLabels[i] ?? i}</Pill>)
              : <p className="text-xs text-white/30">Not set</p>
            }
          </div>
        </div>

        <div>
          <SectionTitle>Top Strengths</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {topStrengths.map(s => <Pill key={s} color="#3d65f6">{s}</Pill>)}
          </div>
        </div>

        <div>
          <SectionTitle>Learning Style</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {safeProfile.learning_styles.length > 0
              ? safeProfile.learning_styles.map(l => <Pill key={l} color="#06b6d4">{learningLabels[l] ?? l}</Pill>)
              : <p className="text-xs text-white/30">Not set</p>
            }
          </div>
        </div>
      </div>

      {/* ── Academic strengths card ───────────────────────────────────── */}
      <div className="rounded-2xl p-5" style={cardStyle}>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(251,191,36,0.15)' }}>
            <span className="text-sm">📊</span>
          </div>
          <h3 className="text-sm font-black text-white">Academic Strengths</h3>
        </div>

        {hasAcademic ? (
          <div>
            <AcademicRow label="Mathematics"    avg={avgs.mathematics}    />
            <AcademicRow label="Science"        avg={avgs.science}        />
            <AcademicRow label="Language"       avg={avgs.language}       />
            <AcademicRow label="Social Studies" avg={avgs.social_studies} />
            <AcademicRow label="Computer / IT"  avg={avgs.computer}       />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <span className="text-2xl mb-2">📝</span>
            <p className="text-xs text-white/35">Complete your assessment to see academic strengths</p>
          </div>
        )}
      </div>

      {/* ── Career matches card ───────────────────────────────────────── */}
      <div className="rounded-2xl p-5" style={cardStyle}>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(74,222,128,0.15)' }}>
            <span className="text-sm">🎯</span>
          </div>
          <h3 className="text-sm font-black text-white">Top Career Matches</h3>
        </div>
        <div className="space-y-3">
          {topMatches.map(m => <MatchBar key={m.id} match={m} />)}
        </div>
      </div>
    </div>
  );
}