/**
 * @file src/pages/onboarding/profile/ReviewPage.tsx
 *
 * WP-PRO-09F — Review, Completion & Route Registration
 *
 * Thin page for `ROUTES.ONBOARDING_PROFILE_REVIEW` (`/onboarding/profile/review`).
 * Mirrors the existing `ResumeUploadPage` / `GuidedBuilderStepPage` pattern:
 * the page only composes the shared onboarding shell primitives around the
 * real screen content (`ReviewScreen`) — no business logic lives here.
 *
 * Uses the shell directly (not `GuidedBuilderLayout`) because Review is the
 * shared convergence point for BOTH onboarding tracks (Guided Builder and
 * Resume Upload), not something that belongs to the Guided Builder track's
 * own "Back to previous step" navigation.
 */

import {
  OnboardingShell,
  OnboardingHeader,
  OnboardingContent,
} from '@/components/onboarding/shell';

import { ReviewScreen } from '@/features/professional-onboarding/components/ReviewScreen';

export default function ReviewPage() {
  return (
    <OnboardingShell>
      <OnboardingHeader
        title="Review your profile"
        description="Take a quick look before we finish setting things up."
      />
      <OnboardingContent>
        <ReviewScreen />
      </OnboardingContent>
    </OnboardingShell>
  );
}
