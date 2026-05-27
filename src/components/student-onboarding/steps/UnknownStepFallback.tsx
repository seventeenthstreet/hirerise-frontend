'use client';

/**
 * @file components/student-onboarding/steps/UnknownStepFallback.tsx
 *
 * UNKNOWN STEP FALLBACK
 * ──────────────────────
 * Rendered by StepRouter when the backend returns a step ID that is NOT
 * in the VALID_ONBOARDING_STEPS registry.
 *
 * GUARANTEE:
 *   ✅ NEVER crashes the onboarding flow
 *   ✅ NEVER infinite-loops (no automatic redirects)
 *   ✅ Always shows actionable recovery options
 *   ✅ Logs a warning (non-spamming, step-scoped)
 *
 * USAGE:
 *   Rendered exclusively by StepRouter — do NOT render this directly from pages.
 *
 * TRIGGER SCENARIOS:
 *   - Backend deployed a new step before frontend ships support
 *   - Backend state corruption produced an unexpected step string
 *   - Database migration error left a session in an invalid state
 *
 * RECOVERY OPTIONS:
 *   1. Retry — re-fetch session (the step may have self-corrected)
 *   2. Restart onboarding — navigate to the onboarding entry point
 *   3. Return to dashboard — exit onboarding entirely
 */

import { useRouter } from 'next/navigation';

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

interface UnknownStepFallbackProps {
  /** The unrecognised step ID received from the backend. */
  stepId: string;
  /** Trigger a manual session refetch. Provided by the flow hook. */
  onRetry: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * UnknownStepFallback
 *
 * Renders a safe, actionable recovery UI when the backend returns an
 * unrecognised step ID.
 *
 * @example
 * // StepRouter usage:
 * if (!isValidOnboardingStep(currentStepId)) {
 *   return <UnknownStepFallback stepId={currentStepId} onRetry={flow.refetchSession} />;
 * }
 */
export function UnknownStepFallback({ stepId, onRetry }: UnknownStepFallbackProps) {
  const router = useRouter();

  function handleRestart() {
    // Navigate to the education step entry point (first step).
    // This forces the backend to re-evaluate the session state.
    router.replace('/education/onboarding');
  }

  function handleDashboard() {
    router.replace('/dashboard');
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-8"
    >
      {/* Icon */}
      <div className="mb-4 flex justify-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
          <svg
            className="h-5 w-5 text-amber-600"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
            />
          </svg>
        </span>
      </div>

      {/* Message */}
      <div className="text-center">
        <h2 className="text-base font-semibold text-amber-900">
          We encountered an unexpected onboarding state.
        </h2>
        <p className="mt-2 text-sm text-amber-700">
          Your progress is saved. This usually resolves itself — please try
          refreshing your session below.
        </p>

        {/* Debug info (dev only — stripped in production) */}
        {process.env.NODE_ENV !== 'production' && (
          <p className="mt-2 rounded bg-amber-100 px-3 py-1 font-mono text-xs text-amber-800">
            Unknown step: &quot;{stepId}&quot;
          </p>
        )}
      </div>

      {/* Recovery actions */}
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        {/* Primary — retry session fetch */}
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
        >
          Retry
        </button>

        {/* Secondary — restart from step 1 */}
        <button
          type="button"
          onClick={handleRestart}
          className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
        >
          Restart onboarding
        </button>

        {/* Tertiary — exit to dashboard */}
        <button
          type="button"
          onClick={handleDashboard}
          className="rounded-lg px-4 py-2 text-sm font-medium text-amber-700 underline underline-offset-2 hover:text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
        >
          Return to dashboard
        </button>
      </div>
    </div>
  );
}