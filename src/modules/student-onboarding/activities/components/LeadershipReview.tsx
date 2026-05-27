'use client';

/**
 * @file LeadershipReview.tsx
 *
 * SUBSTEP 4: Leadership & Responsibility
 * ════════════════════════════════════════
 * A focused, quick pass over all activities to confirm/update leadership role.
 * Presented as a card-scan — one card per activity, tap to change role.
 */

import { useState } from 'react';
import type { StudentActivity, LeadershipLevel, UpdateDepthInput } from '../types';
import { LEADERSHIP_LEVELS, LEADERSHIP_LABELS } from '../types';

interface LeadershipReviewProps {
  activities:         StudentActivity[];
  onUpdateLeadership: (activityKey: string, level: LeadershipLevel) => Promise<unknown>;
  isSaving:           boolean;
  onNext:             () => void;
}

export function LeadershipReview({
  activities,
  onUpdateLeadership,
  isSaving,
  onNext,
}: LeadershipReviewProps) {
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  async function handleChange(activityKey: string, level: LeadershipLevel) {
    setPendingKey(activityKey);
    try {
      await onUpdateLeadership(activityKey, level);
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="text-base font-semibold text-foreground">Leadership & Responsibility</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Did you hold any leadership or organising role in these activities?
        </p>
      </div>

      <div className="divide-y divide-border">
        {activities.map((act) => (
          <div key={act.activityKey} className="px-5 py-4 space-y-2">
            <p className="text-sm font-medium text-foreground capitalize">
              {act.activityKey.replace(/_/g, ' ')}
            </p>
            <div className="flex flex-wrap gap-2">
              {LEADERSHIP_LEVELS.map((level) => {
                const isSelected = act.leadershipLevel === level;
                const isPending  = pendingKey === act.activityKey;

                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => handleChange(act.activityKey, level)}
                    disabled={isSaving && !isPending}
                    className={[
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      isSelected
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    ].join(' ')}
                  >
                    {LEADERSHIP_LABELS[level]}
                    {isPending && level === act.leadershipLevel && (
                      <span className="ml-1 inline-block h-2.5 w-2.5 animate-spin rounded-full border border-primary/30 border-t-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="px-5 py-4 border-t border-border">
        <button
          type="button"
          onClick={onNext}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Next: Reflection →
        </button>
      </div>
    </div>
  );
}
