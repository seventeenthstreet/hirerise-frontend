/**
 * @file src/pages/onboarding/profile/ResumeUploadPage.tsx
 *
 * WP-PRO-09E — Resume Upload Experience Implementation
 *
 * Thin page for `ROUTES.ONBOARDING_RESUME_UPLOAD` (`/onboarding/profile/resume`).
 * Mirrors the existing `GuidedBuilderStepPage` pattern: the page itself only
 * composes the shared onboarding shell primitives around the real screen
 * content (`ResumeUploadScreen`) — no business logic lives here.
 *
 * Progress bar + "Back" link reuse the exact same shell primitives and
 * progress-derivation approach as `GuidedBuilderLayout`
 * (`components/onboarding/shell/*`, `useProfessionalOnboardingProgress`) —
 * not duplicated, just applied to this track's steps instead.
 */

import { Link } from 'react-router-dom';

import {
  OnboardingShell,
  OnboardingHeader,
  OnboardingContent,
  OnboardingProgress,
  OnboardingFooter,
} from '@/components/onboarding/shell';
import { ROUTES } from '@/routes/routes.constants';

import { ResumeUploadScreen } from '@/features/professional-onboarding/components/ResumeUploadScreen';
import { useProfessionalOnboardingProgress } from '@/features/professional-onboarding/hooks/useProfessionalOnboardingProgress';

export default function ResumeUploadPage() {
  const { progress, isFetching } = useProfessionalOnboardingProgress();

  const steps = progress?.steps ?? [];
  const completedCount = steps.filter((s) => s.completed).length;
  const totalCount = steps.length;

  return (
    <OnboardingShell>
      <OnboardingHeader
        title="Build your profile"
        description="A few quick steps so we can tailor your career intelligence."
      />

      {totalCount > 0 && (
        <div className="mb-8">
          <OnboardingProgress
            completedCount={completedCount}
            totalCount={totalCount}
            ariaLabel="Resume upload progress"
          />
          {isFetching && (
            <p className="mt-1 text-right text-[11px] text-muted-foreground" aria-hidden="true">
              Saving…
            </p>
          )}
        </div>
      )}

      <OnboardingContent>
        <ResumeUploadScreen />
      </OnboardingContent>

      <OnboardingFooter>
        <Link
          to={ROUTES.ONBOARDING_PROFILE}
          className="text-sm font-medium text-muted-foreground underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          ← Back
        </Link>
      </OnboardingFooter>
    </OnboardingShell>
  );
}
