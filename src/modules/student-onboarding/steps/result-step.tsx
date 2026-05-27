'use client';

/**
 * @file src/modules/student-onboarding/steps/result-step.tsx
 *
 * RESULT STEP (System-Driven)
 * ════════════════════════════
 * Shown when the AI scoring engine has completed and the session advances
 * to currentStep === 'result'.
 *
 * In the current phase, this step redirects the user to the dedicated
 * results page (/education/onboarding) where the full report is displayed.
 *
 * BEHAVIOUR:
 *   - Displays a success confirmation with a CTA button.
 *   - Calls onComplete({}) when the user clicks "View my results".
 *   - The page handles the onComplete callback and routes to /education/onboarding.
 *
 * FUTURE:
 *   This step can be enriched to show a preview of the results inline
 *   before the user navigates to the full report page.
 */

import type { OnboardingStepProps } from '../constants/step-props';

export default function ResultStep({ onComplete, isBusy }: OnboardingStepProps) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-green-200 bg-green-50 px-6 py-12 text-center">

      {/* Success icon */}
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-green-500">
        <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h2 className="text-lg font-semibold text-green-900">
        Your profile is ready!
      </h2>
      <p className="mt-2 max-w-sm text-sm text-green-700">
        We&apos;ve matched your strengths and interests to personalised career paths.
        Your results are waiting.
      </p>

      <button
        type="button"
        onClick={() => onComplete({})}
        disabled={isBusy}
        className="mt-8 flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isBusy ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Loading…
          </>
        ) : (
          'View my results →'
        )}
      </button>
    </div>
  );
}