'use client';

/**
 * @file components/student-onboarding/steps/StepRouter.tsx
 *
 * STEP ROUTER
 * ────────────
 * Backend-driven step dispatcher. Routes currentStep → rendered component.
 *
 * ARCHITECTURE RULES:
 *   ✅ Routes based on session.currentStep (server-authoritative)
 *   ✅ NEVER routes based on local state
 *   ✅ Renders TemporaryStepPlaceholder for unimplemented steps (Phase 2)
 *   ✅ Renders SafeProcessingStep for 'processing' (no deadlock)
 *   ✅ Step boundary validation BEFORE any routing decision
 *   ✅ Renders UnknownStepFallback for unrecognised steps (no crash, no loop)
 *
 * ROUTING ORDER (must not be reordered):
 *   0. Step boundary validation → UnknownStepFallback if invalid
 *   1. 'processing'             → SafeProcessingStep
 *   2. Unimplemented steps      → TemporaryStepPlaceholder
 *   3. All other known steps    → OnboardingStepRenderer (registry)
 *
 * NOTE:
 *   StepRouter only renders when the shell has already confirmed that:
 *     - Session version is compatible (VersionMismatchScreen not shown)
 *     - No recovery state is active (OnboardingRecoveryScreen not shown)
 *     - Session is not loading (ShellLoadingState not shown)
 *   These guards live in StudentOnboardingShell, NOT here.
 */

import { Suspense } from 'react';
import type { UseStudentOnboardingFlowReturn } from '@/features/student-onboarding/hooks';
import { PHASE2_UNIMPLEMENTED_STEPS } from '@/features/student-onboarding/hooks';
import { TemporaryStepPlaceholder } from '@/components/student-onboarding/shared/TemporaryStepPlaceholder';
import { SafeProcessingStep } from './SafeProcessingStep';
import { UnknownStepFallback } from './UnknownStepFallback';
import { OnboardingStepRenderer } from '@/modules/student-onboarding';
import { captureOnboardingSnapshot } from '@/features/student-onboarding/lib/onboarding-snapshot';

// ─────────────────────────────────────────────────────────────────────────────
// LOADING SKELETON
// ─────────────────────────────────────────────────────────────────────────────

function StepSkeleton() {
  return (
    <div className="animate-pulse space-y-4 rounded-xl border border-border bg-card p-6">
      <div className="h-5 w-1/3 rounded bg-muted" />
      <div className="h-3 w-2/3 rounded bg-muted" />
      <div className="mt-6 space-y-3">
        <div className="h-10 rounded-lg bg-muted" />
        <div className="h-10 rounded-lg bg-muted" />
        <div className="h-10 w-1/2 rounded-lg bg-muted" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface StepRouterProps {
  flow: UseStudentOnboardingFlowReturn;
}

/**
 * StepRouter
 *
 * Reads flow.currentStepId (server-authoritative) and dispatches to the
 * correct component.
 *
 * Step boundary validation runs FIRST — before any switch/case logic.
 * Invalid steps render UnknownStepFallback; a diagnostic event is already
 * emitted by useStudentOnboardingFlow when the invalid step is first observed.
 *
 * @example
 * <StepRouter flow={flow} />
 */
export function StepRouter({ flow }: StepRouterProps) {
  const { currentStepId, handleStepComplete, isBusy, isCurrentStepValid, refetchSession } = flow;

  // ── 0. Step boundary protection (MUST run before all other routing) ───────
  //
  // The diagnostic event (invalid_step_detected) is emitted by
  // useStudentOnboardingFlow. The snapshot is also captured there via the
  // useEffect. This guard only renders the fallback UI — no duplicate capture.
  if (!isCurrentStepValid) {
    // Snapshot is captured in useStudentOnboardingFlow's useEffect for
    // invalid_step_detected — not here — to avoid duplicate captures on
    // each re-render of StepRouter. The deduplication cooldown provides
    // a safety net even if called redundantly.
    captureOnboardingSnapshot({
      scenario:          'invalid_step_detected',
      currentStep:       currentStepId,
      completedSteps:    flow.session?.completedSteps ?? [],
      completionPercent: flow.progressPercent,
      isComplete:        flow.session?.isComplete ?? false,
      engineVersion:     (flow.session as (typeof flow.session) & { engineVersion?: string })?.engineVersion,
      pollingActive:     flow.isProcessingStep,
      processingState:   'invalid_step',
      primaryContext:    currentStepId,
    });
    return (
      <UnknownStepFallback
        stepId={currentStepId}
        onRetry={refetchSession}
      />
    );
  }

  // ── 1. Processing step → safe implementation (no deadlock) ───────────────
  if (currentStepId === 'processing') {
    return <SafeProcessingStep />;
  }

  // ── 2. Unimplemented steps → placeholder (no dead-end) ──────────────────
  if (PHASE2_UNIMPLEMENTED_STEPS.has(currentStepId)) {
    return <TemporaryStepPlaceholder stepId={currentStepId} />;
  }

  // ── 3. Implemented steps → registry renderer ─────────────────────────────
  return (
    <Suspense fallback={<StepSkeleton />}>
      <OnboardingStepRenderer
        currentStepId={currentStepId}
        onComplete={handleStepComplete}
        isBusy={isBusy}
        initialData={undefined}
      />
    </Suspense>
  );
}