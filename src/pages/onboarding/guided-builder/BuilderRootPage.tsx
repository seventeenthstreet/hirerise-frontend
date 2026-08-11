/**
 * @file src/pages/onboarding/guided-builder/BuilderRootPage.tsx
 *
 * WP-PRO-09F — Review, Completion & Route Registration
 *
 * Thin page for `ROUTES.ONBOARDING_BUILDER_ROOT` (`/onboarding/profile/build`).
 * Registers the existing `GuidedBuilderIndexRedirect` (built in WP-PRO-09D,
 * previously unrouted) at its intended route. No new behaviour lives here —
 * the redirect-to-current-step logic already exists and is untouched.
 *
 * Default export only so `React.lazy()` in `routes/lazy-imports.ts` can
 * import it, mirroring every other page in this router.
 */

import { GuidedBuilderIndexRedirect } from '@/features/professional-onboarding/components/GuidedBuilderIndexRedirect';

export default function BuilderRootPage() {
  return <GuidedBuilderIndexRedirect />;
}
