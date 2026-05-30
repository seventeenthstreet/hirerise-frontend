/**
 * hooks/onboarding/useOnboardingFlow.ts
 *
 * Onboarding flow orchestrator hook.
 *
 * RESPONSIBILITY:
 *   Owns the local step-navigation state for a defined set of steps.
 *   Extracted from the repeated orchestration logic in:
 *     - career/onboarding/page.tsx (activeStep, completedSteps, activeIndex, formDataRef)
 *     - /onboarding/page.tsx (currentStep managed through useOnboarding)
 *
 * PROVIDES:
 *   - Active step tracking
 *   - Completed steps set
 *   - Step advance / previous navigation
 *   - Accumulated form data management (ref-based, no re-render on data change)
 *   - Step index helpers
 *   - Terminal step detection
 *
 * DOES NOT OWN:
 *   - Backend API calls (stays in useOnboarding)
 *   - Analytics (stays in the page/content layer)
 *   - Quota logic (stays in the page/content layer)
 *   - Auth gating (stays in the page guard layer)
 *   - React Query semantics
 *
 * IMPORTANT:
 *   This hook is generic over StepId. The page passes the STEPS array
 *   and the initial step — the hook does not know about career/student variants.
 */

import { useState, useCallback, useRef } from 'react';
/**
 * Minimal step shape required by the flow hook.
 * The full OnboardingStepDef (with component, validate, etc.) satisfies this.
 * Flows that haven't migrated to full OnboardingStepDef can pass plain { id } arrays.
 */
export interface OnboardingFlowStep {
  id: string;
  isTerminal?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface UseOnboardingFlowOptions {
  /** Ordered step definitions for this flow. */
  steps: OnboardingFlowStep[];
  /** Initial step id. Defaults to steps[0].id */
  initialStepId?: string;
}

export interface UseOnboardingFlowReturn {
  /** Currently active step id. */
  activeStepId: string;
  /** Index of the active step (0-based). */
  activeIndex: number;
  /** Set of completed step ids. */
  completedSteps: Set<string>;
  /** The active step definition object. */
  activeStep: OnboardingFlowStep | undefined;
  /** Whether the active step is the last in the flow. */
  isTerminalStep: boolean;
  /** Whether there is a previous step to go back to. */
  canGoBack: boolean;
  /**
   * Advance to the next step and mark the current step as complete.
   * Does NOT call any API — the page owns API interactions.
   */
  advanceStep: (stepId: string) => void;
  /**
   * Go back to the previous step.
   * Removes the current step from completedSteps.
   */
  goBack: () => void;
  /**
   * Jump directly to a specific step by id.
   * Used for server-driven navigation (e.g. restore from progress).
   */
  jumpToStep: (stepId: string) => void;
  /**
   * Merge data into the accumulated form payload.
   * Ref-based — does not trigger re-renders.
   */
  mergeFormData: (data: Record<string, unknown>) => void;
  /**
   * Get the full accumulated form data.
   */
  getFormData: () => Record<string, unknown>;
  /**
   * Seed completedSteps from server-restored progress.
   */
  restoreProgress: (completedStepIds: string[]) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useOnboardingFlow({
  steps,
  initialStepId,
}: UseOnboardingFlowOptions): UseOnboardingFlowReturn {
  const firstStepId = steps[0]?.id ?? '';

  const [activeStepId, setActiveStepId] = useState<string>(
    initialStepId ?? firstStepId,
  );
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  // Accumulated form data — ref to avoid re-renders on every field change.
  const formDataRef = useRef<Record<string, unknown>>({});

  // ── Derived ──────────────────────────────────────────────────────────────
  const activeIndex = steps.findIndex((s) => s.id === activeStepId);
  const activeStep  = steps[activeIndex];
  const isTerminalStep =
    activeStep?.isTerminal === true ||
    activeIndex === steps.length - 1;
  const canGoBack = activeIndex > 0;

  // ── Navigation ────────────────────────────────────────────────────────────

  const advanceStep = useCallback(
    (stepId: string) => {
      setCompletedSteps((prev) => {
        const next = new Set(prev);
        next.add(stepId);
        return next;
      });

      const currentIndex = steps.findIndex((s) => s.id === stepId);
      const nextIndex = currentIndex + 1;
      if (nextIndex < steps.length) {
        setActiveStepId(steps[nextIndex].id);
      }
    },
    [steps],
  );

  const goBack = useCallback(() => {
    if (!canGoBack) return;
    const prevStep = steps[activeIndex - 1];
    if (!prevStep) return;

    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.delete(activeStepId);
      return next;
    });
    setActiveStepId(prevStep.id);
  }, [canGoBack, activeIndex, steps, activeStepId]);

  const jumpToStep = useCallback((stepId: string) => {
    const exists = steps.some((s) => s.id === stepId);
    if (exists) {
      setActiveStepId(stepId);
    }
  }, [steps]);

  // ── Form data ─────────────────────────────────────────────────────────────

  const mergeFormData = useCallback((data: Record<string, unknown>) => {
    formDataRef.current = { ...formDataRef.current, ...data };
  }, []);

  const getFormData = useCallback((): Record<string, unknown> => {
    return { ...formDataRef.current };
  }, []);

  // ── Progress restore ──────────────────────────────────────────────────────

  const restoreProgress = useCallback(
    (completedStepIds: string[]) => {
      const validIds = completedStepIds.filter((id) =>
        steps.some((s) => s.id === id),
      );
      setCompletedSteps(new Set(validIds));

      // Navigate to the step after the last completed
      const lastCompleted = validIds.at(-1);
      const lastIdx = steps.findIndex((s) => s.id === lastCompleted);
      if (lastIdx !== -1 && lastIdx + 1 < steps.length) {
        setActiveStepId(steps[lastIdx + 1].id);
      }
    },
    [steps],
  );

  return {
    activeStepId,
    activeIndex,
    completedSteps,
    activeStep,
    isTerminalStep,
    canGoBack,
    advanceStep,
    goBack,
    jumpToStep,
    mergeFormData,
    getFormData,
    restoreProgress,
  };
}
