'use client';

// app/(dashboard)/analytics/page.tsx — /analytics
// Phase 6: Full career analytics page using live career intelligence components.

import Link from 'next/link';
import { useCareerHealth } from '@/hooks/useCareerHealth';
import { useProfile } from '@/hooks/useProfile';
import {
  CareerHealthBreakdown,
  SkillGapCard,
  MarketDemandCard,
  SalaryBenchmarkCard,
  CareerPathCard,
  LearningRecommendations,
} from '@/components/career';
import { cn } from '@/utils/cn';

// ─── CHI score banner ─────────────────────────────────────────────────────────

function ChiBanner() {
  const { data: chi, isLoading } = useCareerHealth();
  const { data: profile } = useProfile();

  const score = chi?.chiScore ?? null;
  const pct   = score != null ? Math.min(100, Math.max(0, score)) : 0;
  const circ  = 2 * Math.PI * 15.9;
  const dash  = (pct / 100) * circ;
  const color = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#f87171';

  const lastCalc = chi?.lastCalculated
    ? new Date(chi.lastCalculated).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="rounded-2xl border border-hr-100 bg-gradient-to-br from-hr-50 to-white p-6">
      <div className="flex items-center justify-between gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-hr-400">Career Health Index</p>
          <div className="mt-2 flex items-end gap-2">
            {isLoading ? (
              <div className="h-12 w-16 animate-pulse rounded bg-surface-100" />
            ) : (
              <span className={cn(
                'text-5xl font-black tracking-tighter',
                score == null ? 'text-surface-200' : pct >= 70 ? 'text-green-600' : pct >= 40 ? 'text-amber-500' : 'text-red-500',
              )}>
                {score ?? '—'}
              </span>
            )}
            <span className="mb-1 text-sm text-surface-400">/ 100</span>
          </div>
          <p className="mt-2 text-xs text-surface-400 max-w-xs">
            {!chi?.isReady
              ? 'Complete your profile and upload your resume to calculate your Career Health Index.'
              : score != null && score >= 70
                ? 'Strong profile — you are well-positioned for your target role.'
                : score != null && score >= 40
                  ? 'Good start — close key skill gaps to reach the next level.'
                  : 'Getting started — more data needed to improve your score.'
            }
          </p>
          {lastCalc && (
            <p className="mt-2 text-[10px] text-surface-300">Last updated {lastCalc}</p>
          )}
        </div>
        <div className="hidden sm:block shrink-0">
          <div className="relative flex h-24 w-24 items-center justify-center">
            <svg className="h-24 w-24 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e4e8f2" strokeWidth="3" />
              {score != null && (
                <circle cx="18" cy="18" r="15.9" fill="none" stroke={color} strokeWidth="3"
                  strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
              )}
            </svg>
            <span className={cn(
              'absolute text-lg font-bold',
              score == null ? 'text-surface-300' : 'text-surface-900',
            )}>
              {score ?? '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  return (
    <div className="animate-slide-up space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-surface-900">Analytics</h2>
          <p className="mt-0.5 text-sm text-surface-400">
            Career Health Index breakdown and market positioning data.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="mt-1 flex items-center gap-1 text-xs font-semibold text-hr-500 hover:text-hr-700 transition-colors"
        >
          ← Dashboard
        </Link>
      </div>

      {/* CHI score banner */}
      <ChiBanner />

      {/* Career Health + Salary */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CareerHealthBreakdown />
        <SalaryBenchmarkCard />
      </div>

      {/* Skill Intelligence */}
      <div>
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-surface-400">Skill Intelligence</h3>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SkillGapCard limit={8} />
          <MarketDemandCard limit={8} />
        </div>
      </div>

      {/* Career Path + Learning */}
      <div>
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-surface-400">Career Path & Learning</h3>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <CareerPathCard />
          <LearningRecommendations />
        </div>
      </div>

    </div>
  );
}
