'use client';

/**
 * @file features/student-onboarding/hooks/use-resume-onboarding.ts
 *
 * HOOK: useResumeOnboarding
 * ──────────────────────────
 * Handles session resume logic for students returning mid-flow.
 *
 * RESPONSIBILITIES:
 *   ✅ Detects an incomplete, in-progress session
 *   ✅ Provides a stable isResuming flag for loading guards
 *   ✅ Detects stale sessions (older than STALE_SESSION_THRESHOLD_MS)
 *   ✅ Exposes resume metadata for shell UI (step label, progress)
 *
 * WHAT THIS HOOK DOES NOT DO:
 *   ❌ No routing — page owns navigation
 *   ❌ No session creation — that happens on first step submit
 *   ❌ No mutation — read-only
 *
 * RESUME FLOW:
 *   1. User arrives at /education/onboarding
 *   2. useStudentOnboardingSession fetches session
 *   3. useResumeOnboarding inspects session state:
 *      - null session → fresh start (isResuming = false)
 *      - session.isComplete → redirect to /dashboard
 *      - session with completedSteps → resume mid-flow (isResuming = true)
 *   4. Shell displays "Resuming your profile..." while isSessionLoading
 *   5. Step router renders session.currentStep automatically
 *
 * STALE SESSION DETECTION:
 *   Sessions older than 7 days are considered stale.
 *   The shell can surface a "Your session may be outdated" warning.
 *   Stale sessions are NOT deleted — the user can still resume them.
 *   Deletion requires an explicit backend operation (future Phase 4).
 */

import { useMemo } from 'react';
import type { OnboardingSession } from '@/modules/student-onboarding';
import { STUDENT_ONBOARDING_STEPS } from '@/modules/student-onboarding';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Sessions older than 7 days are flagged as stale. */
const STALE_SESSION_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1_000;

// ─────────────────────────────────────────────────────────────────────────────
// RETURN TYPE
// ─────────────────────────────────────────────────────────────────────────────

export interface UseResumeOnboardingReturn {
  /**
   * True when the user has a partially-completed session.
   * False for first-time users and for completed sessions.
   */
  isResuming: boolean;

  /**
   * True when the session is complete.
   * The page should redirect to /dashboard.
   */
  isComplete: boolean;

  /**
   * True when the session exists but has not been started
   * (completedSteps is empty, currentStep is 'education').
   */
  isFreshSession: boolean;

  /**
   * True when the session's updatedAt is older than STALE_SESSION_THRESHOLD_MS.
   * Shell can display a soft warning to the user.
   */
  isStaleSession: boolean;

  /**
   * Human-readable label of the step the user will resume at.
   * e.g. "Education" | "Academics" | …
   * Null when no session or session not yet loaded.
   */
  resumeStepLabel: string | null;

  /**
   * ISO timestamp of when the session was last updated.
   * Null when no session exists.
   */
  lastActivityAt: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyzes a student's onboarding session to determine resume state.
 *
 * @param session  The current session from useStudentOnboardingSession.
 *                 Pass null while loading or when no session exists.
 *
 * @example
 * const { session } = useStudentOnboardingSession();
 * const resume = useResumeOnboarding(session);
 *
 * if (resume.isComplete) {
 *   router.replace('/dashboard');
 *   return null;
 * }
 *
 * if (resume.isResuming) {
 *   // Show "Welcome back! Resuming from {resume.resumeStepLabel}"
 * }
 */
export function useResumeOnboarding(
  session: OnboardingSession | null,
): UseResumeOnboardingReturn {

  return useMemo(() => {
    // No session — first-time user
    if (!session) {
      return {
        isResuming:      false,
        isComplete:      false,
        isFreshSession:  false,
        isStaleSession:  false,
        resumeStepLabel: null,
        lastActivityAt:  null,
      };
    }

    const isComplete      = session.isComplete;
    const hasCompletedAny = session.completedSteps.length > 0;

    // A fresh session: exists in DB but user hasn't submitted any step yet.
    // This happens when createOnboardingSession() was called but no step data saved.
    const isFreshSession = !isComplete && !hasCompletedAny;

    // A resuming session: partially completed.
    const isResuming = !isComplete && hasCompletedAny;

    // Staleness check: compare session updatedAt against the threshold
    let isStaleSession = false;
    if (session.updatedAt) {
      try {
        const lastUpdate = new Date(session.updatedAt).getTime();
        const now = Date.now();
        isStaleSession = now - lastUpdate > STALE_SESSION_THRESHOLD_MS;
      } catch {
        // Malformed updatedAt — don't flag as stale
        isStaleSession = false;
      }
    }

    // Resolve the human-readable label for the current step
    const resumeStepLabel =
      STUDENT_ONBOARDING_STEPS.find((s) => s.id === session.currentStep)?.label ?? null;

    return {
      isResuming,
      isComplete,
      isFreshSession,
      isStaleSession,
      resumeStepLabel,
      lastActivityAt: session.updatedAt ?? null,
    };
  }, [session]);
}
