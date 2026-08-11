/**
 * @file src/pages/onboarding/profile/CompleteProfilePage.tsx
 *
 * WP-PRO-09F — Review, Completion & Route Registration
 *
 * Thin page for `ROUTES.ONBOARDING_PROFILE_COMPLETE` (`/onboarding/profile/complete`)
 * — the Professional Onboarding completion screen.
 *
 * Deliberately a NEW file/route, distinct from the existing, unrelated
 * `pages/onboarding/CompletePage.tsx` (`ROUTES.ONBOARDING_COMPLETE`,
 * `/onboarding/complete`), which is a separate, currently-stub screen used
 * for generic "AI recommendation generation" and is out of this work
 * package's scope. Repointing that existing route would touch other parts
 * of the onboarding tree — see the Repository Integrity Report's Missing
 * Components #2 — so a dedicated route/page is added instead.
 */

import {
  OnboardingShell,
  OnboardingHeader,
  OnboardingContent,
} from '@/components/onboarding/shell';

import { CompletionScreen } from '@/features/professional-onboarding/components/CompletionScreen';

export default function CompleteProfilePage() {
  return (
    <OnboardingShell>
      <OnboardingHeader title="Profile complete" description="Nice work — your profile is ready." />
      <OnboardingContent>
        <CompletionScreen />
      </OnboardingContent>
    </OnboardingShell>
  );
}
