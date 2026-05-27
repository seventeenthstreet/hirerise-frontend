'use client';

/**
 * @file src/modules/student-onboarding/steps/financial-step.tsx
 *
 * STEP 6 — FINANCIAL & ACCESSIBILITY CONTEXT (Phase 1 MVP)
 * ══════════════════════════════════════════════════════════
 * Collects education budget context in a psychologically sensitive way.
 *
 * UX RULES (CRITICAL):
 *  - NEVER ask directly: "What is your income?"
 *  - Frame as "education planning" and "comfort levels"
 *  - Explicitly state that all paths have options at every budget
 *  - Make every option feel legitimate and respected
 *  - Framing: empowering, not limiting
 *
 * DATA CONTRACT:
 *   onComplete({ educationBudget, loanOpenness, relocationFlexibility })
 *   → terminal step → triggers AI processing
 */

import { useState } from 'react';
import type { OnboardingStepProps } from '../constants/step-props';
import type { EducationBudget, LoanOpenness, RelocationFlexibility } from '../api/student-onboarding.types';
import {
  EDUCATION_BUDGET_OPTIONS,
  LOAN_OPENNESS_OPTIONS,
  RELOCATION_OPTIONS,
} from '../api/student-onboarding.types';

export default function FinancialStep({ onComplete, isBusy, initialData }: OnboardingStepProps) {
  const [educationBudget, setEducationBudget] = useState<EducationBudget | null>(
    (initialData?.educationBudget as EducationBudget) ?? null,
  );
  const [loanOpenness, setLoanOpenness] = useState<LoanOpenness | null>(
    (initialData?.loanOpenness as LoanOpenness) ?? null,
  );
  const [relocationFlexibility, setRelocationFlexibility] = useState<RelocationFlexibility | null>(
    (initialData?.relocationFlexibility as RelocationFlexibility) ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  const canSubmit = educationBudget !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!educationBudget) {
      setError('Please select an education budget range to continue.');
      return;
    }

    await onComplete({ educationBudget, loanOpenness, relocationFlexibility });
  }

  return (
    <div className="rounded-xl border border-border bg-card px-6 py-6">
      <div className="mb-2">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xl">🗺️</span>
          <h2 className="text-base font-semibold text-foreground">Education Planning</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          This helps us suggest career paths that are financially realistic for you. Every budget has excellent options.
        </p>
      </div>

      {/* Reassurance note */}
      <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
        <p className="text-xs text-green-700">
          💡 Great careers exist at every budget level. This helps us personalise your recommendations — not limit them.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">

        {/* Education budget */}
        <div>
          <p className="mb-3 text-sm font-medium text-foreground">
            What's a comfortable annual education budget for your family?
            <span className="ml-1 font-normal text-muted-foreground">(approximate)</span>
          </p>
          <div
            role="group"
            aria-label="Education budget range"
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
          >
            {EDUCATION_BUDGET_OPTIONS.map((opt) => {
              const isSelected = educationBudget === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setEducationBudget(isSelected ? null : (opt.value as EducationBudget))}
                  className={`
                    flex flex-col items-start rounded-xl border p-4 text-left transition-all
                    ${isSelected
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                      : 'border-border bg-card hover:border-primary/40 hover:bg-muted/20'
                    }
                  `}
                >
                  <span className={`text-sm font-semibold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                    {isSelected && '✓ '}{opt.label}
                  </span>
                  <span className="mt-0.5 text-xs text-muted-foreground">{opt.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Loan openness */}
        <div>
          <p className="mb-3 text-sm font-medium text-foreground">
            How do you feel about education loans?
            <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
          </p>
          <div
            role="group"
            aria-label="Openness to education loans"
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
          >
            {LOAN_OPENNESS_OPTIONS.map((opt) => {
              const isSelected = loanOpenness === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setLoanOpenness(isSelected ? null : (opt.value as LoanOpenness))}
                  className={`
                    rounded-lg border px-4 py-2.5 text-left text-sm transition-all
                    ${isSelected
                      ? 'border-primary bg-primary/5 font-medium text-primary ring-2 ring-primary/30'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    }
                  `}
                >
                  {isSelected && '✓ '}{opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Relocation flexibility */}
        <div>
          <p className="mb-3 text-sm font-medium text-foreground">
            Where are you open to studying or working?
            <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
          </p>
          <div
            role="group"
            aria-label="Relocation flexibility"
            className="flex flex-wrap gap-2"
          >
            {RELOCATION_OPTIONS.map((opt) => {
              const isSelected = relocationFlexibility === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setRelocationFlexibility(isSelected ? null : (opt.value as RelocationFlexibility))}
                  className={`
                    rounded-full border px-4 py-2 text-sm font-medium transition-all
                    ${isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    }
                  `}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="space-y-2">
          <button
            type="submit"
            disabled={isBusy || !canSubmit}
            aria-busy={isBusy}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isBusy ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                Building your profile…
              </span>
            ) : (
              'Generate My Career Recommendations →'
            )}
          </button>
          <p className="text-center text-xs text-muted-foreground">
            This will start AI analysis of your complete profile
          </p>
        </div>
      </form>
    </div>
  );
}
