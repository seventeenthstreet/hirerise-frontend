/**
 * @file src/pages/onboarding/ProfilePage.tsx
 *
 * WP-PRO-09D — Guided Profile Builder UI Implementation
 *
 * Entry Experience page — served at ROUTES.ONBOARDING_PROFILE
 * ('/onboarding/profile'), guarded by <OnboardingGuard requiredStep="welcome">
 * in routes/index.tsx (unchanged).
 *
 * Thin page: all real behaviour lives in
 * '@/features/professional-onboarding' (EntryExperience component), which
 * renders its own heading via the shared StepTitle primitive — no separate
 * OnboardingHeader here to avoid a duplicated page title.
 */

import { OnboardingShell } from '@/components/onboarding/shell';
import { EntryExperience } from '@/features/professional-onboarding';

export default function ProfilePage() {
  return (
    <OnboardingShell>
      <EntryExperience />
    </OnboardingShell>
  );
}
