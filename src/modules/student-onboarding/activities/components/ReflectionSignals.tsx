

/**
 * @file ReflectionSignals.tsx
 *
 * SUBSTEP 5: Reflection Signals (Optional) + Final Commit
 * ════════════════════════════════════════════════════════
 * Lightweight reflection questions:
 *   1. Which activity is your favourite?
 *   2. What's your proudest achievement? (free text, optional)
 *   3. Which activity do you want to pursue seriously?
 *
 * CRITICAL: This component collects structured user input only.
 * DO NOT render recommendations, stream suggestions, or predictions here.
 *
 * After reflection (or if skipped), "Continue" commits the activities step.
 */

import { useState } from 'react';
import type { StudentActivity, ActivitySignalQuality, SaveReflectionInput } from '../types';

interface ReflectionSignalsProps {
  activities:          StudentActivity[];
  onSaveReflection:    (input: SaveReflectionInput) => Promise<unknown>;
  onCommit:            () => Promise<void>;
  isSavingReflection:  boolean;
  isCommitting:        boolean;
  signalQuality:       ActivitySignalQuality;
  commitError:         string | null;
}

export function ReflectionSignals({
  activities,
  onSaveReflection,
  onCommit,
  isSavingReflection,
  isCommitting,
  signalQuality,
  commitError,
}: ReflectionSignalsProps) {
  const [favourite,    setFavourite]    = useState<string>('');
  const [pursueKey,    setPursueKey]    = useState<string>('');
  const [proudestText, setProudestText] = useState<string>('');
  const [saved,        setSaved]        = useState(false);

  async function handleSaveReflection() {
    await onSaveReflection({
      favoriteActivityKey:     favourite     || null,
      pursuesSeriouslyKey:     pursueKey     || null,
      proudestAchievementText: proudestText.trim() || null,
    });
    setSaved(true);
  }

  const hasAnyInput = !!favourite || !!pursueKey || !!proudestText.trim();

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="text-base font-semibold text-foreground">A Quick Reflection</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Three optional questions to help us understand what matters to you most.
        </p>
      </div>

      <div className="px-5 py-5 space-y-6">

        {/* Q1: Favourite activity */}
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            Which of these is your favourite activity?
            <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {activities.map((act) => (
              <button
                key={act.activityKey}
                type="button"
                onClick={() =>
                  setFavourite(favourite === act.activityKey ? '' : act.activityKey)
                }
                className={[
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors capitalize',
                  favourite === act.activityKey
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/30',
                ].join(' ')}
              >
                {act.activityKey.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Q2: Proudest achievement (free text) */}
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            What achievement are you most proud of?
            <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
          </label>
          <textarea
            value={proudestText}
            onChange={(e) => setProudestText(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="e.g. Reached state level in robotics after 2 years of practice…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 resize-none"
          />
          <p className="mt-1 text-right text-xs text-muted-foreground">
            {proudestText.length}/500
          </p>
        </div>

        {/* Q3: Pursue seriously */}
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            Which activity would you most like to pursue seriously?
            <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {activities.map((act) => (
              <button
                key={act.activityKey}
                type="button"
                onClick={() =>
                  setPursueKey(pursueKey === act.activityKey ? '' : act.activityKey)
                }
                className={[
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors capitalize',
                  pursueKey === act.activityKey
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/30',
                ].join(' ')}
              >
                {act.activityKey.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Save reflection (if user has entered anything) */}
        {hasAnyInput && !saved && (
          <button
            type="button"
            onClick={handleSaveReflection}
            disabled={isSavingReflection}
            className="flex items-center gap-2 rounded-lg border border-primary/30 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            {isSavingReflection ? (
              <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />Saving…</>
            ) : '✓ Save Reflection'}
          </button>
        )}

        {saved && (
          <p className="text-xs text-green-600">Reflection saved.</p>
        )}
      </div>

      {/* Commit section */}
      <div className="px-5 py-4 border-t border-border space-y-3">
        {/* Signal quality summary */}
        <div className="rounded-lg bg-muted/30 px-4 py-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground text-sm">Activities summary</p>
          <p>{signalQuality.committedCount} activit{signalQuality.committedCount !== 1 ? 'ies' : 'y'} with full details</p>
          {signalQuality.hasAchievements && <p>✓ Includes competition results</p>}
          {signalQuality.hasLeadership   && <p>✓ Includes leadership roles</p>}
        </div>

        {commitError && (
          <p className="text-sm text-destructive">{commitError}</p>
        )}

        <button
          type="button"
          onClick={onCommit}
          disabled={!signalQuality.isSufficient || isCommitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isCommitting ? (
            <><span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />Saving…</>
          ) : 'Continue →'}
        </button>

        {!signalQuality.isSufficient && (
          <p className="text-center text-xs text-muted-foreground">
            Go back to Activities and add at least one activity to continue.
          </p>
        )}
      </div>
    </div>
  );
}
