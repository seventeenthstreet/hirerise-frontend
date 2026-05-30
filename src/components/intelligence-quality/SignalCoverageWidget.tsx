/**
 * components/intelligence-quality/SignalCoverageWidget.tsx
 *
 * Displays the user's signal coverage score and quality breakdown.
 *
 * States:
 *   loading           → skeleton
 *   no data           → empty state with CTA
 *   suppressed        → warning panel (recommendations paused)
 *   coverage available → score ring + notes + trait gaps
 *
 * Pure display component — data is provided by the caller via props
 * or composed via the useSignalCoverage hook at the page level.
 */

import React from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Skeleton }                      from '@/components/ui/Skeleton';
import type {
  SignalCoverageProfile,
  CoverageExplanation,
  CoverageLevel,
} from '@/lib/api/endpoints/intelligence-quality';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface SignalCoverageWidgetProps {
  coverage:            SignalCoverageProfile | null;
  explanation:         CoverageExplanation   | null;
  suppressRecommendations?: boolean;
  isLoading:           boolean;
  isError:             boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function coverageColour(level: CoverageLevel): string {
  if (level === 'HIGH')   return 'text-green-500';
  if (level === 'MEDIUM') return 'text-amber-500';
  return 'text-red-500';
}

function coverageBgColour(level: CoverageLevel): string {
  if (level === 'HIGH')   return 'bg-green-500';
  if (level === 'MEDIUM') return 'bg-amber-500';
  return 'bg-red-500';
}

function coverageLevelLabel(level: CoverageLevel): string {
  if (level === 'HIGH')   return 'High';
  if (level === 'MEDIUM') return 'Medium';
  return 'Low';
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function CoverageSkeletonState() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </CardContent>
    </Card>
  );
}

function CoverageEmptyState() {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <p className="text-sm text-muted-foreground">
          Complete your assessment to view your signal coverage profile.
        </p>
      </CardContent>
    </Card>
  );
}

function CoverageErrorState() {
  return (
    <Card>
      <CardContent className="py-6 text-center">
        <p className="text-sm text-destructive">
          Unable to load coverage data. Try refreshing.
        </p>
      </CardContent>
    </Card>
  );
}

function SuppressionBanner() {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-300">
      <p className="font-medium">Recommendations paused</p>
      <p className="mt-0.5 text-amber-700 dark:text-amber-400">
        Your assessment needs more data before personalised recommendations can be generated.
        Complete more assessment stages to unlock them.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COVERAGE RING
// ─────────────────────────────────────────────────────────────────────────────

interface CoverageRingProps {
  score: number;
  level: CoverageLevel;
}

function CoverageRing({ score, level }: CoverageRingProps) {
  const radius      = 28;
  const stroke      = 4;
  const size        = (radius + stroke) * 2;
  const circumference = 2 * Math.PI * radius;
  const offset      = circumference - (score / 100) * circumference;

  const colourClass = coverageColour(level);
  const strokeColour = level === 'HIGH' ? '#22c55e' : level === 'MEDIUM' ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        className="-rotate-90"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-muted"
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColour}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      {/* Score label */}
      <span className={`absolute text-sm font-bold tabular-nums ${colourClass}`}>
        {Math.round(score)}%
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function SignalCoverageWidget({
  coverage,
  explanation,
  suppressRecommendations = false,
  isLoading,
  isError,
}: SignalCoverageWidgetProps) {
  if (isLoading)              return <CoverageSkeletonState />;
  if (isError)                return <CoverageErrorState />;
  if (!coverage || !explanation) return <CoverageEmptyState />;

  const { coverageScore, coverageLevel, traitGaps, coverageNotes } = coverage;

  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-semibold text-foreground">Signal Coverage</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          How complete and reliable is your intelligence profile?
        </p>
      </CardHeader>

      <CardContent className="space-y-5">

        {/* Score + level */}
        <div className="flex items-center gap-4">
          <CoverageRing score={coverageScore} level={coverageLevel} />
          <div>
            <p className={`text-2xl font-bold tabular-nums ${coverageColour(coverageLevel)}`}>
              {coverageLevelLabel(coverageLevel)}
            </p>
            <p className="text-xs text-muted-foreground">
              Coverage Level
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Signal breadth</span>
            <span>{Math.round(coverageScore)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${coverageBgColour(coverageLevel)}`}
              style={{ width: `${Math.min(100, coverageScore)}%` }}
              role="progressbar"
              aria-valuenow={Math.round(coverageScore)}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>

        {/* Suppression banner */}
        {suppressRecommendations && <SuppressionBanner />}

        {/* Explanation headline */}
        <p className="text-sm text-foreground">{explanation.headline}</p>

        {/* Coverage notes */}
        {coverageNotes && coverageNotes.length > 0 && (
          <ul className="space-y-1">
            {coverageNotes.map((note, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="mt-0.5 shrink-0 text-green-500" aria-hidden="true">✓</span>
                {note}
              </li>
            ))}
          </ul>
        )}

        {/* Trait gaps */}
        {traitGaps && traitGaps.length > 0 && (
          <div className="rounded-lg bg-muted/40 px-3 py-2.5">
            <p className="mb-1.5 text-xs font-medium text-foreground">Areas needing more data</p>
            <ul className="space-y-1">
              {traitGaps.slice(0, 4).map((gap, i) => (
                <li key={i} className="text-xs text-muted-foreground">
                  {gap.trait}
                  {gap.reason === 'insufficient_samples' && gap.sampleCount !== undefined
                    ? ` (${gap.sampleCount} sample${gap.sampleCount !== 1 ? 's' : ''})`
                    : ' — not yet assessed'}
                </li>
              ))}
              {traitGaps.length > 4 && (
                <li className="text-xs text-muted-foreground">
                  +{traitGaps.length - 4} more
                </li>
              )}
            </ul>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
