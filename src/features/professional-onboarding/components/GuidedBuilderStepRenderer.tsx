/**
 * @file src/features/professional-onboarding/components/GuidedBuilderStepRenderer.tsx
 *
 * WP-PRO-09D — Guided Profile Builder UI Implementation
 * Implements WP-PRO-09B §5 / WP-PRO-09D §2.
 *
 * Renders the Guided Builder step identified by `stepId` (a prop supplied
 * by the route it's mounted at — WP-PRO-09C's `ONBOARDING_BUILDER_*`
 * routes are one-per-step, so each is deep-linkable and back-button
 * friendly). This is "resolve current step" in the sense of "the step
 * currently being viewed"; it is deliberately NOT tied to the backend's
 * `currentStep` for DISPLAY purposes, because a user must be able to
 * navigate Back to an already-completed step and see it (WP-PRO-09B §4.2,
 * §8.3) without the renderer snapping back to whatever the server considers
 * the frontier step.
 *
 * What IS driven exclusively by the backend's `currentStep` — per WP-PRO-09D
 * §5's explicit requirement — is what happens next after a successful save:
 * `useAdvanceToNextStep` (WP-PRO-09D) performs a fresh Progress API read
 * after every save and navigates to whatever step that fresh read says is
 * current. Nothing in this component (or anywhere else in this feature)
 * computes "the next step" as a locally incremented index.
 *
 * Contains NO business/completion logic beyond this resolve -> save ->
 * advance wiring — all gating/validation/completion decisions remain
 * server-side.
 */

import { Suspense } from 'react';

import { Spinner } from '@/components/ui';
import { ErrorBoundary } from '@/components/system/ErrorBoundary';

import { useProfessionalOnboardingProgress } from '../hooks/useProfessionalOnboardingProgress';
import { useGuidedBuilderProfile } from '../hooks/useGuidedBuilderProfile';
import { useSaveGuidedSection } from '../hooks/useSaveGuidedSection';
import { useAdvanceToNextStep } from '../hooks/useAdvanceToNextStep';
import { resolveStep } from '../constants/step-registry';
import { getGuidedBuilderErrorMessage } from '../utils/error-message';
import type { GuidedBuilderSection } from '../types';

interface GuidedBuilderStepRendererProps {
  /** The Guided Builder `stepId` this route corresponds to, e.g. 'guided_personal_details'. */
  stepId: string;
}

// A section value is always required to call `useSaveGuidedSection` (Rules
// of Hooks - the hook itself must be called unconditionally on every
// render, with a stable-shaped argument). When `stepId` doesn't resolve to
// a known gating section (an unrecognised id - see the fallback below),
// this placeholder is used as the hook's argument; it is never actually
// invoked, because the JSX only renders a submit-capable step component
// once the entry is confirmed resolved.
const PLACEHOLDER_SECTION: GuidedBuilderSection = 'personal_details';

export function GuidedBuilderStepRenderer({ stepId }: GuidedBuilderStepRendererProps) {
  const { isLoading: progressLoading, error: progressError, refetch: refetchProgress } =
    useProfessionalOnboardingProgress();
  const { profile, isLoading: profileLoading, error: profileError, refetch: refetchProfile } =
    useGuidedBuilderProfile();

  const entry = resolveStep(stepId);
  const section = entry?.section ?? PLACEHOLDER_SECTION;

  const saveSection = useSaveGuidedSection(section);
  const { advance } = useAdvanceToNextStep();

  function retry() {
    refetchProgress();
    refetchProfile();
  }

  // -- Loading state ----------------------------------------------------------
  if (progressLoading || profileLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16" role="status" aria-live="polite">
        <Spinner size="lg" label="Loading your profile" />
        <p className="text-sm text-muted-foreground">Loading your profile…</p>
      </div>
    );
  }

  // -- Progress / profile load failure -----------------------------------------
  if (progressError || profileError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-6 text-center" role="alert">
        <p className="text-sm text-destructive">
          {getGuidedBuilderErrorMessage(progressError ?? profileError)}
        </p>
        <button
          type="button"
          onClick={retry}
          className="mt-3 text-sm font-medium text-destructive underline underline-offset-2"
        >
          Try again
        </button>
      </div>
    );
  }

  // -- Unknown / unresolved step - safe fallback, never a crash ----------------
  // Covers: an unrecognised stepId (future Definition Engine change), or a
  // resolved entry with no component wired up yet (e.g. a Resume Upload
  // track stepId, which this renderer doesn't own).
  if (!entry || !entry.component || !entry.section) {
    return (
      <div className="rounded-lg border border-border bg-muted/40 px-4 py-6 text-center">
        <p className="text-sm text-foreground">We couldn&apos;t load this step of your profile setup.</p>
        <p className="mt-1 text-xs text-muted-foreground">Unrecognised step: {stepId}</p>
        <button
          type="button"
          onClick={retry}
          className="mt-3 text-sm font-medium text-primary underline underline-offset-2"
        >
          Refresh
        </button>
      </div>
    );
  }

  const StepComponent = entry.component;

  async function handleComplete(data: Record<string, unknown>): Promise<void> {
    await saveSection.mutateAsync(data);
    await advance();
  }

  return (
    <ErrorBoundary
      context="GuidedBuilderStep"
      resetKey={stepId}
      fallback={
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-6 text-center" role="alert">
          <p className="text-sm text-destructive">
            Something went wrong loading this step. Your saved progress is safe.
          </p>
          <button
            type="button"
            onClick={retry}
            className="mt-3 text-sm font-medium text-destructive underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      }
    >
      <Suspense
        fallback={
          <div className="flex justify-center py-16" role="status" aria-live="polite">
            <Spinner size="lg" label="Loading step" />
          </div>
        }
      >
        <StepComponent
          onComplete={handleComplete}
          isBusy={saveSection.isPending}
          initialData={profile ?? undefined}
        />
      </Suspense>
    </ErrorBoundary>
  );
}
