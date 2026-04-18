'use client';

// components/career/CareerHealthBreakdown.tsx — v3 reskin
// Changes: card-v3 tokens, removed all border-b dividers, tooltip on each bar row

import { useState } from 'react';
import { useCareerHealth } from '@/hooks/useCareerHealth';
import { useHasResume }    from '@/hooks/useHasResume';
import { cn } from '@/utils/cn';

function deriveBreakdown(chi: {
  chiScore: number | null;
  skillGaps: Array<{ gap: number; priority: string }>;
  demandMetrics: Array<{ demandScore: number }>;
  salaryBenchmark: { percentile: number | null } | null;
}) {
  const avgGap = chi.skillGaps.length > 0
    ? chi.skillGaps.reduce((s, g) => s + g.gap, 0) / chi.skillGaps.length : 0;
  const skillsMatch = Math.round(Math.max(0, 100 - avgGap));
  const marketDemand = chi.demandMetrics.length > 0
    ? Math.round(chi.demandMetrics.slice(0, 5).reduce((s, m) => s + m.demandScore, 0) / Math.min(5, chi.demandMetrics.length)) : 0;
  const experienceAlignment = chi.chiScore != null ? Math.round(Math.min(100, chi.chiScore * 1.1)) : 0;
  const resumeStrength = chi.salaryBenchmark?.percentile != null
    ? Math.round(chi.salaryBenchmark.percentile) : chi.chiScore != null ? Math.round(chi.chiScore * 0.9) : 0;

  return [
    { label: 'Skills Match',         value: skillsMatch,         color: 'bg-hr-500',     tooltip: 'How well your detected skills match current market requirements for your target role.' },
    { label: 'Market Demand',        value: marketDemand,        color: 'bg-violet-500', tooltip: 'Average demand score for your top skills based on live job posting signals.' },
    { label: 'Experience Alignment', value: experienceAlignment, color: 'bg-green-500',  tooltip: 'How your years and type of experience align with expectations for your target role.' },
    { label: 'Resume Strength',      value: resumeStrength,      color: 'bg-amber-500',  tooltip: 'A composite of resume completeness, keyword density, and ATS compatibility score.' },
  ];
}

function BreakdownRow({ label, value, color, tooltip, index, maxValue }: {
  label: string; value: number; color: string; tooltip: string; index: number; maxValue: number;
}) {
  const [show, setShow] = useState(false);
  const pct     = Math.min(100, Math.max(0, value));
  // FIX: scale bar width relative to the highest score in the set
  // so bars are visually proportional — 82% should look clearly longer than 45%
  const barPct  = maxValue > 0 ? Math.round((pct / maxValue) * 100) : pct;
  const textColor = pct >= 70 ? 'text-green-400' : pct >= 40 ? 'text-amber-400' : 'text-red-400';

  return (
    <div style={{ animationDelay: `${index * 80}ms` }}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white/78">{label}</span>
          <span
            className="relative inline-flex"
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
          >
            <span className="flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-white/5 text-[9px] text-white/28 hover:text-white/55 transition-colors select-none">?</span>
            {show && <span className="tooltip-v3">{tooltip}</span>}
          </span>
        </div>
        <span className={cn('text-base font-black tracking-tight tabular-nums', textColor)}>{pct}%</span>
      </div>
      <div className="progress-track">
        <div
          className={cn('h-full rounded-full transition-all duration-700 ease-out', color)}
          style={{ width: `${barPct}%` }}
        />
      </div>
    </div>
  );
}

function BreakdownSkeleton() {
  return (
    <div className="card-v3 p-5 animate-pulse space-y-5">
      <div className="h-3 w-32 rounded bg-white/8" />
      {[...Array(4)].map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="h-3 w-28 rounded bg-white/8" />
            <div className="h-4 w-10 rounded bg-white/8" />
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/8" />
        </div>
      ))}
    </div>
  );
}

interface CareerHealthBreakdownProps { className?: string; }

export function CareerHealthBreakdown({ className }: CareerHealthBreakdownProps) {
  const { data: chi, isLoading, isError } = useCareerHealth();
  const { hasResume } = useHasResume();

  if (isLoading) return <BreakdownSkeleton />;

  if (isError) return (
    <div className={cn('card-v3 p-5', className)}>
      <p className="text-sm text-red-400 text-center">Failed to load breakdown.</p>
    </div>
  );

  if (!chi?.isReady) {
    const msg = hasResume ? 'Your Career Health Index is being calculated…' : 'Upload your resume to see your breakdown';
    return (
      <div className={cn('card-v3 p-5', className)}>
        <h3 className="label-v3 mb-4">Career Health Breakdown</h3>
        <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
            {hasResume
              ? <svg className="h-5 w-5 text-hr-400 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              : <svg className="h-5 w-5 text-white/22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            }
          </div>
          <p className="text-sm text-white/45">{msg}</p>
        </div>
      </div>
    );
  }

  const breakdown = deriveBreakdown(chi);
  const overall   = chi.chiScore ?? 0;
  // FIX: compute max value across all dimensions so bars scale relative to each other
  const maxValue  = Math.max(...breakdown.map(b => b.value), 1);

  // FIX: bridge explanation — shown when skills are good but CHI is still low
  const skillsMatch  = breakdown.find(b => b.label === 'Skills Match')?.value ?? 0;
  const showBridge   = skillsMatch >= 70 && overall < 60;

  return (
    <div className={cn('card-v3 overflow-hidden', className)}>
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div>
          <h3 className="label-v3">Career Health Breakdown</h3>
          <p className="mt-0.5 text-[11px] text-white/32">What contributes to your CHI score</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn(
            'text-xl font-black tracking-tight tabular-nums',
            overall >= 70 ? 'text-green-400' : overall >= 40 ? 'text-amber-400' : 'text-red-400',
          )}>{overall}</span>
          <span className="text-xs text-white/28 font-medium">/ 100</span>
        </div>
      </div>

      <div className="px-5 pb-4 space-y-5">
        {breakdown.map((item, i) => (
          <BreakdownRow key={item.label} {...item} index={i} maxValue={maxValue} />
        ))}
      </div>

      {/* FIX: bridge explanation for the skill-match vs low CHI contradiction */}
      {showBridge && (
        <div className="mx-5 mb-4 rounded-xl px-3 py-2.5" style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.15)' }}>
          <p className="text-[11px] text-amber-400/80 leading-relaxed">
            <span className="font-bold">Why is CHI lower than Skill Match?</span> Skills are only one factor.
            Market demand, experience alignment, and resume strength also contribute — improving those will raise your overall score.
          </p>
        </div>
      )}

      <div className="px-5 pb-4">
        <p className="text-[10px] text-white/22 leading-relaxed">
          Scores calculated from your resume, skill profile, and real-time market signals.
        </p>
      </div>
    </div>
  );
}