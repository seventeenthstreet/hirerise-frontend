/**
 * @file src/features/professional-onboarding/components/GuidedBuilderIndexRedirect.tsx
 *
 * WP-PRO-09D — Guided Profile Builder UI Implementation
 *
 * Renders at `ROUTES.ONBOARDING_BUILDER_ROOT` (`/onboarding/profile/build`).
 * The Guided Builder's actual step screens each have their own real, static
 * route (WP-PRO-09C's `ONBOARDING_BUILDER_PERSONAL` / `_EDUCATION` / ...) so
 * they're deep-linkable and back-button-friendly. This component's only job
 * is to redirect the bare root path to whichever step route the backend's
 * `currentStep` resolves to — driven by the Progress API, not a locally
 * computed "first step".
 */

import { Navigate } from 'react-router-dom';

import { ROUTES } from '@/routes/routes.constants';
import { Spinner } from '@/components/ui';

import { useProfessionalOnboardingProgress } from '../hooks/useProfessionalOnboardingProgress';
import { resolveStep } from '../constants/step-registry';

export function GuidedBuilderIndexRedirect() {
  const { progress, isLoading } = useProfessionalOnboardingProgress();

  if (isLoading) {
    return (
      <div className="flex justify-center py-16" role="status" aria-live="polite">
        <Spinner size="lg" label="Loading your progress" />
      </div>
    );
  }

  const entry = resolveStep(progress?.currentStep);
  const target = entry?.route ?? ROUTES.ONBOARDING_BUILDER_PERSONAL;

  return <Navigate to={target} replace />;
}
