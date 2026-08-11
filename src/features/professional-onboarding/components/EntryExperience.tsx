/**
 * @file src/features/professional-onboarding/components/EntryExperience.tsx
 *
 * WP-PRO-09D — Guided Profile Builder UI Implementation
 * Implements WP-PRO-09B §2 / WP-PRO-09D §3.
 *
 * First screen: choose Upload Resume or Build My Profile. Per
 * `method_choice`'s definition in professional-onboarding.definition.js,
 * this step has NO backend endpoint — selecting either option is pure
 * client-side navigation using the existing route constants (WP-PRO-09C).
 * The track is established the moment the user's first real action fires
 * (`POST /upload-cv` or `POST /guided/personal_details`), not here.
 *
 * If the user already has Guided Builder progress (e.g. returning to this
 * screen after starting), this component redirects them straight back into
 * their current step rather than re-showing the choice — reusing the same
 * Progress API + track inference + step registry already built in
 * WP-PRO-09C, not new logic.
 *
 * Resume Upload has no destination screen yet (out of scope for
 * WP-PRO-09D, WP-PRO-09B §Resume Upload Journey belongs to a later work
 * package) — selecting it still navigates via the real route constant;
 * see the implementation report's Known Issues for the interim behaviour.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/routes/routes.constants';
import { Card, CardContent, Spinner } from '@/components/ui';
import { StepContainer, StepTitle, StepDescription } from '@/components/onboarding/steps';

import { useProfessionalOnboardingProgress } from '../hooks/useProfessionalOnboardingProgress';
import { resolveStep } from '../constants/step-registry';

export function EntryExperience() {
  const navigate = useNavigate();
  const { progress, track, isLoading } = useProfessionalOnboardingProgress();

  const alreadyOnGuidedTrack = track === 'guided_builder';
  const inFlightGuidedRoute = alreadyOnGuidedTrack ? resolveStep(progress?.currentStep)?.route : undefined;

  // Returning user with an in-progress Guided Builder session — skip the
  // choice screen and resume exactly where the Progress API says they are.
  useEffect(() => {
    if (inFlightGuidedRoute) {
      navigate(inFlightGuidedRoute, { replace: true });
    }
  }, [inFlightGuidedRoute, navigate]);

  if (isLoading || inFlightGuidedRoute) {
    return (
      <div className="flex justify-center py-16" role="status" aria-live="polite">
        <Spinner size="lg" label="Loading your progress" />
      </div>
    );
  }

  return (
    <StepContainer maxWidth="max-w-2xl">
      <StepTitle>How would you like to build your profile?</StepTitle>
      <StepDescription>Choose whichever is quicker for you — you can always add more detail later.</StepDescription>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => navigate(ROUTES.ONBOARDING_RESUME_UPLOAD)}
          className="text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-xl"
        >
          <Card className="h-full p-0 transition-colors hover:border-primary">
            <CardContent>
              <h3 className="text-base font-semibold text-foreground">Upload resume</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Upload your existing resume and we&apos;ll fill in your profile automatically.
              </p>
            </CardContent>
          </Card>
        </button>

        <button
          type="button"
          onClick={() => navigate(ROUTES.ONBOARDING_BUILDER_ROOT)}
          className="text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-xl"
        >
          <Card className="h-full p-0 transition-colors hover:border-primary">
            <CardContent>
              <h3 className="text-base font-semibold text-foreground">Build my profile</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Answer a few guided questions about your background and goals.
              </p>
            </CardContent>
          </Card>
        </button>
      </div>
    </StepContainer>
  );
}
