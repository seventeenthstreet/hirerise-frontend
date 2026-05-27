'use client';

/**
 * @file front/src/modules/student-onboarding/activities/components/AchievementsPanel.tsx
 *
 * SUBSTEP 3: Achievements
 * ════════════════════════
 * Repeatable achievement entry per activity.
 * Optional substep — students may skip any or all activities.
 *
 * UX PRINCIPLES:
 *   • Activity list on left; achievement editor on right (same pattern as depth)
 *   • "+ Add Achievement" button reveals inline form
 *   • Achievements displayed as cards — can be deleted individually
 *   • Empty state is friendly — no pressure to add
 *
 * HARDENING:
 *   • Auto-selects first activity when none is selected
 *   • Recovers from stale selectedActivityKey when the selected activity is deleted
 */

import { useState, useEffect } from 'react';
import type {
  StudentActivity,
  Achievement,
  AchievementLevel,
  AchievementPosition,
  AddAchievementInput,
} from '../types';
import {
  ACHIEVEMENT_LEVELS,
  ACHIEVEMENT_LEVEL_LABELS,
  ACHIEVEMENT_POSITIONS,
  ACHIEVEMENT_POSITION_LABELS,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

interface AchievementsPanelProps {
  activities:          StudentActivity[];
  achievementMap:      Map<string, Achievement[]>;
  selectedActivityKey: string | null;
  onSelectActivity:    (key: string) => void;
  onAddAchievement:    (activityKey: string, input: AddAchievementInput) => Promise<unknown>;
  onDeleteAchievement: (achievementId: string) => Promise<unknown>;
  isAdding:            boolean;
  isDeleting:          boolean;
  onNext:              () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function AchievementsPanel({
  activities,
  achievementMap,
  selectedActivityKey,
  onSelectActivity,
  onAddAchievement,
  onDeleteAchievement,
  isAdding,
  isDeleting,
  onNext,
}: AchievementsPanelProps) {
  const [showForm, setShowForm] = useState(false);

  const selectedActivity   = activities.find((a) => a.activityKey === selectedActivityKey) ?? null;
  const selectedActivityId = selectedActivity?.id ?? null;
  const achievements       = selectedActivityId
    ? (achievementMap.get(selectedActivityId) ?? [])
    : [];

  // Auto-select first activity when none selected, and recover from stale
  // selection when the previously selected activity has been deleted.
  useEffect(() => {
    if (activities.length === 0) return;
    const stillExists = activities.some((a) => a.activityKey === selectedActivityKey);
    if (!stillExists) {
      onSelectActivity(activities[0].activityKey);
    }
  }, [selectedActivityKey, activities, onSelectActivity]);

  const totalAchievements = Array.from(achievementMap.values()).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border">
        <h2 className="text-base font-semibold text-foreground">Achievements</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add any competitions, awards or recognitions — even small ones count.
          <span className="ml-1 text-xs">(optional)</span>
        </p>
      </div>

      <div className="flex flex-col sm:flex-row">
        {/* Activity sidebar */}
        <div className="sm:w-48 sm:flex-shrink-0 border-b sm:border-b-0 sm:border-r border-border">
          <ul className="py-2">
            {activities.map((act) => {
              const achCount = achievementMap.get(act.id)?.length ?? 0;
              return (
                <li key={act.activityKey}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectActivity(act.activityKey);
                      setShowForm(false);
                    }}
                    className={[
                      'flex w-full items-center justify-between px-4 py-2.5 text-sm text-left transition-colors',
                      selectedActivityKey === act.activityKey
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-foreground hover:bg-muted/40',
                    ].join(' ')}
                  >
                    <span className="truncate flex-1 capitalize">
                      {act.activityKey.replace(/_/g, ' ')}
                    </span>
                    {achCount > 0 && (
                      <span className="ml-2 flex-shrink-0 rounded-full bg-primary/20 px-1.5 py-0.5 text-xs font-semibold text-primary">
                        {achCount}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Achievement panel */}
        <div className="flex-1 px-5 py-5 space-y-4">
          {selectedActivity ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground capitalize">
                  {selectedActivity.activityKey.replace(/_/g, ' ')}
                </h3>
                {!showForm && (
                  <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-1 rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                  >
                    + Add Achievement
                  </button>
                )}
              </div>

              {/* Achievement list */}
              {achievements.length > 0 && (
                <div className="space-y-2">
                  {achievements.map((ach) => (
                    <AchievementCard
                      key={ach.id}
                      achievement={ach}
                      onDelete={() => onDeleteAchievement(ach.id)}
                      isDeleting={isDeleting}
                    />
                  ))}
                </div>
              )}

              {/* Empty state */}
              {achievements.length === 0 && !showForm && (
                <p className="text-sm text-muted-foreground py-2">
                  No achievements added yet for this activity.
                </p>
              )}

              {/* Add form */}
              {showForm && (
                <AchievementForm
                  onSubmit={async (input) => {
                    await onAddAchievement(selectedActivity.activityKey, input);
                    setShowForm(false);
                  }}
                  onCancel={() => setShowForm(false)}
                  isSubmitting={isAdding}
                />
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select an activity on the left.</p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {totalAchievements} achievement{totalAchievements !== 1 ? 's' : ''} added total
        </p>
        <button
          type="button"
          onClick={onNext}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Next: Leadership →
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AchievementCard
// ─────────────────────────────────────────────────────────────────────────────

function AchievementCard({
  achievement,
  onDelete,
  isDeleting,
}: {
  achievement: Achievement;
  onDelete:    () => void;
  isDeleting:  boolean;
}) {
  return (
    <div className="flex items-start justify-between rounded-lg border border-border bg-muted/20 px-4 py-3 gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {achievement.achievementTitle}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {ACHIEVEMENT_LEVEL_LABELS[achievement.achievementLevel]}
          {achievement.achievementPosition &&
            ` · ${ACHIEVEMENT_POSITION_LABELS[achievement.achievementPosition]}`}
          {achievement.achievementYear && ` · ${achievement.achievementYear}`}
        </p>
      </div>
      <button
        type="button"
        onClick={onDelete}
        disabled={isDeleting}
        className="flex-shrink-0 rounded p-1 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
        aria-label="Delete achievement"
      >
        🗑
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AchievementForm — inline form for adding a new achievement
// ─────────────────────────────────────────────────────────────────────────────

interface AchievementFormProps {
  onSubmit:     (input: AddAchievementInput) => Promise<void>;
  onCancel:     () => void;
  isSubmitting: boolean;
}

function AchievementForm({ onSubmit, onCancel, isSubmitting }: AchievementFormProps) {
  const [title,    setTitle]    = useState('');
  const [level,    setLevel]    = useState<AchievementLevel | ''>('');
  const [position, setPosition] = useState<AchievementPosition | ''>('');
  const [year,     setYear]     = useState<string>('');
  const [error,    setError]    = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) { setError('Please enter a title.'); return; }
    if (!level)        { setError('Please select a level.'); return; }

    try {
      await onSubmit({
        achievementTitle:    title.trim(),
        achievementLevel:    level as AchievementLevel,
        achievementPosition: position ? (position as AchievementPosition) : null,
        achievementYear:     year ? parseInt(year, 10) : null,
      });
    } catch (err) {
      setError((err as Error).message ?? 'Failed to save achievement.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3"
    >
      <h4 className="text-sm font-medium text-foreground">New Achievement</h4>

      {/* Title */}
      <div>
        <label className="mb-1 block text-xs font-medium text-foreground">
          Title <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="e.g. Inter-school Robotics Championship"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
        />
      </div>

      {/* Level + Position */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">
            Level <span className="text-destructive">*</span>
          </label>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as AchievementLevel | '')}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
          >
            <option value="">Select…</option>
            {ACHIEVEMENT_LEVELS.map((l) => (
              <option key={l} value={l}>{ACHIEVEMENT_LEVEL_LABELS[l]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">
            Position{' '}
            <span className="text-xs font-normal text-muted-foreground">(optional)</span>
          </label>
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value as AchievementPosition | '')}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
          >
            <option value="">Select…</option>
            {ACHIEVEMENT_POSITIONS.map((p) => (
              <option key={p} value={p}>{ACHIEVEMENT_POSITION_LABELS[p]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Year */}
      <div>
        <label className="mb-1 block text-xs font-medium text-foreground">
          Year{' '}
          <span className="text-xs font-normal text-muted-foreground">(optional)</span>
        </label>
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          min={2000}
          max={new Date().getFullYear() + 1}
          placeholder="e.g. 2024"
          className="w-32 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isSubmitting ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Saving…
            </>
          ) : (
            'Add Achievement'
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
