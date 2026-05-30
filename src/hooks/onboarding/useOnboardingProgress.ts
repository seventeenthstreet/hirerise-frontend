/**
 * hooks/onboarding/useOnboardingProgress.ts
 *
 * Progress calculation hook for onboarding flows.
 *
 * RESPONSIBILITY:
 *   Derives all progress-related display values from the flow state.
 *   Extracted from the duplicated progress logic in:
 *     - OnboardingSteps.tsx (completedCount, totalCount, progressPct)
 *     - career/onboarding/page.tsx (inline Math.round((completedSteps.size / ...) * 100))
 *
 * This is a pure derived-state hook — no API calls, no side effects.
 *
 * PROVIDES:
 *   - completedCount, totalCount (for step counters)
 *   - progressPercent (0–100, integer)
 *   - isComplete (all non-terminal steps done)
 *   - stepsRemaining
 */

import { useMemo } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface UseOnboardingProgressOptions {
  /** Total step count (including terminal step). */
  totalSteps: number;
  /**
   * Completed step count.
   * For flows with a terminal step, pass completedSteps.size (excludes terminal).
   */
  completedCount: number;
  /**
   * Number of steps that count toward "complete".
   * Defaults to totalSteps - 1 (excludes terminal submit step).
   */
  progressableSteps?: number;
}

export interface UseOnboardingProgressReturn {
  completedCount: number;
  totalCount: number;
  progressableCount: number;
  progressPercent: number;
  stepsRemaining: number;
  isComplete: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useOnboardingProgress({
  totalSteps,
  completedCount,
  progressableSteps,
}: UseOnboardingProgressOptions): UseOnboardingProgressReturn {
  return useMemo(() => {
    const progressableCount =
      progressableSteps !== undefined
        ? progressableSteps
        : Math.max(totalSteps - 1, 0); // exclude terminal step by default

    const progressPercent =
      progressableCount > 0
        ? Math.round((completedCount / progressableCount) * 100)
        : 0;

    const stepsRemaining = Math.max(progressableCount - completedCount, 0);
    const isComplete = completedCount >= progressableCount;

    return {
      completedCount,
      totalCount: totalSteps,
      progressableCount,
      progressPercent,
      stepsRemaining,
      isComplete,
    };
  }, [totalSteps, completedCount, progressableSteps]);
}
