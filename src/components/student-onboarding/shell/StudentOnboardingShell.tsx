

/**
 * @file components/student-onboarding/shell/StudentOnboardingShell.tsx
 *
 * STUDENT ONBOARDING SHELL
 * ─────────────────────────
 * Layout wrapper for the entire student onboarding flow.
 *
 * GUARD PRIORITY ORDER (highest → lowest):
 *   ① Version mismatch guard  ← NEW — blocks everything if session version incompatible
 *   ② Recovery guard          — catches session errors, load timeouts, malformed sessions
 *   ③ Loading guard           — spinner while session loads
 *   ④ Main shell              — normal onboarding UI
 *
 * HARDENING ADDITIONS (Phase 3):
 *   ✅ Version mismatch guard renders VersionMismatchScreen BEFORE recovery and loading
 *   ✅ All guard ordering is explicit and documented
 */

import type { ReactNode } from 'react';
import type { UseStudentOnboardingFlowReturn } from '@/features/student-onboarding/hooks';
import type { UseResumeOnboardingReturn } from '@/features/student-onboarding/hooks';
import { STUDENT_ONBOARDING_STEPS } from '@/modules/student-onboarding';
import type { CompletableStep } from '@/modules/student-onboarding';
import { OnboardingRecoveryScreen } from '../recovery/OnboardingRecoveryScreen';
import { VersionMismatchScreen } from '../recovery/VersionMismatchScreen';

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

interface StudentOnboardingShellProps {
  flow: UseStudentOnboardingFlowReturn;
  resume: UseResumeOnboardingReturn;
  children: ReactNode;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

function ShellHeader() {
  return (
    <header className="mb-8 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        Build your student profile
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Tell us about yourself so we can match you with the right career paths.
      </p>
    </header>
  );
}

function ResumeBanner({ stepLabel }: { stepLabel: string | null }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-6 flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3"
    >
      <svg
        className="h-4 w-4 shrink-0 text-primary"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm.75 3.75a.75.75 0 00-1.5 0v3.5c0 .414.336.75.75.75h2.5a.75.75 0 000-1.5H8.75V4.75z" />
      </svg>
      <p className="text-sm text-primary">
        Welcome back! Resuming from{' '}
        <span className="font-medium">{stepLabel ?? 'where you left off'}</span>.
      </p>
    </div>
  );
}

function StaleSessionWarning() {
  return (
    <div
      role="alert"
      className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
    >
      <svg
        className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M8 1a7 7 0 100 14A7 7 0 008 1zM7.25 4.75a.75.75 0 011.5 0v3a.75.75 0 01-1.5 0v-3zm.75 6.5a.75.75 0 100-1.5.75.75 0 000 1.5z"
        />
      </svg>
      <p className="text-sm text-amber-700">
        Your session is from a while ago. Your progress is saved — just pick up where you left off.
      </p>
    </div>
  );
}

function ProgressSection({
  progressPercent,
  completedStepCount,
  totalStepCount,
  currentStepId,
  completedSteps,
}: {
  progressPercent: number;
  completedStepCount: number;
  totalStepCount: number;
  currentStepId: string;
  completedSteps: readonly string[];
}) {
  const dataEntrySteps = STUDENT_ONBOARDING_STEPS.filter((s) => !s.isSystemStep);

  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Student profile setup</span>
        <span>
          {completedStepCount} of {totalStepCount} steps
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-1.5 rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Onboarding progress: ${completedStepCount} of ${totalStepCount} steps complete`}
        />
      </div>

      <ol className="mt-3 flex items-center gap-2" aria-label="Onboarding steps">
        {dataEntrySteps.map((entry) => {
          const isCompleted = completedSteps.includes(entry.id as CompletableStep);
          const isCurrent   = currentStepId === entry.id;
          return (
            <li
              key={entry.id}
              title={entry.label}
              aria-label={`${entry.label}${isCompleted ? ' (completed)' : isCurrent ? ' (current)' : ''}`}
              className={[
                'flex-1 h-1 rounded-full transition-colors duration-300',
                isCompleted ? 'bg-primary'
                : isCurrent  ? 'bg-primary/40'
                : 'bg-muted',
              ].join(' ')}
            />
          );
        })}
      </ol>

      <p className="mt-2 text-xs text-muted-foreground">
        {STUDENT_ONBOARDING_STEPS.find((s) => s.id === currentStepId)?.label ?? currentStepId}
      </p>
    </div>
  );
}

function ShellLoadingState({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <span
          className="h-6 w-6 animate-spin rounded-full border-2 border-primary/20 border-t-primary"
          aria-hidden="true"
        />
        <p className="text-sm text-muted-foreground">
          {label ?? 'Loading your onboarding…'}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHELL
// ─────────────────────────────────────────────────────────────────────────────

export function StudentOnboardingShell({
  flow,
  resume,
  children,
}: StudentOnboardingShellProps) {

  // ── ① Version mismatch guard (HIGHEST PRIORITY) ───────────────────────────
  //
  // A version-incompatible session cannot be safely interpreted by this frontend
  // build.  We halt ALL rendering — including polling, recovery, and step routing —
  // and show the dedicated VersionMismatchScreen.
  //
  // This check runs BEFORE the recovery guard so that a version mismatch is
  // never confused with a generic session error.
  if (
    !flow.versionCompatibility.isVersionCompatible &&
    flow.versionCompatibility.versionMismatch
  ) {
    return (
      <VersionMismatchScreen
        mismatch={flow.versionCompatibility.versionMismatch}
        currentStepId={flow.currentStepId}
      />
    );
  }

  // ── ② Recovery guard ─────────────────────────────────────────────────────
  // Catches: session fetch failures, load timeouts, malformed sessions,
  // unauthorized errors, backend unavailability.
  if (flow.recovery.shouldShowRecovery && flow.recovery.scenario) {
    return (
      <OnboardingRecoveryScreen
        scenario={flow.recovery.scenario}
        onRetry={flow.refetchSession}
      />
    );
  }

  // ── ③ Loading guard ───────────────────────────────────────────────────────
  if (flow.isSessionLoading) {
    const label = resume.isResuming
      ? 'Resuming your profile…'
      : 'Loading your onboarding…';
    return <ShellLoadingState label={label} />;
  }

  // ── ④ Main shell ──────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <ShellHeader />

      {resume.isResuming && !flow.isProcessingStep && (
        <ResumeBanner stepLabel={resume.resumeStepLabel} />
      )}

      {resume.isStaleSession && (
        <StaleSessionWarning />
      )}

      {!flow.isProcessingStep && (
        <ProgressSection
          progressPercent={flow.progressPercent}
          completedStepCount={flow.completedStepCount}
          totalStepCount={flow.totalStepCount}
          currentStepId={flow.currentStepId}
          completedSteps={flow.session?.completedSteps ?? []}
        />
      )}

      {children}
    </div>
  );
}
