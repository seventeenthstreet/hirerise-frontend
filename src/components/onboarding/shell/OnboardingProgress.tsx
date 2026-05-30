

/**
 * components/onboarding/shell/OnboardingProgress.tsx
 *
 * Shared onboarding progress primitive.
 *
 * Extracted from the duplicated progress logic found in:
 *   - OnboardingSteps.tsx (step counter + bar)
 *   - career/onboarding/page.tsx (separate inline progress bar)
 *
 * Responsibilities:
 *   - Render a labelled progress bar
 *   - Expose step count display
 *   - Support percentage-only or step-count modes
 *   - Support future dynamic step counts
 *
 * Does NOT own:
 *   - Step data or completion state (passed in as props)
 *   - Navigation logic
 *   - API calls
 */

interface OnboardingProgressProps {
  /** Number of completed steps. */
  completedCount: number;
  /** Total step count. */
  totalCount: number;
  /** Optional label shown above the bar (left side). */
  label?: string;
  /** Whether to show the step fraction text ("2 of 5 steps"). Default: true */
  showStepCount?: boolean;
  /** Whether to show percentage text. Default: false */
  showPercent?: boolean;
  /** Additional className on the root element. */
  className?: string;
  /** Accessible label for the progressbar. */
  ariaLabel?: string;
}

export function OnboardingProgress({
  completedCount,
  totalCount,
  label,
  showStepCount = true,
  showPercent = false,
  className = '',
  ariaLabel = 'Onboarding progress',
}: OnboardingProgressProps) {
  const percent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className={className}>
      {/* Header row */}
      {(label || showStepCount || showPercent) && (
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          {label && <span>{label}</span>}
          {!label && <span />}
          <span>
            {showStepCount && `${completedCount} of ${totalCount} steps`}
            {showPercent && !showStepCount && `${percent}%`}
          </span>
        </div>
      )}

      {/* Bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-1.5 rounded-full bg-primary transition-all duration-500"
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-label={ariaLabel}
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}