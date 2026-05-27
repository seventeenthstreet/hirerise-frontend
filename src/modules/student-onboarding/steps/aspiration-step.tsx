'use client';

/**
 * @file src/modules/student-onboarding/steps/aspiration-step.tsx
 *
 * STEP 5: ASPIRATIONS (Terminal Data-Entry Step)
 * ════════════════════════════════════════════════
 * Captures the student's career aspirations and goals.
 * This is the final data-entry step — isTerminal: true in the registry.
 *
 * DATA CONTRACT:
 *   onComplete({ careerInterests, motivationDriver, timeHorizon })
 *   → page calls submitOnboarding() (not saveProgress())
 *   → backend advances session to 'processing'
 */

import { useState } from 'react';
import type { OnboardingStepProps } from '../constants/step-props';

const CAREER_DOMAINS = [
  { id: 'medicine',      label: 'Medicine & Healthcare' },
  { id: 'engineering',   label: 'Engineering & Technology' },
  { id: 'law',           label: 'Law & Governance' },
  { id: 'arts_design',   label: 'Arts, Design & Media' },
  { id: 'business',      label: 'Business & Management' },
  { id: 'science',       label: 'Pure Sciences & Research' },
  { id: 'teaching',      label: 'Education & Teaching' },
  { id: 'social',        label: 'Social Work & NGOs' },
  { id: 'defence',       label: 'Defence & Civil Services' },
  { id: 'sports_fitness', label: 'Sports & Fitness' },
  { id: 'undecided',     label: "I'm not sure yet" },
] as const;

const MOTIVATION_DRIVERS = [
  { value: 'impact',    label: 'Making a difference in the world' },
  { value: 'financial', label: 'Financial security and growth' },
  { value: 'passion',   label: 'Doing what I love every day' },
  { value: 'prestige',  label: 'Recognition and status' },
  { value: 'autonomy',  label: 'Independence and flexibility' },
] as const;

const TIME_HORIZONS = [
  { value: 'short',  label: 'Immediate (within 2 years)' },
  { value: 'medium', label: '2–5 years from now' },
  { value: 'long',   label: '5–10 years from now' },
  { value: 'open',   label: "I'm keeping my options open" },
] as const;

export default function AspirationStep({ onComplete, isBusy, initialData }: OnboardingStepProps) {
  const [careerInterests, setCareerInterests] = useState<string[]>(
    (initialData?.careerInterests as string[]) ?? [],
  );
  const [motivationDriver, setMotivationDriver] = useState<string>(
    (initialData?.motivationDriver as string) ?? '',
  );
  const [timeHorizon, setTimeHorizon] = useState<string>(
    (initialData?.timeHorizon as string) ?? '',
  );
  const [error, setError] = useState<string | null>(null);

  function toggleDomain(id: string) {
    if (id === 'undecided') {
      setCareerInterests(['undecided']);
      return;
    }
    setCareerInterests((prev) => {
      const without = prev.filter((d) => d !== 'undecided');
      return without.includes(id) ? without.filter((d) => d !== id) : [...without, id];
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (careerInterests.length === 0) {
      setError('Please select at least one area of interest.');
      return;
    }

    await onComplete({ careerInterests, motivationDriver: motivationDriver || null, timeHorizon: timeHorizon || null });
  }

  return (
    <div className="rounded-xl border border-border bg-card px-6 py-6">
      <div className="mb-6">
        <h2 className="text-base font-semibold text-foreground">Aspirations</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The last step — tell us what kind of future you want to build.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            Which career areas interest you? <span className="text-destructive">*</span>
            <span className="ml-1 text-xs font-normal text-muted-foreground">(select all that apply)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {CAREER_DOMAINS.map((domain) => (
              <button
                key={domain.id}
                type="button"
                onClick={() => toggleDomain(domain.id)}
                className={[
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  careerInterests.includes(domain.id)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/30',
                ].join(' ')}
              >
                {domain.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            What motivates you most?
            <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {MOTIVATION_DRIVERS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMotivationDriver(motivationDriver === opt.value ? '' : opt.value)}
                className={[
                  'rounded-lg border px-4 py-2.5 text-left text-sm font-medium transition-colors',
                  motivationDriver === opt.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/30',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            When do you want to start your career?
            <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {TIME_HORIZONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTimeHorizon(timeHorizon === opt.value ? '' : opt.value)}
                className={[
                  'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                  timeHorizon === opt.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/30',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={isBusy || careerInterests.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isBusy ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
              Generating your profile…
            </>
          ) : (
            'Generate my career profile →'
          )}
        </button>
      </form>
    </div>
  );
}