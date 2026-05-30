

import type { OnboardingStep } from '@/lib/api/onboarding';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type OnboardingVariant = 'student' | 'professional';

interface OnboardingStepsProps {
  steps: OnboardingStep[];
  currentStep: string | null;
  restoredData: Record<string, unknown> | null;
  variant: OnboardingVariant;
  isSubmitting: boolean;
  onStepChange: (stepKey: string, data: Record<string, unknown>) => Promise<void>;
  onSubmit: (finalData: Record<string, unknown>) => Promise<void>;
  /** Called when the user clicks "Change direction". Omit to hide the link. */
  onChangeDirection?: () => void;
  /** True while the direction-reset mutation is in flight. */
  isResettingDirection?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// Named export — matches page import: import { OnboardingSteps } from '...'
// Pure display: no hooks, no API calls, no routing.
// ─────────────────────────────────────────────────────────────────────────────

export function OnboardingSteps({
  steps,
  currentStep,
  restoredData,
  variant,
  isSubmitting,
  onStepChange,
  onSubmit,
  onChangeDirection,
  isResettingDirection = false,
}: OnboardingStepsProps) {
  const completedCount = steps.filter((s) => s.completed).length;
  const totalCount     = steps.length;
  const progressPct    = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isLastStep     = currentStep === steps[steps.length - 1]?.stepId;

  async function handleStepAction(step: OnboardingStep) {
    if (step.completed) return;

    const stepData: Record<string, unknown> = {
      ...(restoredData ?? {}),
      stepId: step.stepId,
    };

    if (isLastStep) {
      await onSubmit(stepData);
    } else {
      await onStepChange(step.stepId, stepData);
    }
  }

  return (
    <div className="w-full">

      {/* Progress bar */}
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {variant === 'student' ? 'Student profile' : 'Career profile'} setup
          </span>
          <span>{completedCount} of {totalCount} steps</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-1.5 rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progressPct}%` }}
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      {/* Empty state */}
      {steps.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No onboarding steps found.
        </div>
      )}

      {/* Steps list */}
      {steps.length > 0 && (
        <ol className="space-y-3">
          {steps.map((step, index) => {
            const isCurrent      = step.stepId === currentStep;
            const isActionable   = isCurrent && !step.completed;
            const isThisLastStep = index === steps.length - 1;

            return (
              <li
                key={step.stepId}
                className={[
                  'flex items-center justify-between rounded-xl border px-5 py-4 transition-colors',
                  step.completed
                    ? 'border-green-200 bg-green-50'
                    : isCurrent
                    ? 'border-primary/30 bg-primary/5 shadow-sm'
                    : 'border-border bg-card',
                ].join(' ')}
              >
                {/* Step indicator + label */}
                <div className="flex items-center gap-3">
                  <span
                    className={[
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                      step.completed
                        ? 'bg-green-500 text-white'
                        : isCurrent
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground',
                    ].join(' ')}
                  >
                    {step.completed ? (
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </span>

                  <div>
                    <p className={[
                      'text-sm font-medium',
                      step.completed ? 'text-green-800' : isCurrent ? 'text-foreground' : 'text-muted-foreground',
                    ].join(' ')}>
                      {formatStepLabel(step.stepId)}
                    </p>
                    {step.skipped && (
                      <p className="mt-0.5 text-xs text-muted-foreground">Skipped</p>
                    )}
                    {isCurrent && restoredData && !step.completed && (
                      <p className="mt-0.5 text-xs text-primary/70">Progress restored</p>
                    )}
                  </div>
                </div>

                {/* Action */}
                <div className="ml-4 shrink-0">
                  {step.completed ? (
                    <span className="text-xs font-medium text-green-600">Done</span>
                  ) : isActionable ? (
                    <button
                      onClick={() => handleStepAction(step)}
                      disabled={isSubmitting}
                      aria-label={`${isThisLastStep ? 'Generate report for' : 'Continue'} step: ${step.stepId}`}
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
                          {isThisLastStep ? 'Generating your report…' : 'Saving…'}
                        </>
                      ) : (
                        isThisLastStep ? 'Generate my report' : 'Continue'
                      )}
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Upcoming</span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* Progress summary */}
      {steps.length > 0 && (
        <p className="mt-6 text-right text-xs text-muted-foreground">
          {completedCount} of {totalCount} completed
        </p>
      )}

      {/* ── Change-direction escape hatch ─────────────────────────────────
          Shown regardless of step count so users who land on the empty-state
          ("No onboarding steps found") can still correct a wrong choice.     */}
      {onChangeDirection && (
        <div className="mt-8 flex items-center justify-center gap-1.5 border-t border-border pt-6 text-xs text-muted-foreground">
          <span>Not the right fit?</span>
          <button
            type="button"
            onClick={onChangeDirection}
            disabled={isSubmitting || isResettingDirection}
            className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isResettingDirection ? (
              <>
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary/30 border-t-primary" aria-hidden="true" />
                Resetting…
              </>
            ) : (
              'Change direction'
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatStepLabel(stepId: string): string {
  return stepId
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}