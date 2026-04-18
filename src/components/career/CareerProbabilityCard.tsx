'use client';

// components/career/CareerProbabilityCard.tsx
// Phase 7 — Career Probability Engine card for dashboard.
// Shows the user's composite career probability score + top improvements.
// Data: useCareerHealth() + useProfile()

import Link from 'next/link';
import { useCareerHealth } from '@/hooks/useCareerHealth';
import { useProfile }      from '@/hooks/useProfile';
import { useHasResume }    from '@/hooks/useHasResume';
import { useTargetRole }   from '@/hooks/useTargetRole';
import { calculateCareerProbability } from '@/lib/careerProbability';
import { cn } from '@/utils/cn';

// ─── Gauge arc ────────────────────────────────────────────────────────────────
// Half-circle arc gauge (180°). Score 0-100.

function GaugeArc({ score, size = 120 }: { score: number; size?: number }) {
  const r       = size * 0.38;
  const cx      = size / 2;
  const cy      = size * 0.54;
  const circ    = Math.PI * r;          // half circumference
  const pct     = Math.min(100, Math.max(0, score));
  const filled  = (pct / 100) * circ;
  const color   =
    pct >= 70 ? '#22c55e' :
    pct >= 40 ? '#f59e0b' :
               '#f87171';

  // Arc path: left to right, bottom half of circle
  const startX = cx - r;
  const endX   = cx + r;
  const arcY   = cy;

  return (
    <svg width={size} height={size * 0.6} viewBox={`0 0 ${size} ${size * 0.6}`}>
      {/* Track */}
      <path
        d={`M ${startX} ${arcY} A ${r} ${r} 0 0 1 ${endX} ${arcY}`}
        fill="none"
        stroke="#f1f3f9"
        strokeWidth={size * 0.07}
        strokeLinecap="round"
      />
      {/* Filled */}
      <path
        d={`M ${startX} ${arcY} A ${r} ${r} 0 0 1 ${endX} ${arcY}`}
        fill="none"
        stroke={color}
        strokeWidth={size * 0.07}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circ}`}
        style={{ transition: 'stroke-dasharray 0.8s ease-out' }}
      />
      {/* Score label */}
      <text
        x={cx}
        y={arcY - size * 0.03}
        textAnchor="middle"
        fontSize={size * 0.22}
        fontWeight="900"
        fill={color}
        fontFamily="inherit"
      >
        {pct}%
      </text>
    </svg>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ProbSkeleton() {
  return (
    <div className="relative card-v3 overflow-hidden animate-pulse">
      <div className="absolute left-0 top-0 h-1 w-full bg-white/8 rounded-t-xl" />
      <div className="p-5 pt-6">
        <div className="h-3 w-32 rounded bg-white/8 mb-4" />
        <div className="flex flex-col items-center py-4 gap-3">
          <div className="h-16 w-32 rounded bg-white/8" />
          <div className="h-4 w-24 rounded-full bg-white/8" />
        </div>
        <div className="space-y-2 mt-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-3 w-full rounded bg-white/8" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface CareerProbabilityCardProps {
  className?: string;
}

export function CareerProbabilityCard({ className }: CareerProbabilityCardProps) {
  const { data: chi,     isLoading: chiLoading  } = useCareerHealth();
  const { data: profile, isLoading: profLoading } = useProfile();
  const { hasResume }                              = useHasResume();

  // FIX: use CV-derived role, not stale onboarding targetRole
  const { targetRole } = useTargetRole();

  if (chiLoading || profLoading) return <ProbSkeleton />;

  const user   = profile?.user;
  const result = calculateCareerProbability(chi, user);

  const accentColor =
    result.tier === 'high'   ? 'bg-green-500/100' :
    result.tier === 'medium' ? 'bg-amber-400' :
                               'bg-red-400';

  const tierBadge =
    result.tier === 'high'   ? 'bg-green-500/10 text-green-400 border-green-500/20' :
    result.tier === 'medium' ? 'bg-amber-500/10 text-amber-400 border-amber-100' :
                               'bg-red-500/10 text-red-400 border-red-100';

  const hasData = !!chi?.isReady;

  return (
    <div className={cn(
      'relative card-v3 overflow-hidden',
      className,
    )}>
      {/* Accent bar */}
      <div className={cn('absolute left-0 top-0 h-1 w-full rounded-t-xl', accentColor)} />

      <div className="p-5 pt-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/35">
              Career Probability
            </p>
            {targetRole ? (
              <p className="mt-0.5 text-sm font-bold text-white/82">{targetRole}</p>
            ) : (
              <p className="mt-0.5 text-xs text-white/35 italic">Set a target role in your profile</p>
            )}
          </div>
          <Link
            href="/career-simulator"
            className="shrink-0 rounded-lg border border-hr-500/20 bg-hr-500/10 px-3 py-1.5 text-[11px] font-semibold text-hr-400 hover:bg-hr-100 transition-colors"
          >
            Simulate →
          </Link>
        </div>

        {/* Gauge */}
        <div className="flex flex-col items-center py-2">
          {hasData ? (
            <>
              <GaugeArc score={result.probability} size={140} />
              <span className={cn(
                'mt-1 rounded-full border px-3 py-1 text-xs font-semibold',
                tierBadge,
              )}>
                {result.label}
              </span>
            </>
          ) : (
            <div className="flex flex-col items-center py-6 text-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/4">
                {hasResume ? (
                  <svg className="h-5 w-5 text-hr-300 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-surface-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                )}
              </div>
              <p className="text-sm font-medium text-white/45">
                {hasResume ? 'Calculating your career probability…' : 'Upload your resume to unlock'}
              </p>
            </div>
          )}
        </div>

        {/* Improvements */}
        {result.improvements.length > 0 && (
          <div className="mt-4 border-t border-white/5 pt-4">
            <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-white/35">
              Top improvements
            </p>
            <ul className="space-y-2">
              {result.improvements.slice(0, 3).map(imp => (
                <li key={imp.action} className="flex items-start gap-2">
                  <span className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full bg-hr-100 flex items-center justify-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-hr-500/100" />
                  </span>
                  <span className="text-xs text-white/55 leading-snug">{imp.action}</span>
                  <span className="shrink-0 ml-auto text-[10px] font-bold text-green-500">+{imp.impact}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}