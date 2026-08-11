/**
 * @file src/pages/onboarding/ResumeUploadPage.tsx
 * Served at ROUTES.ONBOARDING_RESUME_UPLOAD ('/onboarding/profile/resume').
 * Thin page — real behaviour lives in ResumeUploadScreen.
 */

import { OnboardingShell } from '@/components/onboarding/shell';
import { ResumeUploadScreen } from '@/features/professional-onboarding';

export default function ResumeUploadPage() {
  return (
    <OnboardingShell>
      <ResumeUploadScreen />
    </OnboardingShell>
  );
}
