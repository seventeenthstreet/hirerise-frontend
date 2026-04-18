'use client';

// components/career/CareerProbabilityBreakdown.tsx
// Phase 7 — Career Probability breakdown panel used in the Career Simulator.
// Accepts overrideBreakdown, baseBreakdown, and showDelta props.

import { type ProbabilityFactors } from '@/lib/careerProbability';
import { cn } from '@/utils/cn';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CareerProbabilityBreakdownProps {
  overrideBreakdown: ProbabilityFactors;
  baseBreakdown:     ProbabilityFactors;
  showDelta?:        boolean;
  className?:        string;
}

// ─── Factor row ───────────────────────────────────────────────────────────────

function FactorRow({
  label,
  icon,
  base,
  current,
  showDelta,
}: {
  label:     string;
  icon:      string;
  base:      number;
  current:   number;
  showDelta: boolean;
}) {
  const delta = Math.round(current - base);
  const color =
    current >= 70 ? 'bg-green-500' :
    current >= 40 ? 'bg-amber-400' :
                    'bg-red-400';
  const textColor =
    current >= 70 ? 'text-green-600' :
    current >= 40 ? 'text-amber-600' :
                    'text-red-500';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{icon}</span>
          <span className="text-xs font-semibold text-surface-700">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {showDelta && delta !== 0 && (
            <span className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-black',
              delta > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600',
            )}>
              {delta > 0 ? '+' : ''}{delta}%
            </span>
          )}
          <span className={cn('text-xs font-black tabular-nums', textColor)}>
            {Math.round(current)}
          </span>
        </div>
      </div>

      {/* Bar */}
      <div className="relative h-2.5 w-full rounded-full bg-surface-100 overflow-hidden">
        {/* Base bar (ghost) */}
        {showDelta && (
          <div
            className="absolute top-0 left-0 h-full rounded-full bg-surface-200 transition-all duration-500"
            style={{ width: `${Math.min(100, base)}%` }}
          />
        )}
        {/* Current bar */}
        <div
          className={cn('absolute top-0 left-0 h-full rounded-full transition-all duration-700', color)}
          style={{ width: `${Math.min(100, current)}%`, opacity: showDelta ? 0.85 : 1 }}
        />
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

const FACTORS: { key: keyof ProbabilityFactors; label: string; icon: string }[] = [
  { key: 'skills',     label: 'Skills Match',  icon: '🎯' },
  { key: 'education',  label: 'Education',     icon: '🎓' },
  { key: 'demand',     label: 'Market Demand', icon: '📈' },
  { key: 'experience', label: 'Experience',    icon: '💼' },
];

export function CareerProbabilityBreakdown({
  overrideBreakdown,
  baseBreakdown,
  showDelta = false,
  className,
}: CareerProbabilityBreakdownProps) {
  return (
    <div className={cn(
      'rounded-xl border border-surface-100 bg-white shadow-card p-5',
      className,
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-surface-400">
          Probability Breakdown
        </h3>
        {showDelta && (
          <span className="text-[10px] font-semibold text-surface-400">
            Gray = baseline
          </span>
        )}
      </div>

      {/* Factor rows */}
      <div className="space-y-4">
        {FACTORS.map(({ key, label, icon }) => (
          <FactorRow
            key={key}
            label={label}
            icon={icon}
            base={baseBreakdown[key]}
            current={overrideBreakdown[key]}
            showDelta={showDelta}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-5 flex items-center gap-4 border-t border-surface-50 pt-4">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-[10px] text-surface-400">Strong ≥70</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <span className="text-[10px] text-surface-400">Moderate 40–69</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-400" />
          <span className="text-[10px] text-surface-400">Weak &lt;40</span>
        </div>
      </div>
    </div>
  );
}