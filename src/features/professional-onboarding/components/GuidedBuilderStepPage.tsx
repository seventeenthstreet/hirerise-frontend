/**
 * @file src/features/professional-onboarding/components/GuidedBuilderStepPage.tsx
 *
 * WP-PRO-09D — Guided Profile Builder UI Implementation
 *
 * Composes the Guided Builder layout and the dynamic step renderer for a
 * specific, route-supplied `stepId`. This is the single component every
 * per-step page in `pages/onboarding/guided-builder/` renders — pages stay
 * thin (just supply which `stepId` they are), all real behaviour lives
 * here and in the components/hooks it wires together.
 */

import { GuidedBuilderLayout } from './GuidedBuilderLayout';
import { GuidedBuilderStepRenderer } from './GuidedBuilderStepRenderer';

interface GuidedBuilderStepPageProps {
  stepId: string;
}

export function GuidedBuilderStepPage({ stepId }: GuidedBuilderStepPageProps) {
  return (
    <GuidedBuilderLayout>
      <GuidedBuilderStepRenderer stepId={stepId} />
    </GuidedBuilderLayout>
  );
}
