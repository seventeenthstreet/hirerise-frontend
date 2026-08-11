/**
 * @file components/student-onboarding/recovery/OnboardingRecoveryScreen.tsx
 *
 * ONBOARDING RECOVERY SCREEN
 * ────────────────────────────
 * Route-level recovery UI for the student onboarding flow.
 *
 * Rendered when the session query fails, times out, or returns malformed data.
 * Replaces a permanent spinner or a blank white screen with an actionable UI.
 *
 * SCENARIOS HANDLED:
 *   'fetch_failed'        — session query failed (network/server error)
 *   'unauthorized'        — 401/403; user needs to re-authenticate
 *   'stale_session'       — session is too old to trust safely
 *   'malformed_session'   — session exists but required fields are missing/wrong
 *   'backend_unavailable' — 5xx or connection timeout from the backend
 *   'load_timeout'        — loading spinner exceeded MAX_LOADING_DURATION_MS
 *
 * RECOVERY ACTIONS:
 *   Retry           — re-fetch the session (idempotent, safe to call repeatedly)
 *   Restart         — navigate to the onboarding entry point (fresh start)
 *   Return dashboard — navigate to /dashboard (exit onboarding entirely)
 *
 * ARCHITECTURE:
 *   - Rendered by the page/shell, NOT by StepRouter
 *   - Receives the full flow state — needs refetchSession and currentStepId
 *   - Scenario-specific copy adapts the UI message without forking the component
 *
 * IMPORTANT:
 *   - NEVER renders a loading spinner — it IS the replacement for one
 *   - NEVER auto-redirects — always gives the user control
 *   - NEVER swallows the scenario — always shows actionable context
 */

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RecoveryScenario } from '@/features/student-onboarding/lib/onboarding-hardening.types';
import {
  captureOnboardingSnapshot,
  buildRecoverySnapshot,
} from '@/features/student-onboarding/lib/onboarding-snapshot';

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO COPY MAP
// ─────────────────────────────────────────────────────────────────────────────

interface ScenarioCopy {
  title: string;
  description: string;
  primaryAction: string;
  showRestart: boolean;
  showDashboard: boolean;
}

const SCENARIO_COPY: Record<RecoveryScenario, ScenarioCopy> = {
  fetch_failed: {
    title: 'Unable to load your onboarding session',
    description: 'Something went wrong while fetching your progress. Your data is safe — please try again.',
    primaryAction: 'Retry',
    showRestart: true,
    showDashboard: true,
  },
  unauthorized: {
    title: 'Your session has expired',
    description: 'Please sign in again to continue your onboarding. Your progress has been saved.',
    primaryAction: 'Sign in again',
    showRestart: false,
    showDashboard: false,
  },
  stale_session: {
    title: 'Your session is outdated',
    description: 'We couldn\'t verify your latest progress. Refreshing usually fixes this.',
    primaryAction: 'Refresh session',
    showRestart: true,
    showDashboard: true,
  },
  malformed_session: {
    title: 'We encountered an issue with your session',
    description: 'Your session data appears incomplete. Restarting onboarding will preserve your account — you\'ll need to re-enter your profile steps.',
    primaryAction: 'Retry',
    showRestart: true,
    showDashboard: true,
  },
  backend_unavailable: {
    title: 'Our service is temporarily unavailable',
    description: 'We\'re having trouble reaching our servers. This is usually brief — please try again in a moment.',
    primaryAction: 'Try again',
    showRestart: false,
    showDashboard: true,
  },
  load_timeout: {
    title: 'Taking longer than expected',
    description: 'Loading your session is taking longer than usual. This may be a temporary network issue.',
    primaryAction: 'Retry',
    showRestart: true,
    showDashboard: true,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

interface OnboardingRecoveryScreenProps {
  /** The recovery scenario to display. Drives copy and available actions. */
  scenario: RecoveryScenario;
  /** Trigger a fresh session fetch. From flow.refetchSession. */
  onRetry: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * OnboardingRecoveryScreen
 *
 * Route-level recovery UI. Renders scenario-appropriate copy and
 * actionable recovery buttons.
 *
 * @example
 * // In StudentOnboardingShell or page.tsx:
 * if (flow.recovery.shouldShowRecovery && flow.recovery.scenario) {
 *   return (
 *     <OnboardingRecoveryScreen
 *       scenario={flow.recovery.scenario}
 *       onRetry={flow.refetchSession}
 *     />
 *   );
 * }
 */
export function OnboardingRecoveryScreen({
  scenario,
  onRetry,
}: OnboardingRecoveryScreenProps) {
  const navigate = useNavigate();
  const copy = SCENARIO_COPY[scenario];

  // ── Snapshot on mount ────────────────────────────────────────────────────
  // Captured once when the recovery screen first renders. The useRef guard
  // prevents duplicate snapshots on re-renders within the same mount cycle.
  // The snapshot deduplication cooldown provides a second safety net.
  const snapshotCapturedRef = useRef(false);
  useEffect(() => {
    if (snapshotCapturedRef.current) return;
    snapshotCapturedRef.current = true;
    buildRecoverySnapshot({
      recoveryScenario: scenario,
      retryCount:       0,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePrimary() {
    if (scenario === 'unauthorized') {
      navigate('/auth/login', { replace: true });
    } else {
      onRetry();
    }
  }

  function handleRestart() {
    // SNAPSHOT — captures the restart trigger with the active recovery scenario
    // so production logs can correlate abandonment with the failure root cause.
    captureOnboardingSnapshot({
      scenario:         'onboarding_restart_triggered',
      recoveryScenario: scenario,
      isRecoverable:    false,
      primaryContext:   scenario,
    });
    navigate('/onboarding/student/academics', { replace: true });
  }

  function handleDashboard() {
    navigate('/dashboard', { replace: true });
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="mx-auto max-w-2xl px-4 py-12"
    >
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-8">
        {/* Icon */}
        <div className="mb-5 flex justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <svg
              className="h-6 w-6 text-destructive"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
              />
            </svg>
          </span>
        </div>

        {/* Copy */}
        <div className="text-center">
          <h2 className="text-base font-semibold text-foreground">{copy.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{copy.description}</p>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          {/* Primary action — Retry / Sign in */}
          <button
            type="button"
            onClick={handlePrimary}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:w-auto"
          >
            {copy.primaryAction}
          </button>

          {/* Restart onboarding */}
          {copy.showRestart && (
            <button
              type="button"
              onClick={handleRestart}
              className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:w-auto"
            >
              Restart onboarding
            </button>
          )}

          {/* Return to dashboard */}
          {copy.showDashboard && (
            <button
              type="button"
              onClick={handleDashboard}
              className="w-full rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:w-auto"
            >
              Return to dashboard
            </button>
          )}
        </div>

        {/* Debug scenario label — dev only */}
        {process.env.NODE_ENV !== 'production' && (
          <p className="mt-4 text-center font-mono text-xs text-muted-foreground/60">
            recovery: {scenario}
          </p>
        )}
      </div>
    </div>
  );
}