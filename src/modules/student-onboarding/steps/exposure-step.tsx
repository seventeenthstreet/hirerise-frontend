

/**
 * @file src/modules/student-onboarding/steps/exposure-step.tsx
 *
 * STEP 5 — EXPOSURE & ACTIVITIES (Phase 1 MVP Implementation)
 * ════════════════════════════════════════════════════════════
 * Discovers hidden strengths beyond academics.
 *
 * UX APPROACH:
 *  - Emoji-led activity tiles — feels exploratory, not clinical
 *  - "I've explored this" framing — inclusive of partial exposure
 *  - Hours commitment indicator (optional)
 *  - Leadership role flag (optional)
 *
 * DATA CONTRACT:
 *   onComplete({ activities, hoursPerWeek, hasLeadershipRole })
 *   → useUpdateOnboardingStep mutation (advances to 'financial')
 */

import { useState } from 'react';
import type { OnboardingStepProps } from '../constants/step-props';
import type { ExposureActivityId } from '../api/student-onboarding.types';
import { EXPOSURE_ACTIVITIES } from '../api/student-onboarding.types';

const HOURS_OPTIONS = [
  { value: 'less_2',  label: 'Under 2 hrs/week' },
  { value: '2_5',     label: '2–5 hrs/week' },
  { value: '5_10',    label: '5–10 hrs/week' },
  { value: 'over_10', label: '10+ hrs/week' },
] as const;

export default function ExposureStep({ onComplete, isBusy, initialData }: OnboardingStepProps) {
  const [activities, setActivities] = useState<ExposureActivityId[]>(
    (initialData?.activities as ExposureActivityId[]) ?? [],
  );
  const [hoursPerWeek, setHoursPerWeek] = useState<string>(
    (initialData?.hoursPerWeek as string) ?? '',
  );
  const [hasLeadershipRole, setHasLeadershipRole] = useState<boolean | null>(
    initialData?.hasLeadershipRole != null ? Boolean(initialData.hasLeadershipRole) : null,
  );
  const [error, setError] = useState<string | null>(null);

  function toggleActivity(id: ExposureActivityId) {
    if (id === 'none') {
      setActivities(activities.includes('none') ? [] : ['none']);
      return;
    }
    setActivities((prev) => {
      const without = prev.filter((a) => a !== 'none');
      return without.includes(id)
        ? without.filter((a) => a !== id)
        : [...without, id];
    });
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (activities.length === 0) {
      setError('Please select at least one activity, or "None of the above yet".');
      return;
    }

    await onComplete({
      activities,
      hoursPerWeek: hoursPerWeek || null,
      hasLeadershipRole,
    });
  }

  const hasNone = activities.includes('none');

  return (
    <div className="rounded-xl border border-border bg-card px-6 py-6">
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xl">🌟</span>
          <h2 className="text-base font-semibold text-foreground">Beyond the Classroom</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          What have you explored outside of school? Even brief exposure counts — this reveals hidden strengths.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">

        {/* Activity tiles */}
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            I've explored or am interested in…
          </p>
          <div
            role="group"
            aria-label="Select activities you've explored"
            className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          >
            {EXPOSURE_ACTIVITIES.map((activity) => {
              const isSelected = activities.includes(activity.id as ExposureActivityId);
              const isDisabled = hasNone && activity.id !== 'none';

              return (
                <button
                  key={activity.id}
                  type="button"
                  aria-pressed={isSelected}
                  disabled={isDisabled}
                  onClick={() => toggleActivity(activity.id as ExposureActivityId)}
                  className={`
                    flex items-center gap-2.5 rounded-xl border p-3 text-left text-sm transition-all
                    ${isSelected
                      ? 'border-primary bg-primary/5 text-primary font-medium ring-2 ring-primary/30'
                      : isDisabled
                        ? 'cursor-not-allowed border-border bg-muted/20 text-muted-foreground opacity-40'
                        : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/20'
                    }
                  `}
                >
                  <span className="text-lg leading-none shrink-0" aria-hidden="true">
                    {activity.emoji}
                  </span>
                  <span className="text-xs leading-tight">{activity.label}</span>
                </button>
              );
            })}
          </div>
          {activities.length > 0 && !hasNone && (
            <p className="mt-2 text-xs text-muted-foreground">
              {activities.length} selected
            </p>
          )}
        </div>

        {/* Hours per week — only if non-none activities selected */}
        {!hasNone && activities.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">
              How much time do you spend on these activities? <span className="font-normal text-muted-foreground">(optional)</span>
            </p>
            <div
              role="group"
              aria-label="Weekly hours for activities"
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {HOURS_OPTIONS.map((opt) => {
                const isSelected = hoursPerWeek === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setHoursPerWeek(isSelected ? '' : opt.value)}
                    className={`
                      rounded-lg border px-3 py-2 text-xs font-medium transition-all
                      ${isSelected
                        ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/30'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                      }
                    `}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Leadership role */}
        {!hasNone && activities.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">
              Have you held any leadership role (captain, head, president, organiser)?{' '}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </p>
            <div className="flex gap-2">
              {[
                { value: true,  label: 'Yes' },
                { value: false, label: 'Not yet' },
              ].map((opt) => {
                const isSelected = hasLeadershipRole === opt.value;
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setHasLeadershipRole(isSelected ? null : opt.value)}
                    className={`
                      rounded-lg border px-4 py-2 text-sm font-medium transition-all
                      ${isSelected
                        ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/30'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                      }
                    `}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isBusy || activities.length === 0}
          aria-busy={isBusy}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isBusy ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              Saving…
            </span>
          ) : (
            'Continue to Planning →'
          )}
        </button>
      </form>
    </div>
  );
}
