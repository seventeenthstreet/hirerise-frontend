/**
 * @file src/features/professional-onboarding/components/steps/SkillsForm.tsx
 *
 * WP-PRO-09D — Guided Profile Builder UI Implementation
 *
 * Skills step (`guided_skills` → `POST /guided/skills`, payload
 * `{ skills: [...] }`, entries as plain strings — matches
 * `normalizeSkills`, which accepts `string | { name }` and tags each as
 * `source: 'declared'`).
 *
 * OPTIONAL / non-gating step (professional-onboarding.definition.js marks
 * `guided_skills.required = false`) — Continue is always enabled, matching
 * WP-PRO-09B §4.4. The enrichment-only sub-panels (certifications, projects,
 * languages, employment_preferences) described in WP-PRO-09B §4.4–4.5 are
 * explicitly out of scope for WP-PRO-09D (UI-only work package covering the
 * five gating/optional Guided Builder screens) and are deferred — see the
 * Known Issues section of the implementation report.
 */

import { useState, type FormEvent, type KeyboardEvent } from 'react';

import type { OnboardingStepProps } from '@/components/onboarding/steps/types';
import { StepContainer, StepTitle, StepDescription, StepActions } from '@/components/onboarding/steps';
import { Button } from '@/components/ui';

import { TextField, ApiErrorBanner } from '../FormField';
import { getGuidedBuilderErrorMessage } from '../../utils/error-message';

function readInitialSkills(initialData: Record<string, unknown> | undefined): string[] {
  const raw = initialData?.skills;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => (typeof s === 'string' ? s : (s as { name?: string })?.name))
    .filter((s): s is string => !!s && s.trim().length > 0);
}

export default function SkillsForm({ onComplete, isBusy, initialData }: OnboardingStepProps) {
  const [skills, setSkills] = useState<string[]>(() => readInitialSkills(initialData));
  const [draft, setDraft] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);

  function commitDraft() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (!skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setSkills((prev) => [...prev, trimmed]);
    }
    setDraft('');
  }

  function handleDraftKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commitDraft();
    }
  }

  function removeSkill(skill: string) {
    setSkills((prev) => prev.filter((s) => s !== skill));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) return;
    commitDraft();

    setApiError(null);
    try {
      await onComplete({ skills });
    } catch (error) {
      setApiError(getGuidedBuilderErrorMessage(error));
    }
  }

  return (
    <StepContainer>
      <StepTitle>Skills</StepTitle>
      <StepDescription>
        Add the skills you&apos;d like on your profile. This step is optional — you can skip it and add skills later.
      </StepDescription>

      <form onSubmit={handleSubmit} noValidate aria-busy={isBusy}>
        <div role="group" aria-label="Skills">
          {skills.length > 0 && (
            <ul className="mb-3 flex flex-wrap gap-2" aria-label="Added skills">
              {skills.map((skill) => (
                <li key={skill}>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-foreground">
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      disabled={isBusy}
                      aria-label={`Remove ${skill}`}
                      className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                    >
                      ×
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <TextField
            label="Add a skill"
            placeholder="e.g. Python — press Enter to add"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleDraftKeyDown}
            onBlur={commitDraft}
            disabled={isBusy}
          />
        </div>

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
