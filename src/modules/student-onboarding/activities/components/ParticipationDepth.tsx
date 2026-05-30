

/**
 * @file ParticipationDepth.tsx
 *
 * SUBSTEP 2: Participation Depth
 * ═══════════════════════════════
 * Per-activity: proficiency level, duration, weekly frequency, active status.
 *
 * UX PRINCIPLES:
 *   • One activity at a time — sidebar list + expanded detail panel
 *   • Inline save on each change (no submit button per field)
 *   • Visual progress — shows which activities have depth filled in
 *   • Mobile: stacked layout; Desktop: sidebar + panel
 */

import { useState, useEffect } from 'react';
import type {
  StudentActivity,
  ProficiencyLevel,
  UpdateDepthInput,
} from '../types';
import {
  PROFICIENCY_LEVELS,
  PROFICIENCY_LABELS,
  PROFICIENCY_DESCRIPTIONS,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

interface ParticipationDepthProps {
  activities:          StudentActivity[];
  selectedActivityKey: string | null;
  onSelectActivity:    (key: string) => void;
  onSaveDepth:         (key: string, input: Omit<UpdateDepthInput, 'isPartial'>) => Promise<unknown>;
  isSaving:            boolean;
  onNext:              () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function ParticipationDepth({
  activities,
  selectedActivityKey,
  onSelectActivity,
  onSaveDepth,
  isSaving,
  onNext,
}: ParticipationDepthProps) {
  // Auto-select first activity
  useEffect(() => {
    if (!selectedActivityKey && activities.length > 0) {
      onSelectActivity(activities[0].activityKey);
    }
  }, [activities, selectedActivityKey, onSelectActivity]);

  const selectedActivity = activities.find((a) => a.activityKey === selectedActivityKey) ?? null;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const allDepthFilled = activities.every((a) => !a.isPartial);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border">
        <h2 className="text-base font-semibold text-foreground">Participation Details</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell us how deeply you're involved in each activity.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row min-h-0">
        {/* Activity list sidebar */}
        <div className="sm:w-48 sm:flex-shrink-0 border-b sm:border-b-0 sm:border-r border-border">
          <ul className="py-2">
            {activities.map((act) => (
              <li key={act.activityKey}>
                <button
                  type="button"
                  onClick={() => onSelectActivity(act.activityKey)}
                  className={[
                    'flex w-full items-center justify-between px-4 py-2.5 text-sm text-left transition-colors',
                    selectedActivityKey === act.activityKey
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-foreground hover:bg-muted/40',
                  ].join(' ')}
                >
                  <span className="truncate flex-1">{act.activityKey.replace(/_/g, ' ')}</span>
                  <span className="ml-2 flex-shrink-0 text-xs">
                    {act.isPartial ? (
                      <span className="text-muted-foreground">○</span>
                    ) : (
                      <span className="text-green-500">✓</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Depth form panel */}
        <div className="flex-1 px-5 py-5">
          {selectedActivity ? (
            <DepthForm
              key={selectedActivity.activityKey}
              activity={selectedActivity}
              onSave={(input) => onSaveDepth(selectedActivity.activityKey, input)}
              isSaving={isSaving}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Select an activity on the left.</p>
          )}
        </div>
      </div>

      {/* Footer CTA */}
      <div className="px-5 py-4 border-t border-border flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {activities.filter((a) => !a.isPartial).length}/{activities.length} complete
        </p>
        <button
          type="button"
          onClick={onNext}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Next: Achievements →
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DepthForm — per-activity depth collection form
// ─────────────────────────────────────────────────────────────────────────────

interface DepthFormProps {
  activity: StudentActivity;
  onSave:   (input: Omit<UpdateDepthInput, 'isPartial'>) => Promise<unknown>;
  isSaving: boolean;
}

function DepthForm({ activity, onSave, isSaving }: DepthFormProps) {
  const [proficiency,    setProficiency]    = useState<ProficiencyLevel | ''>(
    activity.proficiencyLevel ?? '',
  );
  const [durationMonths, setDurationMonths] = useState<string>(
    activity.durationMonths != null ? String(activity.durationMonths) : '',
  );
  const [weeklyHours,    setWeeklyHours]    = useState<string>(
    activity.weeklyFrequency != null ? String(activity.weeklyFrequency) : '',
  );
  const [currentlyActive, setCurrentlyActive] = useState<boolean>(activity.currentlyActive);
  const [savedFlash,     setSavedFlash]     = useState(false);

  async function handleSave() {
    if (!proficiency) return;

    await onSave({
      activityCategory: activity.activityCategory,
      proficiencyLevel: proficiency as ProficiencyLevel,
      durationMonths:   durationMonths ? parseInt(durationMonths, 10) : null,
      weeklyFrequency:  weeklyHours    ? parseFloat(weeklyHours)      : null,
      currentlyActive,
      leadershipLevel:  activity.leadershipLevel,
    });

    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  const canSave = !!proficiency;

  return (
    <div className="space-y-5">
      <h3 className="text-sm font-semibold text-foreground capitalize">
        {activity.activityKey.replace(/_/g, ' ')}
      </h3>

      {/* Proficiency */}
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-foreground">
          How skilled are you? <span className="text-destructive">*</span>
        </legend>
        <div className="space-y-2">
          {PROFICIENCY_LEVELS.map((level) => (
            <label
              key={level}
              className={[
                'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                proficiency === level
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/30',
              ].join(' ')}
            >
              <input
                type="radio"
                name={`proficiency-${activity.activityKey}`}
                value={level}
                checked={proficiency === level}
                onChange={() => setProficiency(level)}
                className="mt-0.5 accent-primary"
              />
              <div>
                <span className="text-sm font-medium text-foreground">
                  {PROFICIENCY_LABELS[level]}
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {PROFICIENCY_DESCRIPTIONS[level]}
                </p>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Duration */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          How long have you been doing this?
          <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={durationMonths}
            onChange={(e) => setDurationMonths(e.target.value)}
            min={0}
            max={240}
            placeholder="e.g. 12"
            className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
          />
          <span className="text-sm text-muted-foreground">months</span>
        </div>
      </div>

      {/* Weekly frequency */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Hours per week on average?
          <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={weeklyHours}
            onChange={(e) => setWeeklyHours(e.target.value)}
            min={0}
            max={168}
            step={0.5}
            placeholder="e.g. 5"
            className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
          />
          <span className="text-sm text-muted-foreground">hrs / week</span>
        </div>
      </div>

      {/* Currently active */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={currentlyActive}
          onChange={(e) => setCurrentlyActive(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-primary"
        />
        <span className="text-sm text-foreground">I'm still actively doing this</span>
      </label>

      {/* Save button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave || isSaving}
        className={[
          'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
          savedFlash
            ? 'bg-green-500 text-white'
            : 'bg-primary text-primary-foreground hover:opacity-90',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        ].join(' ')}
      >
        {isSaving ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Saving…
          </>
        ) : savedFlash ? (
          '✓ Saved'
        ) : (
          'Save Details'
        )}
      </button>
    </div>
  );
}
