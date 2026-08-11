/**
 * @file src/features/professional-onboarding/components/GuidedBuilderLayout.tsx
 *
 * WP-PRO-09D — Guided Profile Builder UI Implementation
 * Implements WP-PRO-09B §1 / WP-PRO-09D §1 + §6.
 *
 * Hosts every Guided Builder screen. Reuses the existing onboarding shell
 * primitives (`OnboardingShell`, `OnboardingHeader`, `OnboardingProgress`,
 * `OnboardingContent`) rather than duplicating layout/spacing rules — the
 * shell's own responsive/max-width behaviour applies unchanged.
 *
 * Progress always reflects backend state: `completedCount` /
 * `totalCount` are derived directly from the Progress API's `steps[]`
 * (via `useProfessionalOnboardingProgress`, WP-PRO-09C) — never a locally
 * maintained counter.
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import {
  OnboardingShell,
  OnboardingHeader,
  OnboardingContent,
  OnboardingProgress,
  OnboardingFooter,
} from '@/components/onboarding/shell';

import { useProfessionalOnboardingProgress } from '../hooks/useProfessionalOnboardingProgress';
import { getPreviousGuidedBuilderStep } from '../constants/step-registry';

interface GuidedBuilderLayoutProps {
  children: ReactNode;
}

export function GuidedBuilderLayout({ children }: GuidedBuilderLayoutProps) {
  const { progress, isFetching } = useProfessionalOnboardingProgress();

  const steps = progress?.steps ?? [];
  const completedCount = steps.filter((s) => s.completed).length;
  const totalCount = steps.length;
  const previousStep = getPreviousGuidedBuilderStep(progress?.currentStep);

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
            ariaLabel="Guided profile builder progress"
          />
          {isFetching && (
            <p className="mt-1 text-right text-[11px] text-muted-foreground" aria-hidden="true">
              Saving…
            </p>
          )}
        </div>
      )}

      <OnboardingContent>{children}</OnboardingContent>

      {previousStep?.route && (
        <OnboardingFooter>
          <Link
            to={previousStep.route}
            className="text-sm font-medium text-muted-foreground underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            ← Back to {previousStep.title}
          </Link>
        </OnboardingFooter>
      )}
    </OnboardingShell>
  );
}
