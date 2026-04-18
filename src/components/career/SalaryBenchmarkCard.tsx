'use client';

// components/career/SalaryBenchmarkCard.tsx
// Feature 4 — Salary Benchmark
// Shows salary range, median, and user percentile for target role.
// Data source: useCareerHealth() → data.salaryBenchmark

import { useCareerHealth } from '@/hooks/useCareerHealth';
import { useProfile }      from '@/hooks/useProfile';
import { useTargetRole }   from '@/hooks/useTargetRole';
import { cn }              from '@/utils/cn';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
      notation: value >= 100_000 ? 'compact' : 'standard',
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

// ─── Percentile marker ────────────────────────────────────────────────────────

function PercentileBar({
  p25,
  p75,
  median,
  percentile,
  currency,
}: {
  p25:        number;
  p75:        number;
  median:     number;
  percentile: number | null;
  currency:   string;
}) {
  // Clamp percentile marker position to the bar (0–100%)
  const markerPos = percentile != null ? Math.min(100, Math.max(0, percentile)) : null;

  return (
    <div className="mt-5">
      {/* Labels */}
      <div className="flex items-end justify-between mb-2 gap-1">
        <div className="text-center">
          <p className="text-[10px] text-white/35 font-medium">25th</p>
          <p className="text-xs font-bold text-white/70">{formatCurrency(p25, currency)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-amber-500 font-semibold uppercase tracking-widest">Median</p>
          <p className="text-sm font-black text-white/88">{formatCurrency(median, currency)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-white/35 font-medium">75th</p>
          <p className="text-xs font-bold text-white/70">{formatCurrency(p75, currency)}</p>
        </div>
      </div>

      {/* Bar track */}
      <div className="relative h-3 rounded-full bg-white/8 overflow-visible">
        {/* Filled gradient: p25 → p75 within the full scale */}
        <div
          className="absolute top-0 h-full rounded-full bg-gradient-to-r from-amber-200 via-green-300 to-green-500"
          style={{
            left:  '20%',
            right: '20%',
          }}
        />
        {/* Median tick */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-amber-500"
          style={{ left: '50%' }}
        />
        {/* User percentile marker */}
        {markerPos !== null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
            style={{ left: `${markerPos}%` }}
          >
            <div className="h-5 w-5 rounded-full border-2 border-white shadow-card-md bg-hr-500/100" />
          </div>
        )}
      </div>

      {/* Percentile label */}
      {markerPos !== null && (
        <div className="mt-3 text-center">
          <span className="rounded-full bg-hr-500/10 border border-hr-500/20 px-3 py-1 text-xs font-semibold text-hr-300">
            You're at the {percentile}th percentile
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SalarySkeleton() {
  return (
    <div className="card-v3 p-5 animate-pulse space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <div className="h-3 w-24 rounded bg-white/8" />
          <div className="h-6 w-36 rounded bg-white/8" />
        </div>
        <div className="h-7 w-7 rounded-lg bg-white/8" />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between">
          <div className="h-3 w-16 rounded bg-white/8" />
          <div className="h-4 w-20 rounded bg-white/8" />
          <div className="h-3 w-16 rounded bg-white/8" />
        </div>
        <div className="h-3 w-full rounded-full bg-white/8" />
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SalaryBenchmarkCardProps {
  className?: string;
}

export function SalaryBenchmarkCard({ className }: SalaryBenchmarkCardProps) {
  const { data: chi,     isLoading: chiLoading  } = useCareerHealth();
  const { data: profile, isLoading: profLoading } = useProfile();

  const isLoading = chiLoading || profLoading;

  // FIX 1: always use CV-derived role — never stale onboarding value
  const { targetRole } = useTargetRole();

  if (isLoading) return <SalarySkeleton />;

  const user       = profile?.user;
  const bench      = chi?.salaryBenchmark;
  const isReady    = chi?.isReady;
  const hasProfile = !!user?.onboardingCompleted;

  // FIX 2: guard currency against location mismatch
  // Backend sometimes returns INR with a non-India location — derive from location
  const resolveCurrency = (): string => {
    const loc = ((user as any)?.location ?? '').toLowerCase();
    if (loc.includes('dubai') || loc.includes('uae') || loc.includes('abu dhabi')) return 'AED';
    if (loc.includes('uk') || loc.includes('london') || loc.includes('england'))   return 'GBP';
    if (loc.includes(' us') || loc.includes('usa') || loc.includes('united states')) return 'USD';
    if (loc.includes('singapore'))  return 'SGD';
    if (loc.includes('australia'))  return 'AUD';
    if (loc.includes('canada'))     return 'CAD';
    return bench?.currency ?? 'INR';
  };

  // Not-ready or locked state
  if (!hasProfile || !isReady || !bench) {
    return (
      <div className={cn('card-v3 overflow-hidden', className)}>
        <div className="absolute left-0 top-0 h-1 w-full rounded-t-xl bg-green-500" />
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/35">Salary Benchmark</p>
              {targetRole && (
                <p className="mt-0.5 text-sm font-semibold text-white/70">{targetRole}</p>
              )}
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-50">
              <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <p className="text-sm font-medium text-white/45">
              {!hasProfile
                ? 'Complete your profile to see salary benchmarks'
                : 'Calculating salary benchmark…'
              }
            </p>
          </div>
        </div>
      </div>
    );
  }

  const currency = resolveCurrency();

  return (
    <div className={cn('relative card-v3 overflow-hidden', className)}>
      {/* Accent bar */}
      <div className="absolute left-0 top-0 h-1 w-full bg-green-500" />

      <div className="p-5 pt-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/35">Salary Benchmark</p>
            {targetRole && (
              <p className="mt-0.5 text-sm font-semibold text-white/82">{targetRole}</p>
            )}
            {(user as any)?.location && (
              <p className="text-[11px] text-white/35">{(user as any).location}</p>
            )}
          </div>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-50 shrink-0">
            <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          </div>
        </div>

        {/* Range display */}
        <div className="mt-3">
          <p className="text-2xl font-black tracking-tight text-white/88">
            {formatCurrency(bench.marketP25, currency)}
            <span className="text-surface-300 font-light mx-2">—</span>
            {formatCurrency(bench.marketP75, currency)}
          </p>
          <p className="text-xs text-white/35 mt-0.5">Typical range for your role</p>
        </div>

        {/* Percentile bar */}
        <PercentileBar
          p25={bench.marketP25}
          p75={bench.marketP75}
          median={bench.marketMedian}
          percentile={bench.percentile}
          currency={currency}
        />

        {/* Your estimate */}
        {bench.yourEstimate != null && (
          <div className="mt-4 rounded-lg bg-white/4 px-4 py-3">
            <p className="text-[11px] text-white/35 uppercase tracking-widest font-semibold">Your Estimated Value</p>
            <p className="mt-0.5 text-lg font-black text-hr-400">
              {formatCurrency(bench.yourEstimate, currency)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}