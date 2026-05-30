

/**
 * @file components/student-onboarding/recovery/VersionMismatchScreen.tsx
 *
 * VERSION MISMATCH SCREEN
 * ────────────────────────
 * Rendered when the session's engine_version is not in SUPPORTED_ONBOARDING_VERSIONS.
 *
 * WHEN IT RENDERS:
 *   Rendered by StudentOnboardingShell BEFORE any other content — including
 *   the loading spinner, recovery screen, and step router — because a version
 *   mismatch means the frontend cannot safely interpret the session at all.
 *
 * WHAT IT DOES NOT DO:
 *   ❌ Does not auto-redirect — always gives the user a choice
 *   ❌ Does not show a loading spinner
 *   ❌ Does not attempt to render any step
 *   ❌ Does not retry automatically (the new session from restart will use
 *      the current version)
 *
 * RECOVERY ACTIONS:
 *   1. Restart onboarding  — navigates to /education/onboarding (creates fresh session)
 *   2. Refresh application — hard-reloads the page (clears stale JS bundle from cache)
 *   3. Return to dashboard — exits onboarding entirely
 *
 * ARCHITECTURE:
 *   - Rendered by StudentOnboardingShell, not by StepRouter
 *   - Receives VersionMismatchInfo from flow.versionCompatibility.versionMismatch
 *   - Emits onboarding_restarted diagnostic event on restart
 */

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { VersionMismatchInfo } from '@/features/student-onboarding/lib/onboarding-hardening.types';
import { logOnboardingEvent } from '@/features/student-onboarding/lib/onboarding-diagnostics';
import { captureOnboardingSnapshot } from '@/features/student-onboarding/lib/onboarding-snapshot';

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

interface VersionMismatchScreenProps {
  /** Mismatch detail from flow.versionCompatibility.versionMismatch */
  mismatch: VersionMismatchInfo;
  /**
   * The step that was active when the mismatch was detected.
   * Used for the restart diagnostic event.
   */
  currentStepId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * VersionMismatchScreen
 *
 * Shown when the session was created by an incompatible backend version.
 * Provides three safe recovery paths without auto-redirecting.
 *
 * @example
 * // In StudentOnboardingShell, BEFORE the loading guard:
 * if (!flow.versionCompatibility.isVersionCompatible && flow.versionCompatibility.versionMismatch) {
 *   return (
 *     <VersionMismatchScreen
 *       mismatch={flow.versionCompatibility.versionMismatch}
 *       currentStepId={flow.currentStepId}
 *     />
 *   );
 * }
 */
export function VersionMismatchScreen({
  mismatch,
  currentStepId = 'unknown',
}: VersionMismatchScreenProps) {
  const navigate = useNavigate();

  // ── Snapshot on mount ─────────────────────────────────────────────────────
  // Critical severity. Captured once when the screen first renders.
  // The useRef guard prevents re-capture on re-renders of the same mount.
  const snapshotCapturedRef = useRef(false);
  useEffect(() => {
    if (snapshotCapturedRef.current) return;
    snapshotCapturedRef.current = true;
    captureOnboardingSnapshot({
      scenario:            'version_mismatch',
      engineVersion:       mismatch.receivedVersion,
      isVersionCompatible: false,
      currentStep:         currentStepId,
      pollingActive:       false,
      processingState:     'version_blocked',
      primaryContext:      String(mismatch.receivedVersion ?? 'unknown'),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleRestart() {
    // SNAPSHOT — captures the restart trigger so logs can correlate the
    // version mismatch with subsequent fresh session creation.
    captureOnboardingSnapshot({
      scenario:            'onboarding_restart_triggered',
      engineVersion:       mismatch.receivedVersion,
      isVersionCompatible: false,
      currentStep:         currentStepId,
      recoveryScenario:    'malformed_session',
      isRecoverable:       false,
      primaryContext:      'version_mismatch_restart',
    });
    logOnboardingEvent({
      event: 'onboarding_restarted',
      severity: 'info',
      timestamp: new Date().toISOString(),
      onboardingStep: currentStepId,
      metadata: {
        triggeredFromScenario: 'version_mismatch',
        stepAtRestart: currentStepId,
      },
    });
    navigate('/education/onboarding', { replace: true });
  }

  function handleRefresh() {
    // Hard reload clears the stale JS bundle from browser cache.
    window.location.reload();
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
      <div className="rounded-xl border border-amber-300/40 bg-amber-50/60 px-6 py-8 dark:border-amber-700/30 dark:bg-amber-950/20">

        {/* Icon */}
        <div className="mb-5 flex justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <svg
              className="h-6 w-6 text-amber-600 dark:text-amber-400"
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

        {/* Copy */}
        <div className="text-center">
          <h2 className="text-base font-semibold text-foreground">
            This onboarding session was created with an incompatible version
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account and progress are safe. The onboarding system has been updated
            since your session was created. Starting a fresh session will use the
            latest version.
          </p>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">

          {/* Primary: Restart */}
          <button
            type="button"
            onClick={handleRestart}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:w-auto"
          >
            Restart onboarding
          </button>

          {/* Secondary: Refresh (clears stale bundle) */}
          <button
            type="button"
            onClick={handleRefresh}
            className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:w-auto"
          >
            Refresh application
          </button>

          {/* Tertiary: Dashboard */}
          <button
            type="button"
            onClick={handleDashboard}
            className="w-full rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:w-auto"
          >
            Return to dashboard
          </button>
        </div>

        {/* Dev-only: version debug info */}
        {process.env.NODE_ENV !== 'production' && (
          <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-3 font-mono text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            <p className="font-semibold">Version mismatch detail (dev only)</p>
            <p className="mt-1">Received: <span className="font-bold">{mismatch.receivedVersion ?? 'undefined'}</span></p>
            <p>Supported: <span className="font-bold">{mismatch.supportedVersions.join(', ')}</span></p>
            <p>Detected at: {mismatch.detectedAt}</p>
          </div>
        )}
      </div>
    </div>
  );
}