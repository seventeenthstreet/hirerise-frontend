'use client';

// components/career/AICareerGuidance.tsx
// Phase 7 — AI Career Guidance component.
// Shows step-by-step recommended actions to improve career probability.
// Data: useCareerHealth() + useProfile()
// Also accepts external result for use inside CareerSimulator.

import { useCareerHealth } from '@/hooks/useCareerHealth';
import { useProfile } from '@/hooks/useProfile';
import {
  calculateCareerProbability,
  type ProbabilityResult,
  type SimulatorOverrides,
} from '@/lib/careerProbability';
import { cn } from '@/utils/cn';

// ─── Category config ──────────────────────────────────────────────────────────

const categoryConfig = {
  skill: {
    dot:   'bg-hr-500',
    badge: 'bg-hr-50 text-hr-600',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  education: {
    dot:   'bg-violet-500',
    badge: 'bg-violet-50 text-violet-600',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M12 14l9-5-9-5-9 5 9 5z" />
      </svg>
    ),
  },
  experience: {
    dot:   'bg-amber-500',
    badge: 'bg-amber-50 text-amber-600',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  resume: {
    dot:   'bg-green-500',
    badge: 'bg-green-50 text-green-600',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
};

// ─── Step item ────────────────────────────────────────────────────────────────

function GuidanceStep({
  step,
  number,
  isLast,
}: {
  step:   ProbabilityResult['improvements'][number];
  number: number;
  isLast: boolean;
}) {
  const cfg = categoryConfig[step.category];

  return (
    <div className="flex gap-3.5">
      {/* Step number + connector */}
      <div className="flex flex-col items-center shrink-0">
        <div className={cn(
          'flex h-7 w-7 items-center justify-center rounded-full text-white text-xs font-black',
          cfg.dot,
        )}>
          {number}
        </div>
        {!isLast && (
          <div className="mt-1.5 w-px flex-1 min-h-[20px] bg-surface-100 rounded-full" />
        )}
      </div>

      {/* Content */}
      <div className={cn('flex-1 min-w-0 pb-4', isLast && 'pb-0')}>
        <div className="flex items-start gap-2 flex-wrap">
          <p className="text-sm font-semibold text-surface-900 leading-snug flex-1">
            {step.action}
          </p>
          <span className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize',
            cfg.badge,
          )}>
            {step.category}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="h-1.5 rounded-full bg-surface-100 overflow-hidden w-16">
              <div
                className="h-full rounded-full bg-green-400"
                style={{ width: `${(step.impact / 20) * 100}%` }}
              />
            </div>
            <span className="text-[11px] font-bold text-green-500">+{step.impact}%</span>
          </div>
          <span className="text-[10px] text-surface-400">probability boost</span>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function GuidanceSkeleton() {
  return (
    <div className="rounded-xl border border-surface-100 bg-white shadow-card p-5 animate-pulse space-y-4">
      <div className="h-3 w-36 rounded bg-surface-100" />
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex gap-3.5">
          <div className="h-7 w-7 rounded-full bg-surface-100 shrink-0" />
          <div className="flex-1 space-y-1.5 pt-1">
            <div className="h-3 w-44 rounded bg-surface-100" />
            <div className="h-2.5 w-24 rounded bg-surface-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface AICareerGuidanceProps {
  /** If provided, skips hook call and uses this result directly (used by simulator) */
  externalResult?: ProbabilityResult;
  /** Simulator overrides context label */
  contextLabel?:  string;
  className?:     string;
}

export function AICareerGuidance({
  externalResult,
  contextLabel,
  className,
}: AICareerGuidanceProps) {
  const { data: chi,     isLoading: chiLoading  } = useCareerHealth();
  const { data: profile, isLoading: profLoading } = useProfile();

  const isLoading = !externalResult && (chiLoading || profLoading);
  if (isLoading) return <GuidanceSkeleton />;

  const user   = profile?.user;
  const result = externalResult ?? calculateCareerProbability(chi, user);

  const { improvements, probability, label, tier } = result;

  const headerColor =
    tier === 'high'   ? 'text-green-600' :
    tier === 'medium' ? 'text-amber-500' :
                        'text-red-500';

  return (
    <div className={cn('rounded-xl border border-surface-100 bg-white shadow-card overflow-hidden', className)}>

      {/* Header */}
      <div className="px-5 py-4 border-b border-surface-50 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-surface-400">
            {contextLabel ? `AI Guidance · ${contextLabel}` : 'AI Career Guidance'}
          </h3>
          <p className="mt-0.5 text-[11px] text-surface-400">
            Personalised steps to improve your probability
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn('text-lg font-black', headerColor)}>{probability}%</span>
          <span className="text-xs text-surface-400 font-medium">{label}</span>
        </div>
      </div>

      {/* Steps */}
      <div className="p-5">
        {improvements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 mb-3">
              <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-green-600">You're on the right track!</p>
            <p className="mt-1 text-xs text-surface-400">No major improvements needed right now.</p>
          </div>
        ) : (
          <div>
            <p className="mb-4 text-xs text-surface-500">
              Complete these steps to increase your probability by up to{' '}
              <span className="font-bold text-green-500">
                +{improvements.reduce((s, i) => s + i.impact, 0)}%
              </span>
            </p>
            {improvements.map((step, i) => (
              <GuidanceStep
                key={step.action}
                step={step}
                number={i + 1}
                isLast={i === improvements.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
