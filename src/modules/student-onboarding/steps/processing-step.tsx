'use client';

/**
 * @file src/modules/student-onboarding/steps/processing-step.tsx
 *
 * PROCESSING STEP (System-Driven)
 * ════════════════════════════════
 * Shown while the AI scoring engine processes the student's profile.
 * This is NOT a data-entry step — it auto-advances when processing completes.
 *
 * The backend sets currentStep = 'processing' immediately after 'aspiration'
 * is submitted, then advances to 'result' when the engine job completes.
 *
 * BEHAVIOUR:
 *   - Renders an animated processing indicator.
 *   - Polls the session hook (via staleTime / refetch interval) to detect
 *     when currentStep advances to 'result'.
 *   - Does NOT call onComplete — advancement is server-driven.
 *   - The page detects currentStep === 'result' and routes to the results view.
 *
 * NOTE ON isBusy / onComplete:
 *   These props are accepted to satisfy OnboardingStepProps but are unused.
 *   The step is purely informational.
 */

import { useEffect, useState } from 'react';
import type { OnboardingStepProps } from '../constants/step-props';

const PROCESSING_MESSAGES = [
  'Reviewing your education background…',
  'Mapping your academic strengths…',
  'Analysing your activities and interests…',
  'Evaluating your thinking style…',
  'Matching your aspirations to career paths…',
  'Finalising your personalised recommendations…',
] as const;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function ProcessingStep({ onComplete: _onComplete, isBusy: _isBusy }: OnboardingStepProps) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) =>
        prev < PROCESSING_MESSAGES.length - 1 ? prev + 1 : prev,
      );
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-12 text-center">

      {/* Animated ring */}
      <div className="relative mb-6 h-16 w-16">
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        <div className="absolute inset-2 flex items-center justify-center">
          <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        </div>
      </div>

      <h2 className="text-base font-semibold text-foreground">
        Building your career profile
      </h2>
      <p className="mt-2 min-h-[1.5rem] text-sm text-muted-foreground transition-all duration-700">
        {PROCESSING_MESSAGES[messageIndex]}
      </p>

      <div className="mt-6 flex gap-1">
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
        This usually takes less than a minute. Please don&apos;t close this tab.
      </p>
    </div>
  );
}