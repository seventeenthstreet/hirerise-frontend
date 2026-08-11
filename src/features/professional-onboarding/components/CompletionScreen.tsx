/**
 * @file src/features/professional-onboarding/components/CompletionScreen.tsx
 *
 * WP-PRO-09F — Review, Completion & Route Registration
 * WP-PRO-03  — Post-Onboarding Experience & AI Feature Entry (follow-up)
 *
 * Rendered inside `pages/onboarding/profile/CompleteProfilePage.tsx` at
 * `ROUTES.ONBOARDING_PROFILE_COMPLETE`. By the time a user reaches this
 * screen, `useCompleteOnboarding()` has already been called successfully
 * by `ReviewScreen` — onboarding completion is done.
 *
 * WP-PRO-03 follow-up: this screen no longer offers AI career-report
 * generation. Onboarding's responsibility ends at a valid profile; AI
 * capabilities (career report, resume intelligence, career blueprint, and
 * future capabilities) are exclusively entered from the Dashboard — see
 * components/dashboard/GenerateCareerReportCard.tsx, which reuses the same
 * useGenerateCareerReport mutation this screen used to call directly.
 * The single action here is "Go to Dashboard".
 */

import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/routes/routes.constants';
import { Button } from '@/components/ui';
import { StepContainer, StepTitle, StepDescription, StepActions } from '@/components/onboarding/steps';

export function CompletionScreen() {
  const navigate = useNavigate();

  function handleGoToDashboard() {
    navigate(ROUTES.DASHBOARD_HOME);
  }

  return (
    <StepContainer maxWidth="max-w-2xl">
      <StepTitle>Profile complete</StepTitle>
      <StepDescription>
        Your HireRise profile is ready. Continue to your dashboard to start exploring your career insights.
      </StepDescription>

      <StepActions align="left">
        <Button type="button" onClick={handleGoToDashboard}>
          Go to Dashboard
        </Button>
      </StepActions>
    </StepContainer>
  );
}
