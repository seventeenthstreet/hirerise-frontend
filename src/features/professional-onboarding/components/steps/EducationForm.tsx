/**
 * @file src/features/professional-onboarding/components/steps/EducationForm.tsx
 *
 * WP-PRO-09D — Guided Profile Builder UI Implementation
 *
 * Education step (`guided_education` → `POST /guided/education`, payload
 * `{ education: [...] }` per onboarding.guidedBuilder.service.js's
 * SECTION_NORMALIZERS). Field set matches `normalizeEducation`: degree,
 * institution, fieldOfStudy, startYear, endYear, grade.
 *
 * Gating step — at least one entry with degree + institution is required
 * before Continue is enabled, mirroring WP-PRO-09B §4.2.
 */

import { useState, type FormEvent } from 'react';

import type { OnboardingStepProps } from '@/components/onboarding/steps/types';
import { StepContainer, StepTitle, StepDescription, StepSection, StepActions } from '@/components/onboarding/steps';
import { Button } from '@/components/ui';

import { TextField, ApiErrorBanner } from '../FormField';
import { useRepeatableEntries } from '../../hooks/useRepeatableEntries';
import { getGuidedBuilderErrorMessage } from '../../utils/error-message';

interface EducationEntry {
  degree: string;
  institution: string;
  fieldOfStudy: string;
  startYear: string;
  endYear: string;
  grade: string;
}

const EMPTY_ENTRY: EducationEntry = {
  degree: '',
  institution: '',
  fieldOfStudy: '',
  startYear: '',
  endYear: '',
  grade: '',
};

function readInitialEntries(initialData: Record<string, unknown> | undefined): EducationEntry[] {
  const raw = initialData?.education;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const list = raw as Array<Record<string, unknown>>;
  return list.map((e) => ({
    degree: (e?.degree as string) ?? '',
    institution: (e?.institution as string) ?? '',
    fieldOfStudy: (e?.fieldOfStudy as string) ?? '',
    startYear: e?.startYear != null ? String(e.startYear) : '',
    endYear: e?.endYear != null ? String(e.endYear) : '',
    grade: (e?.grade as string) ?? '',
  }));
}

export default function EducationForm({ onComplete, isBusy, initialData }: OnboardingStepProps) {
  const { entries, updateEntry, addEntry, removeEntry } = useRepeatableEntries<EducationEntry>(
    readInitialEntries(initialData),
    EMPTY_ENTRY,
  );
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  function validate(): boolean {
    const nextErrors: Record<number, string> = {};
    const hasAtLeastOneComplete = entries.some((e) => e.degree.trim() && e.institution.trim());
    if (!hasAtLeastOneComplete) {
      entries.forEach((e, i) => {
        if (!e.degree.trim() || !e.institution.trim()) {
          nextErrors[i] = 'Enter at least a degree and institution.';
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

    // Only submit entries with the minimum required fields filled in —
    // an empty trailing row added via "Add another" and never filled in
    // is dropped rather than sent to the backend as junk data.
    const payloadEntries = entries
      .filter((e) => e.degree.trim() && e.institution.trim())
      .map((e) => ({
        degree: e.degree.trim(),
        institution: e.institution.trim(),
        fieldOfStudy: e.fieldOfStudy.trim() || undefined,
        startYear: e.startYear.trim() ? Number(e.startYear) : undefined,
        endYear: e.endYear.trim() ? Number(e.endYear) : undefined,
        grade: e.grade.trim() || undefined,
      }));

    setApiError(null);
    try {
      await onComplete({ education: payloadEntries });
    } catch (error) {
      setApiError(getGuidedBuilderErrorMessage(error));
    }
  }

  return (
    <StepContainer>
      <StepTitle>Education</StepTitle>
      <StepDescription>Add your academic background, starting with your most recent.</StepDescription>

      <form onSubmit={handleSubmit} noValidate aria-busy={isBusy}>
        {entries.map((entry, index) => (
          <StepSection key={index} heading={entries.length > 1 ? `Education ${index + 1}` : undefined}>
            <div className="space-y-4">
              <TextField
                label="Degree"
                required
                value={entry.degree}
                onChange={(e) => updateEntry(index, { degree: e.target.value })}
                disabled={isBusy}
              />
              <TextField
                label="Institution"
                required
                value={entry.institution}
                onChange={(e) => updateEntry(index, { institution: e.target.value })}
                disabled={isBusy}
              />
              <TextField
                label="Field of study"
                value={entry.fieldOfStudy}
                onChange={(e) => updateEntry(index, { fieldOfStudy: e.target.value })}
                disabled={isBusy}
              />
              <div className="grid grid-cols-2 gap-4">
                <TextField
                  label="Start year"
                  type="number"
                  inputMode="numeric"
                  value={entry.startYear}
                  onChange={(e) => updateEntry(index, { startYear: e.target.value })}
                  disabled={isBusy}
                />
                <TextField
                  label="End year"
                  type="number"
                  inputMode="numeric"
                  value={entry.endYear}
                  onChange={(e) => updateEntry(index, { endYear: e.target.value })}
                  disabled={isBusy}
                />
              </div>
              <TextField
                label="Grade (optional)"
                value={entry.grade}
                onChange={(e) => updateEntry(index, { grade: e.target.value })}
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

        <button
          type="button"
          onClick={addEntry}
          disabled={isBusy}
          className="text-sm font-medium text-primary underline-offset-2 hover:underline disabled:opacity-50"
        >
          + Add another education entry
        </button>

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
