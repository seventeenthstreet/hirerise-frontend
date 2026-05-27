'use client';

/**
 * @file components/student-onboarding/steps/SafeProcessingStep.tsx
 *
 * SAFE PROCESSING STEP
 * ─────────────────────
 * Phase 2 replacement for the processing step that PREVENTS deadlocks
 * and redirect loops.
 *
 * THE PROBLEM:
 *   - After aspiration is submitted, session.currentStep = 'processing'
 *   - The AI engine is not yet implemented → session never advances to 'result'
 *   - session.isComplete stays false → page never redirects to /dashboard
 *   - Result: infinite polling loop between /education/onboarding and /dashboard
 *
 * THE FIX:
 *   1. Show the processing animation for PROCESSING_ANIMATION_MS (3s — feels real)
 *   2. Then show a brief "Wrapping up…" state for REDIRECT_DELAY_MS (1.5s)
 *   3. Navigate to /dashboard — onboarding is functionally complete even without
 *      the AI result (the result step is Phase 3)
 *   4. NO permanent spinners. NO dead-end screens. NO redirect loops.
 *
 * PHASE 3 UPGRADE PATH:
 *   When the intelligence engine ships:
 *   1. Remove the auto-redirect timeout entirely.
 *   2. Enable session polling via refetchInterval on useStudentOnboardingSession.
 *   3. The page's `resume.isComplete` useEffect will handle the redirect naturally
 *      when session advances to 'result' and isComplete flips to true.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** How long to show the animated spinner (feels responsive, not instant). */
const PROCESSING_ANIMATION_MS = 3_000;

/** Brief pause on "Wrapping up…" before navigating — prevents jarring flash. */
const REDIRECT_DELAY_MS = 1_500;

const PROCESSING_MESSAGES = [
  'Reviewing your education background…',
  'Mapping your academic strengths…',
  'Analysing your activities and interests…',
  'Preparing your recommendations…',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// REDIRECT STATE
// Shown briefly before navigating to dashboard.
// ─────────────────────────────────────────────────────────────────────────────

function RedirectingState() {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-12 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
        <svg
          className="h-6 w-6 text-green-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-base font-semibold text-foreground">
        Profile saved!
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Taking you to your dashboard…
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SafeProcessingStep
 *
 * Shows the processing animation briefly, then navigates to /dashboard.
 * Prevents the infinite redirect loop caused by session.isComplete never
 * flipping to true when the AI engine is not yet implemented.
 */
export function SafeProcessingStep() {
  const router = useRouter();
  const [messageIndex, setMessageIndex] = useState(0);
  const [phase, setPhase] = useState<'animating' | 'redirecting'>('animating');

  // Cycle through messages during the animation phase
  useEffect(() => {
    if (phase !== 'animating') return;
    const interval = setInterval(() => {
      setMessageIndex((prev) =>
        prev < PROCESSING_MESSAGES.length - 1 ? prev + 1 : prev,
      );
    }, 700);
    return () => clearInterval(interval);
  }, [phase]);

  // Phase 1 → Phase 2: animation → redirecting
  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase('redirecting');
    }, PROCESSING_ANIMATION_MS);
    return () => clearTimeout(timer);
  }, []);

  // Phase 2 → navigate: redirecting → /dashboard
  useEffect(() => {
    if (phase !== 'redirecting') return;
    const timer = setTimeout(() => {
      router.replace('/dashboard');
    }, REDIRECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [phase, router]);

  // ── Redirecting state ────────────────────────────────────────────────────
  if (phase === 'redirecting') {
    return <RedirectingState />;
  }

  // ── Animation state ──────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-12 text-center"
      role="status"
      aria-live="polite"
    >
      {/* Animated ring */}
      <div className="relative mb-6 h-16 w-16" aria-hidden="true">
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        <div className="absolute inset-2 flex items-center justify-center">
          <svg
            className="h-7 w-7 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        </div>
      </div>

      <h2 className="text-base font-semibold text-foreground">
        Building your career profile
      </h2>
      <p className="mt-2 min-h-[1.5rem] text-sm text-muted-foreground transition-all duration-500">
        {PROCESSING_MESSAGES[messageIndex]}
      </p>

      {/* Progress dots */}
      <div className="mt-6 flex gap-1" aria-hidden="true">
        {PROCESSING_MESSAGES.map((_, i) => (
          <span
            key={i}
            className={[
              'h-1.5 rounded-full transition-all duration-300',
              i === messageIndex ? 'w-6 bg-primary' : 'w-1.5 bg-muted',
            ].join(' ')}
          />
        ))}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Almost done — just a moment.
      </p>
    </div>
  );
}