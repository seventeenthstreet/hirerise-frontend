/**
 * components/dashboard/CHIScoreWidget.tsx
 *
 * Displays the Career Health Index (CHI) score.
 * Pure display component — all data fetched by dashboard page via useCareerHealth.
 *
 * States:
 *   loading          → skeleton
 *   dependenciesMet=false → nudge cards for missing prerequisites
 *   score available  → score ring + snapshot
 *   error            → inline error (does not crash page)
 */

import React from 'react';
import type { CHISnapshot } from '@/hooks/useCareerHealth';

interface MissingItems {
  resume: boolean;
  skills: boolean;
  targetRole: boolean;
}

interface CHIScoreWidgetProps {
  chiScore: number | null;
  chiSnapshot: CHISnapshot | null;
  isLoading: boolean;
  error: Error | null;
  dependenciesMet: boolean;
  missingItems?: MissingItems;
  /** Feature-flag controlled widget variant. Defaults to 'v1'. */
  version?: 'v1' | 'v2';
}

// ── Helper: score → colour class ─────────────────────────────────────────────

function scoreColour(score: number): string {
  if (score >= 80) return 'text-green-500';
  if (score >= 60) return 'text-amber-500';
  return 'text-red-500';
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Needs work';
}

// ── Component ─────────────────────────────────────────────────────────────────

export const CHIScoreWidget = React.memo(function CHIScoreWidget({
  chiScore,
  chiSnapshot,
  isLoading,
  error,
  dependenciesMet,
  missingItems,
  version = 'v1',
}: CHIScoreWidgetProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm animate-pulse">
        <div className="h-5 w-40 rounded bg-muted mb-4" />
        <div className="flex items-center gap-6">
          <div className="h-24 w-24 rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-3/4 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 shadow-sm">
        <p className="text-sm text-destructive">
          Unable to load your Career Health Index. Please refresh.
        </p>
      </div>
    );
  }

  // Missing prerequisites nudge
  if (!dependenciesMet || chiScore === null) {
    const missing = missingItems ?? { resume: true, skills: false, targetRole: false };
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-foreground">
          Career Health Index
        </h2>
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-5">
          <p className="mb-3 text-sm font-medium text-foreground">
            Complete these steps to unlock your CHI score:
          </p>
          <ul className="space-y-2">
            {missing.resume && (
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="text-amber-500">⬡</span>
                <a href="/resume" className="underline hover:text-foreground">
                  Upload your resume
                </a>
              </li>
            )}
            {missing.skills && (
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="text-amber-500">⬡</span>
                <a href="/skills" className="underline hover:text-foreground">
                  Add skills to your profile
                </a>
              </li>
            )}
            {missing.targetRole && (
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="text-amber-500">⬡</span>
                <a href="/settings" className="underline hover:text-foreground">
                  Set your target role
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>
    );
  }

  const topSkills = chiSnapshot?.topSkills?.slice(0, 3) ?? [];

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-foreground">
        Career Health Index
      </h2>

      <div className="flex items-center gap-6">
        {/* Score ring */}
        <div className="flex flex-col items-center">
          <span className={`text-5xl font-bold tabular-nums ${scoreColour(chiScore)}`}>
            {chiScore}
          </span>
          <span className="mt-1 text-xs text-muted-foreground">
            {scoreLabel(chiScore)}
          </span>
        </div>

        {/* Top skills */}
        {topSkills.length > 0 && (
          <div className="flex-1">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Top skills
            </p>
            <ul className="space-y-1">
              {topSkills.map((skill) => (
                <li key={skill.id} className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{skill.name}</span>
                  <span className="text-xs text-muted-foreground">{skill.score}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {chiSnapshot?.lastUpdated && (
        <p className="mt-4 text-xs text-muted-foreground">
          Last updated {new Date(chiSnapshot.lastUpdated).toLocaleDateString()}
        </p>
      )}
    </div>
  );
});

CHIScoreWidget.displayName = 'CHIScoreWidget';