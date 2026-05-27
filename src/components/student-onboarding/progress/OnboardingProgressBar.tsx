'use client';

/**
 * @file components/student-onboarding/progress/OnboardingProgressBar.tsx
 *
 * ONBOARDING PROGRESS BAR
 * ────────────────────────
 * Animated progress bar driven exclusively by session.completionPct.
 *
 * CONTRACT:
 *   Progress is ALWAYS derived from the server session.
 *   This component NEVER calculates progress locally.
 *   It receives completionPct as a prop and renders it.
 */

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

interface OnboardingProgressBarProps {
  /**
   * Completion percentage 0–100.
   * Must come from session.completionPct (server-computed).
   */
  completionPct: number;

  /**
   * Human-readable label shown alongside the bar.
   * e.g. "2 of 5 steps"
   */
  label?: string;

  /**
   * Accessible label for screen readers.
   * Defaults to "Onboarding progress: {completionPct}%"
   */
  ariaLabel?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * OnboardingProgressBar
 *
 * Server-driven progress bar. Animated via CSS transition-all.
 *
 * @example
 * <OnboardingProgressBar
 *   completionPct={session.completionPct}
 *   label={`${completedCount} of ${totalCount} steps`}
 * />
 */
export function OnboardingProgressBar({
  completionPct,
  label,
  ariaLabel,
}: OnboardingProgressBarProps) {
  // Clamp to [0, 100] defensively — server should always return valid values
  const clampedPct = Math.min(100, Math.max(0, completionPct));

  return (
    <div className="w-full">
      {label && (
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Student profile setup</span>
          <span>{label}</span>
        </div>
      )}

      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        aria-hidden="true"
      >
        <div
          className="h-1.5 rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${clampedPct}%` }}
        />
      </div>

      {/* Screen-reader-accessible progressbar */}
      <div
        role="progressbar"
        aria-valuenow={clampedPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel ?? `Onboarding progress: ${clampedPct}%`}
        className="sr-only"
      />
    </div>
  );
}
