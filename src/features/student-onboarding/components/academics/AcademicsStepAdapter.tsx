'use client';

/**
 * @file front/src/features/student-onboarding/components/academics/AcademicsStepAdapter.tsx
 *
 * ADAPTER — Phase 3A AcademicsStep → OnboardingStepProps registry contract
 * ──────────────────────────────────────────────────────────────────────────
 * The onboarding step registry requires every component to accept OnboardingStepProps.
 * AcademicsStep is self-contained: it fetches its own data, manages its own draft
 * state, and navigates via session invalidation on commit. It does not use onComplete,
 * isBusy, or initialData.
 *
 * This adapter is the only change needed to wire AcademicsStep into the registry.
 * It accepts OnboardingStepProps (satisfying the type contract) and renders the
 * real Phase 3A component. Props are intentionally ignored — AcademicsStep does
 * its own I/O through useSaveAcademicYear and query invalidation.
 *
 * DO NOT add prop forwarding here.
 * DO NOT add onComplete calls here.
 * The AcademicsStep already handles session advancement internally via
 * useSaveAcademicYear → onSettled → invalidateQueries(session).
 */

import type { OnboardingStepProps } from '@/modules/student-onboarding/constants/step-props';
import { AcademicsStep }            from './AcademicsStep';

// Props accepted to satisfy registry type contract — not forwarded to AcademicsStep.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function AcademicsStepAdapter(_props: OnboardingStepProps) {
  return <AcademicsStep />;
}
