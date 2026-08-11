/**
 * @file src/modules/student-onboarding/page.tsx
 *
 * STUDENT ONBOARDING PAGE
 * ═══════════════════════════
 * Orchestrates the student-specific onboarding flow.
 *
 * HARDENING ADDITIONS:
 *   ✅ Route-level recovery via OnboardingRecoveryScreen
 *   ✅ Polling guard via useEffect (does NOT alter useStudentOnboardingSession signature)
 *   ✅ No permanent loading states
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/context/AppContext';
import { PageLoading } from '@/components/ui';
import {
  useStudentOnboardingSession,
  useSaveEducationProfile,
  useUpdateOnboardingStep,
  OnboardingStepRenderer,
  STUDENT_ONBOARDING_STEPS,
  COMPLETABLE_STEP_ENTRIES,
  getProgressPercent,
} from '@/modules/student-onboarding';
import type {
  OnboardingStep,
  CompletableStep,
  SaveEducationProfileInput,
} from '@/modules/student-onboarding';
import { OnboardingRecoveryScreen } from '@/components/student-onboarding/recovery/OnboardingRecoveryScreen';
import { computePollingInterval } from '@/features/student-onboarding/lib/polling-guard';

// ─────────────────────────────────────────────────────────────────────────────
// PAGE GUARD LAYER
// ─────────────────────────────────────────────────────────────────────────────

export default function StudentOnboardingPage() {
  const { user, isHydrated } = useAppContext();

  if (!isHydrated) return <PageLoading label="Loading…" />;
  if (!user || user.user_type !== 'student') return null;

  return <StudentOnboardingContent />;
}

// ─────────────────────────────────────────────────────────────────────────────
// INNER CONTENT
// ─────────────────────────────────────────────────────────────────────────────

function StudentOnboardingContent() {
  const navigate = useNavigate();

  // useStudentOnboardingSession takes NO args — 0-argument contract preserved.
  const {
    session,
    isLoading: sessionLoading,
    isError: sessionError,
    error: sessionErrorObj,
    refetch: refetchSession,
  } = useStudentOnboardingSession();

  const currentStepId = (session?.currentStep ?? 'education') as OnboardingStep;

  // ── Polling guard — useEffect-based, no hook signature changes ────────────
  const { refetchInterval } = computePollingInterval(
    currentStepId,
    session?.isComplete ?? false,
  );

  useEffect(() => {
    if (refetchInterval === false) return;
    const timer = setInterval(() => { refetchSession(); }, refetchInterval);
    return () => clearInterval(timer);
    // refetchSession is stable; refetchInterval changes only when step changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetchInterval]);

  // ── Mutation hooks ────────────────────────────────────────────────────────
  const { saveAsync: saveEducation, isPending: isSavingEducation } =
    useSaveEducationProfile();
  const { updateAsync: advanceStep, isPending: isAdvancingStep } =
    useUpdateOnboardingStep();
  const isBusy = isSavingEducation || isAdvancingStep;

  // ── Progress ──────────────────────────────────────────────────────────────
  const progressPercent = useMemo(
    () => getProgressPercent(session?.completedSteps ?? []),
    [session?.completedSteps],
  );
  const completedCount = useMemo(
    () => COMPLETABLE_STEP_ENTRIES.filter(
      (e) => session?.completedSteps?.includes(e.id as CompletableStep) ?? false,
    ).length,
    [session?.completedSteps],
  );
  const totalCount = COMPLETABLE_STEP_ENTRIES.length;

  // ── Step completion dispatch ──────────────────────────────────────────────
  const handleStepComplete = useCallback(
    async (data: Record<string, unknown>) => {
      const currentStep = session?.currentStep;
      if (!currentStep) return;

      switch (currentStep) {
        case 'education':
          await saveEducation(data as unknown as SaveEducationProfileInput);
          break;
        case 'academics':
        case 'cognitive': {
          const nextStepIndex =
            STUDENT_ONBOARDING_STEPS.findIndex((s) => s.id === currentStep) + 1;
          const nextStep = STUDENT_ONBOARDING_STEPS[nextStepIndex]?.id as OnboardingStep;
          if (nextStep) {
            await advanceStep({ completedStep: currentStep as CompletableStep, nextStep });
          }
          break;
        }
        case 'activities':
          // Activities step advances session server-side on commit.
          // Only refetch — do NOT call advanceStep again (would double-advance).
          await refetchSession();
          break;
        case 'aspiration':
          await advanceStep({
            completedStep: 'aspiration' as CompletableStep,
            nextStep: 'processing' as OnboardingStep,
          });
          break;
        case 'result':
          navigate('/onboarding/student/academics', { replace: true });
          break;
        default:
          break;
      }
    },
    // refetchSession is intentionally omitted: it is defined as an inline arrow in
    // useStudentOnboardingSession's return object, making it a new reference each render.
    // Adding it would recreate handleStepComplete (and re-render all step children) every
    // render. Fix in Phase 3C.4: wrap refetch in useCallback inside the session hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session?.currentStep, saveEducation, advanceStep, navigate],
  );

  // ── Recovery guard ────────────────────────────────────────────────────────
  if (sessionError) {
    const scenario = sessionErrorObj?.category === 'auth' ? 'unauthorized' : 'fetch_failed';
    return <OnboardingRecoveryScreen scenario={scenario} onRetry={refetchSession} />;
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (sessionLoading) {
    return <PageLoading label="Loading your onboarding…" />;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Build your student profile
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tell us about yourself so we can match you with the right career paths.
        </p>
      </header>

      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Student profile setup</span>
          <span>{completedCount} of {totalCount} steps</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-1.5 rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <ol className="mt-4 flex items-center gap-2">
          {STUDENT_ONBOARDING_STEPS.filter((s) => !s.isSystemStep).map((entry) => {
            const isCompleted = session?.completedSteps?.includes(entry.id as CompletableStep) ?? false;
            const isCurrent   = currentStepId === entry.id;
            return (
              <li
                key={entry.id}
                title={entry.label}
                className={[
                  'flex-1 h-1 rounded-full transition-colors',
                  isCompleted ? 'bg-primary' : isCurrent ? 'bg-primary/40' : 'bg-muted',
                ].join(' ')}
              />
            );
          })}
        </ol>
        <p className="mt-2 text-xs text-muted-foreground">
          {STUDENT_ONBOARDING_STEPS.find((s) => s.id === currentStepId)?.label ?? currentStepId}
        </p>
      </div>

      <OnboardingStepRenderer
        currentStepId={currentStepId}
        onComplete={handleStepComplete}
        isBusy={isBusy}
        initialData={undefined}
      />
    </div>
  );
}