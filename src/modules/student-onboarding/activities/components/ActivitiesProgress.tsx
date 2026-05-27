'use client';

import React from 'react';

/**
 * @file ActivitiesProgress.tsx
 *
 * SUBSTEP PROGRESS INDICATOR
 * ════════════════════════════
 * Visual breadcrumb of the 5 internal activity substeps.
 * Clicking a previous substep navigates back.
 */

type Substep = 'discovery' | 'depth' | 'achievements' | 'leadership' | 'reflection';

interface ActivitiesProgressProps {
  substeps:       Substep[];
  labels:         Record<Substep, string>;
  currentSubstep: Substep;
  onNavigate:     (substep: Substep) => void;
}

export function ActivitiesProgress({
  substeps,
  labels,
  currentSubstep,
  onNavigate,
}: ActivitiesProgressProps) {
  const currentIndex = substeps.indexOf(currentSubstep);

  return (
    <nav
      aria-label="Activity substep progress"
      className="flex items-center gap-1 overflow-x-auto pb-1"
    >
      {substeps.map((step, idx) => {
        const isCompleted = idx < currentIndex;
        const isCurrent   = idx === currentIndex;
        const canNavigate = idx < currentIndex;

        return (
          <div key={step} className="flex items-center gap-1 min-w-0">
            <button
              type="button"
              onClick={() => canNavigate && onNavigate(step)}
              disabled={!canNavigate}
              className={[
                'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap',
                isCurrent
                  ? 'bg-primary text-primary-foreground'
                  : isCompleted
                    ? 'text-primary hover:bg-primary/10 cursor-pointer'
                    : 'text-muted-foreground cursor-default',
              ].join(' ')}
            >
              {isCompleted && <span className="text-xs">✓</span>}
              {labels[step]}
            </button>

            {idx < substeps.length - 1 && (
              <span
                className={[
                  'text-xs flex-shrink-0',
                  idx < currentIndex ? 'text-primary/40' : 'text-muted-foreground/30',
                ].join(' ')}
              >
                /
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}