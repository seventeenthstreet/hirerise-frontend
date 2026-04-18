'use client';

// components/career/MarketDemandCard.tsx — v3 reskin
// Changes: removed internal border-t dividers, shadow card, richer demand data display

import { useCareerHealth } from '@/hooks/useCareerHealth';
import { useHasResume }    from '@/hooks/useHasResume';
import { cn } from '@/utils/cn';
import type { DemandTrend, DemandMetric } from '@/types/careerHealth';

const trendConfig: Record<DemandTrend, { label: string; color: string; icon: string; bar: string }> = {
  rising:  { label: 'Rising',    color: '#4ade80', icon: '↑', bar: 'bg-green-400' },
  stable:  { label: 'Stable',    color: '#60a5fa', icon: '→', bar: 'bg-blue-400'  },
  falling: { label: 'Declining', color: '#f87171', icon: '↓', bar: 'bg-red-400'   },
};

function DemandRow({ metric, index, maxScore }: { metric: DemandMetric; index: number; maxScore: number }) {
  const cfg    = trendConfig[metric.trend];
  const barPct = maxScore > 0 ? (metric.demandScore / maxScore) * 100 : 0;

  return (
    // No border-t — spacing separation
    <div className={cn('flex items-center gap-3 px-5 py-3 hover:bg-white/[0.025] transition-colors', index !== 0 && 'mt-px')}>
      {/* Trend arrow */}
      <span className="shrink-0 w-4 text-center text-sm font-black leading-none" style={{ color: cfg.color }}>
        {cfg.icon}
      </span>

      {/* Name + bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <p className="text-sm font-semibold text-white/82 truncate">{metric.skillName}</p>
          <span
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
            style={{ background: `${cfg.color}15`, color: cfg.color }}
          >
            {cfg.label}
          </span>
        </div>
        {/* Borderless progress bar */}
        <div className="progress-track">
          <div className={cn('h-full rounded-full transition-all duration-700', cfg.bar)} style={{ width: `${barPct}%` }} />
        </div>
      </div>

      {/* Score */}
      <div className="shrink-0 text-right">
        <p className="text-sm font-bold text-white/82 tabular-nums">{metric.demandScore}</p>
        {metric.jobPostings > 0 && (
          <p className="text-[9px] text-white/28">{metric.jobPostings.toLocaleString()} jobs</p>
        )}
      </div>
    </div>
  );
}

function DemandSkeleton() {
  return (
    <div className="card-v3 overflow-hidden animate-pulse">
      <div className="px-5 py-4"><div className="h-3 w-28 rounded bg-white/8" /></div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3">
          <div className="h-4 w-4 rounded bg-white/8" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-24 rounded bg-white/8" />
            <div className="h-1.5 w-full rounded-full bg-white/8" />
          </div>
          <div className="h-4 w-8 rounded bg-white/8" />
        </div>
      ))}
    </div>
  );
}

interface MarketDemandCardProps {
  limit?: number;
  className?: string;
}

export function MarketDemandCard({ limit = 7, className }: MarketDemandCardProps) {
  const { data: chi, isLoading, isError } = useCareerHealth();
  const { hasResume } = useHasResume();

  if (isLoading) return <DemandSkeleton />;
  if (isError) return (
    <div className={cn('card-v3 p-5', className)}>
      <p className="text-sm text-red-400 text-center">Failed to load demand data.</p>
    </div>
  );

  if (!chi?.isReady || chi.demandMetrics.length === 0) {
    return (
      <div className={cn('card-v3 overflow-hidden', className)}>
        <div className="px-5 py-4">
          <h3 className="label-v3">Market Demand</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-10 text-center px-5 gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
            <svg className="h-5 w-5 text-white/22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <p className="text-sm text-white/42">
            {!chi?.isReady
              ? (hasResume ? 'Analysing market demand for your skills…' : 'Upload your resume to unlock market demand data.')
              : 'No demand data available yet.'}
          </p>
        </div>
      </div>
    );
  }

  const sorted = [...chi.demandMetrics]
    .sort((a, b) => {
      const order = { rising: 0, stable: 1, falling: 2 };
      if (order[a.trend] !== order[b.trend]) return order[a.trend] - order[b.trend];
      return b.demandScore - a.demandScore;
    })
    .slice(0, limit);

  const maxScore     = Math.max(...sorted.map(m => m.demandScore), 1);
  const risingCount  = chi.demandMetrics.filter(m => m.trend === 'rising').length;
  const fallingCount = chi.demandMetrics.filter(m => m.trend === 'falling').length;

  return (
    <div className={cn('card-v3 overflow-hidden', className)}>
      {/* Header — no bottom border */}
      <div className="px-5 py-4 flex items-center justify-between">
        <div>
          <h3 className="label-v3">Market Demand</h3>
          <p className="mt-0.5 text-[11px] text-white/32">
            {risingCount > 0 && <span className="text-green-400 font-semibold">{risingCount} rising</span>}
            {risingCount > 0 && fallingCount > 0 && <span className="text-white/20"> · </span>}
            {fallingCount > 0 && <span className="text-red-400 font-semibold">{fallingCount} declining</span>}
            {risingCount === 0 && fallingCount === 0 && <span>All stable</span>}
          </p>
        </div>
        <svg className="h-4 w-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      </div>

      {/* Rows */}
      <div className="pb-2">
        {sorted.map((m, i) => <DemandRow key={m.skillName} metric={m} index={i} maxScore={maxScore} />)}
      </div>
    </div>
  );
}