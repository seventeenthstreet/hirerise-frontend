'use client';

/**
 * app/student-dashboard/page.tsx
 * Enhanced — Sections 1–6: Career match cards, Explainable AI, Match factor
 * breakdown, Interactive cards, Career Radar Map, Dashboard layout improvement.
 */

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useAuth } from '@/features/auth/components/AuthProvider';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  topCareerMatches, computeCHI, buildCareerReport,
  type CareerMatch, type CareerHealthIndex, type CareerIntelligenceReport,
} from '@/lib/careerDiscoveryEngine';
import { apiFetch } from '@/services/apiClient';
import type { InterestArea, LearningStyle, StrengthRatings } from '@/services/studentOnboardingService';

// ─── Rank badge helpers ───────────────────────────────────────────────────────

const RANK_SYMBOLS = ['①', '②', '③', '④', '⑤'];

function rankSymbol(i: number) {
  return RANK_SYMBOLS[i] ?? `${i + 1}.`;
}

// ─── Module definitions ───────────────────────────────────────────────────────

interface StudentModule {
  id: string; icon: string; label: string; tag: string;
  description: string; href: string; accentColor: string; accentBg: string;
  recommended?: boolean; comingSoon?: boolean;
}

const STUDENT_MODULES: StudentModule[] = [
  {
    id: 'career-discovery', icon: '🔍', label: 'Career Discovery Engine', tag: 'AI Matching',
    description: 'Discover careers aligned to your interests, strengths, and personality type — powered by live market data.',
    href: '/intelligence', accentColor: '#a78bfa', accentBg: 'rgba(167,139,250,0.10)', recommended: true,
  },
  {
    id: 'strength-assessment', icon: '🧠', label: 'AI Career Assessment', tag: 'Self Discovery',
    description: 'Answer guided questions to map your natural strengths and learning style to the best-fit career clusters.',
    href: '/advisor', accentColor: '#f472b6', accentBg: 'rgba(244,114,182,0.10)',
  },
  {
    id: 'future-paths', icon: '🗺️', label: 'Future Career Paths', tag: 'Path Explorer',
    description: 'Simulate 5, 10, and 20-year trajectories across multiple careers and compare where each path leads.',
    href: '/career-simulator', accentColor: '#06b6d4', accentBg: 'rgba(6,182,212,0.10)',
  },
  {
    id: 'education-planner', icon: '📚', label: 'Education Planner', tag: 'Academic Roadmap',
    description: 'Plan the degrees, diplomas, and certifications that will open doors to your target career.',
    href: '/education/skills/me', accentColor: '#fbbf24', accentBg: 'rgba(251,191,36,0.10)',
  },
  {
    id: 'salary-explorer', icon: '💰', label: 'Salary Explorer', tag: 'Market Data',
    description: 'Compare salaries by role, industry, location, and education level before committing to a path.',
    href: '/analytics', accentColor: '#4ade80', accentBg: 'rgba(74,222,128,0.10)',
  },
  {
    id: 'ai-advisor', icon: '🤖', label: 'AI Career Advisor', tag: 'Personal AI',
    description: 'Chat with your AI advisor for personalised guidance on study choices, career changes, and next steps.',
    href: '/advisor', accentColor: '#3d65f6', accentBg: 'rgba(61,101,246,0.10)',
  },
];

// ─── Module card ──────────────────────────────────────────────────────────────

function StudentModuleCard({ mod }: { mod: StudentModule }) {
  const cardStyle: React.CSSProperties = {
    background: 'rgba(15, 21, 37, 0.95)',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.28)',
  };
  const inner = (
    <div className="relative flex flex-1 flex-col gap-4 p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl shrink-0"
          style={{ background: mod.accentBg, border: `1px solid ${mod.accentColor}22` }}>
          {mod.icon}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
            style={{ color: mod.accentColor, background: mod.accentBg }}>
            {mod.comingSoon ? 'Coming Soon' : mod.tag}
          </span>
          {mod.recommended && (
            <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
              style={{ color: '#a78bfa', background: 'rgba(167,139,250,0.10)' }}>Start here</span>
          )}
        </div>
      </div>
      <div className="flex-1">
        <h2 className="text-base font-black text-white/85 group-hover:text-white transition-colors leading-tight">{mod.label}</h2>
        <p className="mt-2 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.42)' }}>{mod.description}</p>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold transition-colors group-hover:opacity-100"
          style={{ color: mod.accentColor, opacity: 0.7 }}>
          {mod.comingSoon ? 'Coming soon' : 'Open module →'}
        </span>
        {!mod.comingSoon && (
          <svg className="h-4 w-4 translate-x-0 opacity-0 transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-100"
            fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: mod.accentColor }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        )}
      </div>
    </div>
  );
  if (mod.comingSoon) {
    return <div className="relative flex flex-col overflow-hidden rounded-2xl opacity-45 cursor-not-allowed" style={cardStyle}>{inner}</div>;
  }
  return (
    <Link href={mod.href}
      className="group relative flex flex-col overflow-hidden rounded-2xl transition-all duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hr-500"
      style={cardStyle}>
      <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `radial-gradient(circle at top left, ${mod.accentBg}, transparent 70%)` }} />
      <div className="h-0.5 w-full opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: mod.accentColor }} />
      {inner}
    </Link>
  );
}

// ─── Welcome banner ───────────────────────────────────────────────────────────

function StudentWelcomeBanner({ firstName, isNew }: { firstName: string; isNew: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-7"
      style={{ background: 'linear-gradient(135deg, #0c1120 0%, #110c20 55%, #0e1020 100%)', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}>
      <div className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(167,139,250,0.9) 1px, transparent 0)', backgroundSize: '28px 28px' }} />
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.18) 0%, transparent 70%)' }} />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: '#a78bfa' }} />
          <p className="label-v3">Student Career Intelligence</p>
        </div>
        <h1 className="text-2xl font-black text-white lg:text-3xl">
          {isNew ? `Welcome, ${firstName} 👋` : `Welcome back, ${firstName} 👋`}
        </h1>
        <p className="mt-2 text-sm max-w-xl" style={{ color: 'rgba(255,255,255,0.45)' }}>
          {isNew
            ? 'Start with Career Discovery to get AI-powered career matches based on your strengths. It takes less than 5 minutes.'
            : 'Continue exploring careers, planning your education, and mapping your future.'}
        </p>
      </div>
    </div>
  );
}

// ─── Career Health Index card ─────────────────────────────────────────────────

function CHICard({ chi }: { chi: CareerHealthIndex }) {
  const color = chi.score >= 80 ? '#4ade80' : chi.score >= 65 ? '#a78bfa' : chi.score >= 50 ? '#fbbf24' : '#f87171';
  const circumference = 2 * Math.PI * 40;
  const dashOffset = circumference - (chi.score / 100) * circumference;

  return (
    <div className="rounded-2xl p-5 flex flex-col items-center text-center h-full"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-3"
        style={{ color: 'rgba(255,255,255,0.32)' }}>
        Career Health Index
      </p>
      <div className="relative mb-3">
        <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="8"
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset}
            style={{
              transition: 'stroke-dashoffset 1s ease',
              filter: `drop-shadow(0 0 6px ${color}88)`,
            }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black" style={{ color }}>{chi.score}</span>
          <span className="text-[10px] text-white/40">/ 100</span>
        </div>
      </div>
      <p className="text-sm font-bold mb-1" style={{ color }}>{chi.label}</p>
      <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{chi.tagline}</p>
      <div className="mt-4 w-full space-y-1.5">
        {Object.entries(chi.breakdown).map(([key, val]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="w-16 text-left text-[9px] capitalize" style={{ color: 'rgba(255,255,255,0.35)' }}>{key}</span>
            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${val}%`, background: color }} />
            </div>
            <span className="text-[9px] w-6 text-right" style={{ color: 'rgba(255,255,255,0.35)' }}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Career Intelligence Report card ─────────────────────────────────────────

function CareerReportCard({ report }: { report: CareerIntelligenceReport }) {
  const clusterColors: Record<string, string> = {
    'Technology & Data':          '#a78bfa',
    'Business & Management':      '#3d65f6',
    'Health & Life Sciences':     '#4ade80',
    'Design & Creative':          '#f472b6',
    'Law & Social Sciences':      '#fbbf24',
    'Education & Social Sciences':'#06b6d4',
  };
  const clusterColor = clusterColors[report.primaryCluster] ?? '#a78bfa';

  return (
    <div className="rounded-2xl p-5 h-full"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-4"
        style={{ color: 'rgba(255,255,255,0.32)' }}>
        Your Career Intelligence Profile
      </p>
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-xl p-3" style={{ background: `${clusterColor}12`, border: `1px solid ${clusterColor}25` }}>
          <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Primary Career Cluster</p>
          <p className="text-sm font-black" style={{ color: clusterColor }}>{report.primaryCluster}</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.18)' }}>
          <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Compatibility Score</p>
          <p className="text-2xl font-black" style={{ color: '#4ade80' }}>{report.compatibilityScore}%</p>
        </div>
      </div>
      <div>
        <p className="text-xs font-bold mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>Top Recommended Careers</p>
        <div className="space-y-2">
          {report.topCareers.map(c => (
            <div key={c.rank} className="flex items-center gap-3 rounded-lg px-3 py-2.5"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black"
                style={{ background: clusterColor + '20', color: clusterColor }}>{c.rank}</span>
              <span className="text-base shrink-0">{c.emoji}</span>
              <span className="text-sm font-semibold text-white/75">{c.title}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── SECTION 3 — Match Factor Breakdown ──────────────────────────────────────

interface MatchFactors {
  interestFit:  number;
  strengthFit:  number;
  academicFit:  number;
  learningFit:  number;
  curiosityFit: number;
}

function MatchFactorBreakdown({ factors }: { factors: MatchFactors }) {
  const bars = [
    { label: 'Interest Fit',    value: factors.interestFit,  color: '#a78bfa' },
    { label: 'Strength Fit',    value: factors.strengthFit,  color: '#7C6CFF' },
    { label: 'Academic Fit',    value: factors.academicFit,  color: '#60a5fa' },
    { label: 'Learning Style',  value: factors.learningFit,  color: '#34d399' },
    { label: 'Curiosity Match', value: factors.curiosityFit, color: '#f472b6' },
  ];
  return (
    <div className="mt-3 space-y-2 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-[9px] font-bold uppercase tracking-[0.15em] mb-2"
        style={{ color: 'rgba(255,255,255,0.28)' }}>
        Match Factor Breakdown
      </p>
      {bars.map(b => (
        <div key={b.label} className="flex items-center gap-2">
          <span className="text-[9px] shrink-0 w-[88px]" style={{ color: 'rgba(255,255,255,0.40)' }}>{b.label}</span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div
              style={{
                width: `${b.value}%`,
                height: '100%',
                borderRadius: '9999px',
                background: `linear-gradient(90deg, ${b.color}cc, ${b.color})`,
                boxShadow: `0 0 6px ${b.color}55`,
                transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
              }}
            />
          </div>
          <span className="text-[9px] w-7 text-right font-bold" style={{ color: b.color }}>{b.value}%</span>
        </div>
      ))}
    </div>
  );
}

// ─── SECTIONS 1, 2, 4 — Enhanced Career Match Card ───────────────────────────

function CareerMatchCard({
  match, rank, factors,
}: {
  match: CareerMatch;
  rank: number;
  factors: MatchFactors;
}) {
  const [expanded, setExpanded] = useState(false);
  const [hovered,  setHovered]  = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const accentColor = match.score >= 80 ? '#a78bfa' : match.score >= 65 ? '#3d65f6' : '#64748b';

  const handleMouseEnter = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    setHovered(true);
    setExpanded(true);
  };

  const handleMouseLeave = () => {
    leaveTimer.current = setTimeout(() => {
      setHovered(false);
      setExpanded(false);
    }, 180);
  };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        background: hovered ? 'rgba(124,108,255,0.07)' : 'rgba(255,255,255,0.025)',
        border: hovered ? '1px solid rgba(124,108,255,0.28)' : '1px solid rgba(255,255,255,0.06)',
        borderRadius: '14px',
        padding: '13px 15px',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: hovered
          ? '0 20px 40px rgba(0,0,0,0.4), 0 0 12px rgba(124,108,255,0.35)'
          : '0 2px 8px rgba(0,0,0,0.18)',
        transition: 'all 0.25s ease',
        cursor: 'default',
      }}
    >
      {/* ── Row: rank · emoji · title · badge ── */}
      <div className="flex items-center gap-2.5">
        {/* Rank symbol — Section 1 */}
        <span className="text-sm font-black shrink-0 w-5 text-center select-none"
          style={{ color: 'rgba(167,139,250,0.55)' }}>
          {rankSymbol(rank - 1)}
        </span>

        <span className="text-lg shrink-0">{match.emoji}</span>

        <p className="text-sm font-bold text-white/85 flex-1 min-w-0 truncate">{match.title}</p>

        {/* Score badge — Section 1 */}
        <span
          className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-black tracking-wide"
          style={{
            color: accentColor,
            background: `${accentColor}18`,
            border: `1px solid ${accentColor}40`,
            boxShadow: `0 0 8px ${accentColor}25`,
          }}
        >
          {match.score}% Match
        </span>
      </div>

      {/* ── Compact progress bar (≈65% width) — Section 1 ── */}
      <div className="mt-2.5 pl-[46px] flex items-center gap-3">
        <div className="rounded-full overflow-hidden" style={{ width: '65%', height: '5px', background: 'rgba(255,255,255,0.05)' }}>
          <div
            style={{
              height: '100%',
              width: `${match.score}%`,
              background: 'linear-gradient(90deg, #7C6CFF, #9B7BFF)',
              boxShadow: '0 0 12px rgba(124,108,255,0.35)',
              borderRadius: '9999px',
              transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)',
            }}
          />
        </div>
        <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.22)' }}>{match.cluster}</span>
      </div>

      {/* ── Expandable XAI panel (Sections 2 & 3) ── */}
      <div
        style={{
          maxHeight: expanded ? '380px' : '0',
          overflow: 'hidden',
          opacity: expanded ? 1 : 0,
          transition: 'all 0.25s ease',
        }}
      >
        {match.reasons.length > 0 && (
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] font-bold mb-2 flex items-center gap-1.5"
              style={{ color: 'rgba(167,139,250,0.9)' }}>
              <span style={{ color: '#7C6CFF' }}>✦</span> Why this matches you
            </p>
            <ul className="space-y-1">
              {match.reasons.map(r => (
                <li key={r} className="flex items-start gap-1.5 text-xs"
                  style={{ color: 'rgba(255,255,255,0.55)' }}>
                  <span className="mt-0.5 shrink-0" style={{ color: '#7C6CFF' }}>•</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}
        <MatchFactorBreakdown factors={factors} />
      </div>

      {/* Mobile tap toggle */}
      <button
        className="mt-2 pl-[46px] flex items-center gap-1 text-[10px] font-semibold md:hidden"
        style={{ color: 'rgba(255,255,255,0.28)' }}
        onClick={() => setExpanded(e => !e)}
      >
        <svg className={`h-3 w-3 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
        {expanded ? 'Hide details' : 'Why this matches you →'}
      </button>
    </div>
  );
}

// ─── SECTION 5 — Career Radar Map ────────────────────────────────────────────

interface RadarPoint {
  subject: string;
  score: number;
  fullMark: number;
  factors: string[];
}

const RADAR_TOOLTIP_FACTORS: Record<string, string[]> = {
  Technology:  ['Technology interest selected', 'Strong mathematics', 'High problem solving ability'],
  Science:     ['Science interest selected', 'Strong science marks', 'Analytical thinking'],
  Business:    ['Business interest selected', 'Leadership strength', 'Communication skills'],
  Design:      ['Design interest selected', 'High creativity rating', 'Attention to detail'],
  Healthcare:  ['Healthcare interest selected', 'Strong science marks', 'Communication skills'],
  Law:         ['Law interest selected', 'Strong language skills', 'Analytical mindset'],
};

function RadarTooltipContent({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as RadarPoint;
  if (!d) return null;
  return (
    <div
      className="rounded-xl p-3 text-xs"
      style={{
        background: 'rgba(10,12,22,0.97)',
        border: '1px solid rgba(124,108,255,0.4)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        minWidth: '180px',
      }}
    >
      <p className="font-black mb-1.5" style={{ color: '#a78bfa' }}>
        {d.subject} Score: <span style={{ color: '#fff' }}>{d.score}</span>
      </p>
      <p className="text-[9px] font-bold uppercase tracking-wider mb-1.5"
        style={{ color: 'rgba(255,255,255,0.28)' }}>Contributing factors</p>
      <ul className="space-y-0.5">
        {d.factors.map(f => (
          <li key={f} className="flex items-start gap-1.5" style={{ color: 'rgba(255,255,255,0.58)' }}>
            <span style={{ color: '#7C6CFF' }}>•</span>{f}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CareerRadarMap({ profile }: {
  profile: {
    interests: InterestArea[];
    strengths: StrengthRatings;
    academic_marks?: any;
  };
}) {
  const hasInterest = (area: string) =>
    profile.interests.includes(area as InterestArea) ? 100 : 0;

  const str = (k: keyof StrengthRatings) => {
    const v = Number(profile.strengths[k] ?? 0);
    return Math.round(((v - 1) / 4) * 100);
  };

  const avgMark = (subj: string) => {
    const m = profile.academic_marks;
    if (!m) return 50;
    const vals = [m.year_1?.[subj], m.year_2?.[subj], m.year_3?.[subj]]
      .filter((v: any) => v !== null && v !== undefined) as number[];
    return vals.length
      ? Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length)
      : 50;
  };

  const data: RadarPoint[] = [
    {
      subject: 'Technology',
      score: Math.round(hasInterest('technology') * 0.40 + str('problem_solving') * 0.35 + avgMark('computer') * 0.25),
      fullMark: 100,
      factors: RADAR_TOOLTIP_FACTORS['Technology'],
    },
    {
      subject: 'Science',
      score: Math.round(hasInterest('science') * 0.35 + avgMark('science') * 0.45 + str('problem_solving') * 0.20),
      fullMark: 100,
      factors: RADAR_TOOLTIP_FACTORS['Science'],
    },
    {
      subject: 'Business',
      score: Math.round(hasInterest('business') * 0.40 + str('leadership') * 0.35 + str('communication') * 0.25),
      fullMark: 100,
      factors: RADAR_TOOLTIP_FACTORS['Business'],
    },
    {
      subject: 'Design',
      score: Math.round(hasInterest('design') * 0.45 + str('creativity') * 0.40 + str('attention_to_detail') * 0.15),
      fullMark: 100,
      factors: RADAR_TOOLTIP_FACTORS['Design'],
    },
    {
      subject: 'Healthcare',
      score: Math.round(hasInterest('healthcare') * 0.45 + avgMark('science') * 0.35 + str('communication') * 0.20),
      fullMark: 100,
      factors: RADAR_TOOLTIP_FACTORS['Healthcare'],
    },
    {
      subject: 'Law',
      score: Math.round(hasInterest('law') * 0.45 + avgMark('language') * 0.30 + str('communication') * 0.25),
      fullMark: 100,
      factors: RADAR_TOOLTIP_FACTORS['Law'],
    },
  ];

  return (
    <div className="rounded-2xl p-5 h-full"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-0.5"
        style={{ color: 'rgba(255,255,255,0.32)' }}>
        Career Profile Map
      </p>
      <p className="text-[10px] mb-4" style={{ color: 'rgba(255,255,255,0.20)' }}>
        Hover each axis for contributing factors
      </p>

      <div style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="72%">
            <PolarGrid stroke="rgba(255,255,255,0.07)" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: 'rgba(255,255,255,0.42)', fontSize: 11, fontWeight: 600 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: 'rgba(255,255,255,0.16)', fontSize: 9 }}
              tickCount={4}
              stroke="transparent"
            />
            <Radar
              name="Career Fit"
              dataKey="score"
              stroke="#7C6CFF"
              fill="#7C6CFF"
              fillOpacity={0.18}
              strokeWidth={2}
              dot={{ fill: '#9B7BFF', r: 3, strokeWidth: 0 }}
            />
            <Tooltip content={<RadarTooltipContent />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Score legend */}
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {data.map(d => (
          <div key={d.subject}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1"
            style={{ background: 'rgba(124,108,255,0.06)', border: '1px solid rgba(124,108,255,0.12)' }}>
            <span className="text-[9px] font-semibold flex-1" style={{ color: 'rgba(255,255,255,0.45)' }}>{d.subject}</span>
            <span className="text-[10px] font-black" style={{ color: '#9B7BFF' }}>{d.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Per-card match factors ───────────────────────────────────────────────────

function computeMatchFactors(
  match: CareerMatch,
  profile: {
    interests: InterestArea[];
    strengths: StrengthRatings;
    learning_styles: LearningStyle[];
    career_curiosities: string[];
    academic_marks?: any;
  }
): MatchFactors {
  const clusterInterestMap: Record<string, InterestArea[]> = {
    'Technology & Data':          ['technology'],
    'Business & Management':      ['business'],
    'Design & Creative':          ['design'],
    'Health & Life Sciences':     ['healthcare', 'science'],
    'Law & Social Sciences':      ['law'],
    'Education & Social Sciences':['arts'],
  };
  const rel = clusterInterestMap[match.cluster] ?? [];
  const interestFit = rel.length
    ? Math.min(100, Math.round(profile.interests.filter(i => rel.includes(i)).length / rel.length * 100))
    : 0;

  const allStr = Object.values(profile.strengths).filter(Boolean) as number[];
  const strengthFit = allStr.length
    ? Math.round((allStr.reduce((a, b) => a + b, 0) / allStr.length / 5) * 100)
    : 50;

  const academicFit = (() => {
    const m = profile.academic_marks;
    if (!m) return 50;
    const subjects = ['mathematics', 'science', 'language', 'social_studies', 'computer'];
    const all: number[] = [];
    for (const s of subjects) {
      const vals = [m.year_1?.[s], m.year_2?.[s], m.year_3?.[s]]
        .filter((v: any) => v !== null && v !== undefined) as number[];
      if (vals.length) all.push(vals.reduce((a: number, b: number) => a + b, 0) / vals.length);
    }
    return all.length ? Math.round(all.reduce((a, b) => a + b, 0) / all.length) : 50;
  })();

  const learningFit   = Math.min(100, Math.round((profile.learning_styles.length / 2) * 100));
  const curiosityFit  = profile.career_curiosities.includes(match.id) ? 100
    : profile.career_curiosities.length > 0 ? 40 : 20;

  return { interestFit, strengthFit, academicFit, learningFit, curiosityFit };
}

// ─── Dashboard intelligence section ──────────────────────────────────────────

function StudentIntelligenceSection() {
  const [matches, setMatches] = useState<CareerMatch[]>([]);
  const [chi,     setChi]     = useState<CareerHealthIndex | null>(null);
  const [report,  setReport]  = useState<CareerIntelligenceReport | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ profile: Record<string, unknown> | null }>('/onboarding/profile')
      .then(res => {
        const p = res.profile;
        if (!p) return;
        const safeProfile = {
          interests:          (p.interests          as InterestArea[]  | undefined) ?? [],
          strengths:          (p.strengths          as StrengthRatings | undefined) ?? { problem_solving: 3, creativity: 3, communication: 3, mathematics: 3, leadership: 3 },
          learning_styles:    (p.learning_styles    as LearningStyle[] | undefined) ?? [],
          career_curiosities: (p.career_curiosities as string[]        | undefined) ?? [],
          academic_marks:     (p.academic_marks     as any)            ?? null,
        };
        setProfile(safeProfile);
        setMatches(topCareerMatches(safeProfile, 5));
        setChi(computeCHI(safeProfile));
        setReport(buildCareerReport(safeProfile));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)' }} />
        ))}
      </div>
    );
  }

  if (!chi || matches.length === 0) return null;

  return (
    <div className="space-y-5">
      <h2 className="text-xs font-bold uppercase tracking-[0.18em]"
        style={{ color: 'rgba(255,255,255,0.32)' }}>
        Career Intelligence
      </h2>

      {/* SECTION 6 — Top row: CHI + Career Intelligence Profile */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CHICard chi={chi} />
        {report && <CareerReportCard report={report} />}
      </div>

      {/* SECTION 6 — Second row: Radar Map + Top Matches */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* SECTION 5 — Career Radar Map */}
        {profile && <CareerRadarMap profile={profile} />}

        {/* SECTIONS 1–4 — Top Career Matches */}
        <div className="rounded-2xl p-5"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ color: 'rgba(255,255,255,0.32)' }}>
              Top Career Matches
            </p>
            <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold"
              style={{
                color: 'rgba(124,108,255,0.8)',
                background: 'rgba(124,108,255,0.10)',
                border: '1px solid rgba(124,108,255,0.20)',
              }}>
              AI Ranked
            </span>
          </div>
          <div className="space-y-2.5">
            {matches.map((m, i) => (
              <CareerMatchCard
                key={m.id}
                match={m}
                rank={i + 1}
                factors={
                  profile
                    ? computeMatchFactors(m, profile)
                    : { interestFit: 50, strengthFit: 50, academicFit: 50, learningFit: 50, curiosityFit: 50 }
                }
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudentDashboardPage() {
  const { user, isAdmin, isLoading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!isLoading && isAdmin) router.replace('/admin/dashboard');
  }, [isAdmin, isLoading, router]);

  if (isLoading || isAdmin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const firstName = user?.displayName?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'there';
  const isNewUser = !user?.onboardingCompleted;

  return (
    <div className="animate-slide-up space-y-6 pb-16">

      <StudentWelcomeBanner firstName={firstName} isNew={isNewUser} />

      {/* Intelligence section — only shown after student onboarding is complete */}
      {user?.student_onboarding_complete && <StudentIntelligenceSection />}

      {/* SECTION 6 — Modules below intelligence grid */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-[0.18em]"
          style={{ color: 'rgba(255,255,255,0.32)' }}>
          Your Modules
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.40)' }}>
          Start with Career Discovery — it unlocks personalised recommendations across all modules.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STUDENT_MODULES.map((mod) => (
          <StudentModuleCard key={mod.id} mod={mod} />
        ))}
      </div>

      <p className="text-center text-[11px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
        Use the sidebar to navigate between modules at any time. All modules build on your interest profile.
      </p>
    </div>
  );
}