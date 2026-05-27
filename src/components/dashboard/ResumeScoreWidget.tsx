/**
 * components/dashboard/ResumeScoreWidget.tsx
 *
 * Displays the resume score (GET /api/v1/resume-scores/me).
 * Shows a CTA to upload a resume if resume_uploaded = false.
 */

import React from 'react';
import type { ResumeScore } from '@/hooks/useResumeScore';

interface ResumeScoreWidgetProps {
  score: ResumeScore | null;
  isLoading: boolean;
  error: Error | null;
  resumeUploaded: boolean;
}

function gradeColour(grade?: string): string {
  if (!grade) return 'text-muted-foreground';
  const g = grade[0].toUpperCase();
  if (g === 'A') return 'text-green-500';
  if (g === 'B') return 'text-amber-500';
  return 'text-red-500';
}

export const ResumeScoreWidget = React.memo(function ResumeScoreWidget({
  score,
  isLoading,
  error,
  resumeUploaded,
}: ResumeScoreWidgetProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm animate-pulse">
        <div className="h-4 w-32 rounded bg-muted mb-4" />
        <div className="h-16 w-16 rounded-full bg-muted mx-auto" />
      </div>
    );
  }

  if (!resumeUploaded) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-2 text-base font-semibold text-foreground">Resume Score</h2>
        <p className="text-sm text-muted-foreground">
          <a href="/resume" className="underline hover:text-foreground">
            Upload a resume
          </a>{' '}
          to get your score.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 shadow-sm">
        <p className="text-sm text-destructive">Could not load resume score.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-foreground">Resume Score</h2>

      {score ? (
        <div className="flex flex-col items-center gap-2">
          <span className={`text-4xl font-bold tabular-nums ${gradeColour(score.grade)}`}>
            {score.grade ?? score.score}
          </span>
          <span className="text-xs text-muted-foreground">out of 100</span>

          {score.breakdown && (
            <ul className="mt-3 w-full space-y-1">
              {Object.entries(score.breakdown).map(([key, val]) => (
                <li key={key} className="flex items-center justify-between text-xs">
                  <span className="capitalize text-muted-foreground">{key}</span>
                  <span className="text-foreground">{val}</span>
                </li>
              ))}
            </ul>
          )}

          {score.cached && (
            <p className="mt-2 text-xs text-muted-foreground">Cached result</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Score not available yet.</p>
      )}
    </div>
  );
});

ResumeScoreWidget.displayName = 'ResumeScoreWidget';