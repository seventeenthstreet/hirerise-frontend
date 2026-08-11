/**
 * @file src/features/professional-onboarding/components/steps/ExperienceForm.tsx
 *
 * WP-PRO-09D — Guided Profile Builder UI Implementation
 *
 * Experience step (`guided_experience` → `POST /guided/experience`, payload
 * `{ experience: [...] }`). Field set matches `normalizeExperience`: title,
 * company, startDate, endDate, current, description.
 *
 * Gating step, but early-career professionals legitimately have no prior
 * work experience — an explicit "I don't have any work experience yet"
 * checkbox submits an empty array instead of forcing a fabricated entry
 * (WP-PRO-09B §4.3).
 */

import { useState, type FormEvent } from 'react';

import type { OnboardingStepProps } from '@/components/onboarding/steps/types';
import { StepContainer, StepTitle, StepDescription, StepSection, StepActions } from '@/components/onboarding/steps';
import { Button } from '@/components/ui';

import { TextField, TextAreaField, CheckboxField, ApiErrorBanner } from '../FormField';
import { useRepeatableEntries } from '../../hooks/useRepeatableEntries';
import { getGuidedBuilderErrorMessage } from '../../utils/error-message';

interface ExperienceEntry {
  title: string;
  company: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
}

const EMPTY_ENTRY: ExperienceEntry = {
  title: '',
  company: '',
  startDate: '',
  endDate: '',
  current: false,
  description: '',
};

function readInitialEntries(initialData: Record<string, unknown> | undefined): ExperienceEntry[] {
  const raw = initialData?.experience;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const list = raw as Array<Record<string, unknown>>;
  return list.map((e) => ({
    title: (e?.title as string) ?? '',
    company: (e?.company as string) ?? '',
    startDate: (e?.startDate as string) ?? '',
    endDate: (e?.endDate as string) ?? '',
    current: typeof e?.current === 'boolean' ? e.current : false,
    description: (e?.description as string) ?? '',
  }));
}

export default function ExperienceForm({ onComplete, isBusy, initialData }: OnboardingStepProps) {
  const initialEntries = readInitialEntries(initialData);
  const [noExperience, setNoExperience] = useState(initialEntries.length === 0);
  const { entries, updateEntry, addEntry, removeEntry } = useRepeatableEntries<ExperienceEntry>(
    initialEntries,
    EMPTY_ENTRY,
  );
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  function validate(): boolean {
    if (noExperience) {
      setErrors({});
      return true;
    }
    const nextErrors: Record<number, string> = {};
    const hasAtLeastOneComplete = entries.some((e) => e.title.trim() && e.company.trim());
    if (!hasAtLeastOneComplete) {
      entries.forEach((e, i) => {
        if (!e.title.trim() || !e.company.trim()) {
          nextErrors[i] = 'Enter at least a title and company.';
        }
      });
    }
    setErrors(nextErrors);
    return hasAtLeastOneComplete;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) return;
    if (!validate()) return;

    const payloadEntries = noExperience
      ? []
      : entries
          .filter((e) => e.title.trim() && e.company.trim())
          .map((e) => ({
            title: e.title.trim(),
            company: e.company.trim(),
            startDate: e.startDate.trim() || undefined,
            endDate: e.current ? undefined : e.endDate.trim() || undefined,
            current: e.current,
            description: e.description.trim() || undefined,
          }));

    setApiError(null);
    try {
      await onComplete({ experience: payloadEntries });
    } catch (error) {
      setApiError(getGuidedBuilderErrorMessage(error));
    }
  }

  return (
    <StepContainer>
      <StepTitle>Experience</StepTitle>
      <StepDescription>Tell us about your work history, most recent first.</StepDescription>

      <form onSubmit={handleSubmit} noValidate aria-busy={isBusy}>
        <StepSection>
          <CheckboxField
            label="I don't have any work experience yet"
            checked={noExperience}
            onChange={(e) => setNoExperience(e.target.checked)}
            disabled={isBusy}
          />
        </StepSection>

        {!noExperience &&
          entries.map((entry, index) => (
            <StepSection key={index} heading={entries.length > 1 ? `Experience ${index + 1}` : undefined}>
              <div className="space-y-4">
                <TextField
                  label="Job title"
                  required
                  value={entry.title}
                  onChange={(e) => updateEntry(index, { title: e.target.value })}
                  disabled={isBusy}
                />
                <TextField
                  label="Company"
                  required
                  value={entry.company}
                  onChange={(e) => updateEntry(index, { company: e.target.value })}
                  disabled={isBusy}
                />
                <div className="grid grid-cols-2 gap-4">
                  <TextField
                    label="Start date"
                    type="month"
                    value={entry.startDate}
                    onChange={(e) => updateEntry(index, { startDate: e.target.value })}
                    disabled={isBusy}
                  />
                  <TextField
                    label="End date"
                    type="month"
                    value={entry.endDate}
                    onChange={(e) => updateEntry(index, { endDate: e.target.value })}
                    disabled={isBusy || entry.current}
                  />
                </div>
                <CheckboxField
                  label="I currently work here"
                  checked={entry.current}
                  onChange={(e) => updateEntry(index, { current: e.target.checked, endDate: '' })}
                  disabled={isBusy}
                />
                <TextAreaField
                  label="Description (optional)"
                  value={entry.description}
                  onChange={(e) => updateEntry(index, { description: e.target.value })}
                  disabled={isBusy}
                />
                {errors[index] && (
                  <p role="alert" className="text-xs text-destructive">
                    {errors[index]}
                  </p>
                )}
                {entries.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeEntry(index)}
                    disabled={isBusy}
                    className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    Remove this entry
                  </button>
                )}
              </div>
            </StepSection>
          ))}

        {!noExperience && (
          <button
            type="button"
            onClick={addEntry}
            disabled={isBusy}
            className="text-sm font-medium text-primary underline-offset-2 hover:underline disabled:opacity-50"
          >
            + Add another experience entry
          </button>
        )}

        {apiError && (
          <div className="mt-6">
            <ApiErrorBanner message={apiError} />
          </div>
        )}

        <StepActions>
          <Button type="submit" isLoading={isBusy}>
            Continue
          </Button>
        </StepActions>
      </form>
    </StepContainer>
  );
}
