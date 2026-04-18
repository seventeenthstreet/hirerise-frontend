'use client';

// features/dashboard/components/ChiOverview.tsx
//
// Career Health Index overview section for /dashboard.
// Shows 4 intelligence cards: CHI Score, Skill Gap, Salary Benchmark, Market Demand.
// Uses profile data to populate live values where available.

import Link from 'next/link';
import { useProfile } from '@/features/profile/hooks';
import { useCareerHealthSimple } from '@/hooks/useCareerHealth';
import { cn } from '@/utils/cn';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChiCardProps {
  title:       string;
  value:       React.ReactNode;
  description: string;
  href:        string;
  icon:        React.ReactNode;
  accent:      string;
  badge?:      string;
  locked?:     boolean;
}

// ─── CHI Card ─────────────────────────────────────────────────────────────────

function ChiCard({ title, value, description, href, icon, accent, badge, locked }: ChiCardProps) {
  return (
    <div className={cn(
      'group relative flex flex-col overflow-hidden rounded-2xl border bg-white p-5 shadow-card transition-all duration-200',
      locked
        ? 'border-surface-100 opacity-70'
        : 'border-surface-100 hover:shadow-card-md hover:-translate-y-0.5',
    )}>
      {/* Accent strip */}
      <div className={cn('absolute left-0 top-0 h-full w-1 rounded-l-2xl', accent)} />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 pl-3">
        <div className={cn(
          'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl',
          accent.replace('bg-', 'bg-').replace('-500', '-50').replace('-600', '-50'),
        )}>
          {icon}
        </div>
        {badge && (
          <span className="rounded-full bg-surface-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-surface-400">
            {badge}
          </span>
        )}
      </div>

      {/* Value */}
      <div className="mt-4 pl-3">
        <div className="text-3xl font-black tracking-tighter text-surface-900">{value}</div>
        <p className="mt-0.5 text-xs font-semibold text-surface-500">{title}</p>
        <p className="mt-1.5 text-xs leading-relaxed text-surface-400">{description}</p>
      </div>

      {/* CTA */}
      <div className="mt-4 pl-3">
        {locked ? (
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-surface-300">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Complete profile to unlock
          </span>
        ) : (
          <Link
            href={href}
            className="flex items-center gap-1 text-xs font-semibold text-hr-600 transition-colors hover:text-hr-700"
          >
            View details
            <svg className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Ring gauge (CHI Score) ────────────────────────────────────────────────────

function RingGauge({ score }: { score: number | null }) {
  if (score == null) {
    return <span className="text-3xl font-black tracking-tighter text-surface-200">—</span>;
  }

  const pct  = Math.min(100, Math.max(0, score));
  const circ = 2 * Math.PI * 15.9;
  const dash = (pct / 100) * circ;

  const colour = pct >= 70 ? '#34d399' : pct >= 40 ? '#f59e0b' : '#f87171';

  return (
    <div className="relative inline-flex h-14 w-14 items-center justify-center">
      <svg className="-rotate-90 h-14 w-14" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f3f9" strokeWidth="3" />
        <circle
          cx="18" cy="18" r="15.9"
          fill="none"
          stroke={colour}
          strokeWidth="3"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-sm font-black text-surface-900">{score}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ChiOverview() {
  const { data } = useProfile();
  const user = data?.user;
  const { data: chiData } = useCareerHealthSimple();  // live CHI score after recalculation

  const hasResume  = !!user?.resumeUploaded;
  const hasProfile = !!user?.onboardingCompleted;

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-surface-400">
            Career Intelligence
          </h2>
        </div>
        <Link href="/analytics" className="text-xs font-medium text-hr-500 hover:text-hr-700 transition-colors">
          Full analytics →
        </Link>
      </div>

      {/* 4-card grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {/* 1 — CHI Score */}
        <ChiCard
          title="Career Health Score"
          value={<RingGauge score={chiData?.chiScore ?? null} />}
          description={
            chiData?.chiScore != null
              ? chiData.chiScore >= 70
                ? 'Excellent! Your career profile is strong.'
                : chiData.chiScore >= 40
                  ? 'Good foundation — a few gaps to close.'
                  : 'Getting started — complete your profile.'
              : 'Upload a resume to calculate your score.'
          }
          href="/analytics"
          locked={!hasResume}
          accent="bg-hr-500"
          icon={
            <svg className="h-4 w-4 text-hr-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
          }
        />

        {/* 2 — Skill Gap */}
        <ChiCard
          title="Skill Gap Analysis"
          value={hasResume ? <span className="text-amber-400">3 gaps</span> : '—'}
          description="Skills you're missing compared to your target role and market benchmarks."
          href="/skills"
          locked={!hasProfile}
          accent="bg-amber-400"
          badge={!hasResume ? 'Phase 4' : undefined}
          icon={
            <svg className="h-4 w-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          }
        />

        {/* 3 — Salary Benchmark */}
        <ChiCard
          title="Salary Benchmark"
          value="—"
          description="How your expected salary compares to the market for your role and experience."
          href="/analytics"
          locked={!hasProfile}
          accent="bg-green-500"
          badge="Phase 4"
          icon={
            <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        {/* 4 — Market Demand */}
        <ChiCard
          title="Market Demand"
          value="—"
          description="Demand score for your top skills across active job postings in your region."
          href="/analytics"
          locked={!hasResume}
          accent="bg-violet-500"
          badge="Phase 4"
          icon={
            <svg className="h-4 w-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
        />
      </div>
    </div>
  );
}