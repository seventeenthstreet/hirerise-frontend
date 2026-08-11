/**
 * @file src/features/professional-onboarding/components/steps/CareerGoalsForm.tsx
 *
 * WP-PRO-09D — Guided Profile Builder UI Implementation
 *
 * Career Goals step (`guided_career_goals` → `POST /guided/career_goals`).
 * Field set matches `normalizeCareerGoals`: `targetRole` (free text) and
 * `expectedRoleIds` (an array of role catalog ids). This form only collects
 * `targetRole` — `expectedRoleIds` requires a role-catalog search/picker
 * component that doesn't exist yet in this repository and is out of scope
 * for WP-PRO-09D's UI-only mandate; see Known Issues in the implementation
 * report. Omitting it is safe: `normalizeCareerGoals` treats both fields as
 * independently optional (`compact()` drops whichever is absent).
 *
 * OPTIONAL / non-gating step (professional-onboarding.definition.js marks
 * `guided_career_goals.required = false`) — this is the LAST step in the
 * Guided Builder track; on success the renderer's shared
 * `useAdvanceToNextStep` naturally lands the user on the Review route
 * (out of scope for this work package, but the route already exists).
 */

import { useState, type FormEvent } from 'react';

import type { OnboardingStepProps } from '@/components/onboarding/steps/types';
import { StepContainer, StepTitle, StepDescription, StepActions } from '@/components/onboarding/steps';
import { Button } from '@/components/ui';

import { TextField, ApiErrorBanner } from '../FormField';
import { getGuidedBuilderErrorMessage } from '../../utils/error-message';

function readInitialTargetRole(initialData: Record<string, unknown> | undefined): string {
  const goals = (initialData?.careerGoals ?? {}) as { targetRole?: string };
  return goals.targetRole ?? '';
}

export default function CareerGoalsForm({ onComplete, isBusy, initialData }: OnboardingStepProps) {
  const [targetRole, setTargetRole] = useState<string>(() => readInitialTargetRole(initialData));
  const [apiError, setApiError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) return;

    setApiError(null);
    try {
      await onComplete({ targetRole: targetRole.trim() || undefined });
    } catch (error) {
      setApiError(getGuidedBuilderErrorMessage(error));
    }
  }

  return (
    <StepContainer>
      <StepTitle>Career goals</StepTitle>
      <StepDescription>
        What role are you aiming for next? This is optional and helps us tailor your career intelligence.
      </StepDescription>

      <form onSubmit={handleSubmit} noValidate aria-busy={isBusy}>
        <TextField
          label="Target role"
          placeholder="e.g. Senior Product Designer"
          value={targetRole}
          onChange={(e) => setTargetRole(e.target.value)}
          disabled={isBusy}
        />

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
