'use client';

/**
 * @file front/src/modules/student-onboarding/steps/activities-step.tsx
 *
 * ACTIVITIES STEP — Phase 3B
 * ══════════════════════════════════════════════════
 * Full multi-substep activities & achievement intelligence collection.
 *
 * SUBSTEP FLOW (managed internally — does NOT advance onboarding session):
 *   1. ActivityDiscovery   — search + select activities from taxonomy
 *   2. ParticipationDepth  — per-activity: proficiency, duration, frequency
 *   3. Achievements        — per-activity: add competition results
 *   4. LeadershipReview    — confirm/update leadership role per activity
 *   5. ReflectionSignals   — optional: favourite, proudest, pursue seriously
 *   [Continue] → commitActivities() → advances session to 'cognitive'
 *
 * DATA FLOW:
 *   Server is authoritative. Each substep persists immediately.
 *   No giant form submission — progressive persistence throughout.
 *
 * HARDENING:
 *   • One-time substep restoration from server data (hasRestoredSubstep guard)
 *   • Stale selection recovery when selected activity is deleted
 *   • Leadership interaction locked during delete/refetch windows (Issue 4A)
 */

import { useState, useCallback, useEffect } from 'react';
import type { OnboardingStepProps } from '../constants/step-props';

import {
  useActivitiesStep,
  useAddActivity,
  useUpdateActivityDepth,
  useDeleteActivity,
  useAddAchievement,
  useDeleteAchievement,
  useSaveReflection,
  useCommitActivities,
} from '../activities/hooks/use-activities';

import { ActivityDiscovery }  from '../activities/components/ActivityDiscovery';
import { ParticipationDepth } from '../activities/components/ParticipationDepth';
import { AchievementsPanel }  from '../activities/components/AchievementsPanel';
import { LeadershipReview }   from '../activities/components/LeadershipReview';
import { ReflectionSignals }  from '../activities/components/ReflectionSignals';
import { ActivitiesProgress } from '../activities/components/ActivitiesProgress';

// ─────────────────────────────────────────────────────────────────────────────
// SUBSTEP DEFINITION
// ─────────────────────────────────────────────────────────────────────────────

type Substep = 'discovery' | 'depth' | 'achievements' | 'leadership' | 'reflection';

const SUBSTEP_ORDER: Substep[] = [
  'discovery',
  'depth',
  'achievements',
  'leadership',
  'reflection',
];

const SUBSTEP_LABELS: Record<Substep, string> = {
  discovery:    'Activities',
  depth:        'Participation',
  achievements: 'Achievements',
  leadership:   'Leadership',
  reflection:   'Reflection',
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function ActivitiesStep({ onComplete, isBusy }: OnboardingStepProps) {
  const [currentSubstep, setCurrentSubstep] = useState<Substep>('discovery');
  const [selectedActivityKey, setSelectedActivityKey] = useState<string | null>(null);

  // Guard: prevents substep restoration from re-firing after user navigation.
  const [hasRestoredSubstep, setHasRestoredSubstep] = useState(false);

  const { data, isLoading, isError, error, isRefetching } = useActivitiesStep();

  // ── One-time substep restoration from server data ──────────────────────────
  // Derives the furthest substep reached from persisted server state, so a
  // hard refresh does not reset the student to 'discovery'.
  //
  // Derivation rules (most-advanced wins):
  //   hasLeadership → 'leadership'
  //   hasAchievements → 'achievements'
  //   committedCount > 0 → 'depth'
  //   activities exist → 'discovery' (no change)
  //
  // hasRestoredSubstep prevents this from overwriting user navigation.
  useEffect(() => {
    if (hasRestoredSubstep || isLoading || !data) return;

    const { signalQuality, achievementMap } = data;

    let restoredSubstep: Substep = 'discovery';

    if (signalQuality.hasLeadership) {
      restoredSubstep = 'leadership';
    } else if (achievementMap.size > 0) {
      restoredSubstep = 'achievements';
    } else if (signalQuality.committedCount > 0) {
      restoredSubstep = 'depth';
    }

    if (restoredSubstep !== 'discovery') {
      setCurrentSubstep(restoredSubstep);
    }

    setHasRestoredSubstep(true);
  }, [isLoading, data, hasRestoredSubstep]);

  const addActivity       = useAddActivity();
  const updateDepth       = useUpdateActivityDepth();
  const deleteActivity    = useDeleteActivity();
  const addAchievement    = useAddAchievement();
  const deleteAchievement = useDeleteAchievement();
  const saveReflection    = useSaveReflection();
  const commitActivities  = useCommitActivities();

  // Issue 4A: Lock leadership interactions while a delete is in-flight or while
  // the activities query is actively refetching (post-delete invalidation window).
  // This prevents stale-closure 404 mutations against deleted activities.
  const isLeadershipLocked = deleteActivity.isPending || isRefetching;

  // ── Navigation helpers ─────────────────────────────────────────────────────

  const goToSubstep = useCallback((substep: Substep) => {
    setCurrentSubstep(substep);
    setSelectedActivityKey(null);
  }, []);

  const goNext = useCallback(() => {
    const currentIdx = SUBSTEP_ORDER.indexOf(currentSubstep);
    if (currentIdx < SUBSTEP_ORDER.length - 1) {
      setCurrentSubstep(SUBSTEP_ORDER[currentIdx + 1]);
      setSelectedActivityKey(null);
    }
  }, [currentSubstep]);

  // ── Final commit ───────────────────────────────────────────────────────────

  async function handleCommit() {
    const result = await commitActivities.mutateAsync();
    await onComplete({ next_step: result.next_step });
  }

  // ── Loading & error states ─────────────────────────────────────────────────

  if (isLoading) {
    return <ActivitiesStepSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Failed to load activities. {(error as Error)?.message}
      </div>
    );
  }

  const hasActivities       = data.activities.length > 0;
  const currentSubstepIndex = SUBSTEP_ORDER.indexOf(currentSubstep);

  return (
    <div className="space-y-4">
      {/* Substep progress indicator */}
      <ActivitiesProgress
        substeps={SUBSTEP_ORDER}
        labels={SUBSTEP_LABELS}
        currentSubstep={currentSubstep}
        onNavigate={(s) => {
          if (SUBSTEP_ORDER.indexOf(s) < currentSubstepIndex) {
            goToSubstep(s);
          }
        }}
      />

      {/* Substep 1: Activity Discovery */}
      {currentSubstep === 'discovery' && (
        <ActivityDiscovery
          taxonomy={data.taxonomy}
          selectedActivities={data.activities}
          signalQuality={data.signalQuality}
          onAdd={(activityKey, category) =>
            addActivity.mutateAsync({
              activityKey,
              activityCategory: category,
              isPartial: true,
            })
          }
          onRemove={(activityKey) => deleteActivity.mutateAsync(activityKey)}
          isAdding={addActivity.isPending}
          isRemoving={deleteActivity.isPending}
          onNext={() => {
            if (hasActivities) goNext();
          }}
        />
      )}

      {/* Substep 2: Participation Depth */}
      {currentSubstep === 'depth' && (
        <ParticipationDepth
          activities={data.activities}
          selectedActivityKey={selectedActivityKey}
          onSelectActivity={setSelectedActivityKey}
          onSaveDepth={(activityKey, depthInput) =>
            updateDepth.mutateAsync({ activityKey, input: { ...depthInput, isPartial: false } })
          }
          isSaving={updateDepth.isPending}
          onNext={goNext}
        />
      )}

      {/* Substep 3: Achievements */}
      {currentSubstep === 'achievements' && (
        <AchievementsPanel
          activities={data.activities}
          achievementMap={data.achievementMap}
          selectedActivityKey={selectedActivityKey}
          onSelectActivity={setSelectedActivityKey}
          onAddAchievement={(activityKey, input) =>
            addAchievement.mutateAsync({ activityKey, input })
          }
          onDeleteAchievement={(achievementId) => deleteAchievement.mutateAsync(achievementId)}
          isAdding={addAchievement.isPending}
          isDeleting={deleteAchievement.isPending}
          onNext={goNext}
        />
      )}

      {/* Substep 4: Leadership Review */}
      {currentSubstep === 'leadership' && (
        <LeadershipReview
          activities={data.activities}
          onUpdateLeadership={(activityKey, leadershipLevel) => {
            const activity = data.activities.find((a) => a.activityKey === activityKey);
            if (!activity) return Promise.resolve();
            return updateDepth.mutateAsync({
              activityKey,
              input: {
                activityCategory: activity.activityCategory,
                proficiencyLevel: activity.proficiencyLevel ?? 'beginner',
                currentlyActive:  activity.currentlyActive,
                leadershipLevel,
                isPartial: false,
              },
            });
          }}
          isSaving={updateDepth.isPending || isLeadershipLocked}
          onNext={goNext}
        />
      )}

      {/* Substep 5: Reflection (optional) + Final Commit */}
      {currentSubstep === 'reflection' && (
        <ReflectionSignals
          activities={data.activities}
          onSaveReflection={(input) => saveReflection.mutateAsync(input)}
          onCommit={handleCommit}
          isSavingReflection={saveReflection.isPending}
          isCommitting={commitActivities.isPending || isBusy}
          signalQuality={data.signalQuality}
          commitError={
            commitActivities.error ? (commitActivities.error as Error).message : null
          }
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────────────────────

function ActivitiesStepSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-full rounded-lg bg-muted" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-10 w-32 rounded-lg bg-muted" />
    </div>
  );
}
