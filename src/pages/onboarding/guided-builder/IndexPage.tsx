/**
 * @file src/pages/onboarding/guided-builder/IndexPage.tsx
 *
 * WP-PRO-09D — Guided Profile Builder UI Implementation
 * Served at ROUTES.ONBOARDING_BUILDER_ROOT ('/onboarding/profile/build').
 * Redirects to whichever step route the backend's currentStep resolves to.
 */

import { GuidedBuilderIndexRedirect } from '@/features/professional-onboarding';

export default function GuidedBuilderIndexPage() {
  return <GuidedBuilderIndexRedirect />;
}
