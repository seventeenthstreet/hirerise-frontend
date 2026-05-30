

/**
 * @file front/src/modules/student-onboarding/steps/cognitive-step.tsx
 *
 * STEP: COGNITIVE & PROCESSING INTELLIGENCE (Phase 3C)
 * ══════════════════════════════════════════════════════
 * Drop-in replacement for the Phase 2 placeholder cognitive-step.tsx.
 * Same file path. Same export name. Same OnboardingStepProps interface.
 *
 * SESSION ADVANCEMENT:
 *   This step mirrors the 'academics' pattern — the step component calls
 *   onComplete({ next_step: 'aspiration' }) and page.tsx handles session
 *   advancement via useUpdateOnboardingStep:
 *
 *     case 'cognitive': {
 *       await advanceStep({ completedStep: 'cognitive', nextStep: 'aspiration' });
 *     }
 *
 *   The POST /commit endpoint extracts signals and marks responses committed,
 *   but does NOT touch the session row. That is page.tsx's responsibility.
 *
 * PROGRESSIVE PERSISTENCE:
 *   Every option tap fires useSaveResponse in the background.
 *   On Continue, useCommitCognitive validates + extracts signals, then
 *   onComplete() passes control to page.tsx for session advancement.
 *
 * RECOVERY:
 *   useCognitiveStep.data.responseMap hydrates localSelections on mount,
 *   restoring all previous answers transparently across refreshes.
 */

import { useCallback, useEffect, useState } from 'react';
import type { OnboardingStepProps }         from '../constants/step-props';

import CognitiveProgress from '../cognitive/components/CognitiveProgress';
import DomainSection     from '../cognitive/components/DomainSection';

import {
  useCognitiveStep,
  useCommitCognitive,
  useSaveResponse,
  type CognitiveStepData,
} from '../cognitive/hooks/use-cognitive';

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function CognitiveStep({ onComplete, isBusy }: OnboardingStepProps) {
  const stepQuery     = useCognitiveStep();
  const saveResponse  = useSaveResponse();
  const commitCognitive = useCommitCognitive();

  const stepData: CognitiveStepData | undefined = stepQuery.data;

  // ── Local ephemeral selection state ──
  // Hydrated from server responseMap on first data load.
  // Updated optimistically on every option tap before the background save resolves.
  const [localSelections, setLocalSelections] = useState<Record<string, string[]>>({});
  const [hasHydrated, setHasHydrated]         = useState(false);
  const [submitError, setSubmitError]          = useState<string | null>(null);

  // Hydrate once from server data — preserves local taps made before data arrives
  useEffect(() => {
    if (!hasHydrated && stepData?.responseMap) {
      setLocalSelections(stepData.responseMap);
      setHasHydrated(true);
    }
  }, [hasHydrated, stepData?.responseMap]);

  // ── Option selection handler ──
  // 1. Optimistically update local state (instant visual feedback, no flicker)
  // 2. Fire background save — swallow errors; commit gate catches any gaps
  const handleSelect = useCallback(
    (questionId: string, selectedKeys: string[]) => {
      setLocalSelections((prev) => ({ ...prev, [questionId]: selectedKeys }));
      setSubmitError(null);

      saveResponse.mutate({
        questionId,
        selectedOptionKeys: selectedKeys,
        isPartial: true,
      });
    },
    [saveResponse],
  );

  // ── Commit handler ──
  // Mirrors activities-step.tsx: call commit, then onComplete with next_step.
  async function handleCommit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const signalQuality = stepData?.signalQuality;
    if (!signalQuality?.isSufficient) {
      const remaining = signalQuality
        ? signalQuality.requiredTotal - signalQuality.requiredAnswered
        : '?';
      setSubmitError(
        `Please answer all required questions before continuing. (${remaining} remaining)`,
      );
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const result = await commitCognitive.mutateAsync();
      // Pass next_step hint to page.tsx for session advancement dispatch.
      // page.tsx switch(case 'cognitive') will call advanceStep().
      await onComplete({ next_step: 'aspiration' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save. Please try again.';
      setSubmitError(msg);
    }
  }

  const isBusyOverall  = isBusy || saveResponse.isPending || commitCognitive.isPending;
  const signalQuality  = stepData?.signalQuality;
  const isSufficient   = signalQuality?.isSufficient ?? false;
  const requiredTotal  = signalQuality?.requiredTotal ?? 0;
  const requiredAnswered = signalQuality?.requiredAnswered ?? 0;

  // ── Loading state ──
  if (stepQuery.isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  // ── Error state ──
  if (stepQuery.isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="text-sm font-medium text-destructive">
          Could not load cognitive questions.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {(stepQuery.error as Error)?.message ?? 'An unexpected error occurred.'}
        </p>
        <button
          type="button"
          onClick={() => stepQuery.refetch()}
          className="mt-4 rounded-lg bg-muted px-4 py-2 text-sm font-medium hover:bg-muted/80"
        >
          Retry
        </button>
      </div>
    );
  }

  const domainGroups = stepData?.domainGroups ?? [];

  // ── Empty taxonomy guard ──
  if (domainGroups.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Cognitive questions are not available yet. Please refresh the page.
        </p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleCommit} className="space-y-6" noValidate>

      {/* Step header */}
      <div>
        <h2 className="text-base font-semibold text-foreground">
          How You Think & Work
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          These short scenarios help us understand your natural approach to
          learning and problem-solving — there are no right or wrong answers.
        </p>
      </div>

      {/* Domain-level progress bar + pills */}
      <CognitiveProgress
        domainGroups={domainGroups}
        responseMap={localSelections}
        requiredTotal={requiredTotal}
        requiredAnswered={requiredAnswered}
      />

      {/* One collapsible section per cognitive domain */}
      <div className="space-y-4">
        {domainGroups.map((group, index) => (
          <DomainSection
            key={group.domain}
            group={group}
            responseMap={localSelections}
            onSelect={handleSelect}
            isSaving={isBusyOverall}
            defaultOpen={index === 0}
          />
        ))}
      </div>

      {/* Inline error message */}
      {submitError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {submitError}
        </p>
      )}

      {/* Continue button — disabled until all required questions answered */}
      <button
        type="submit"
        disabled={isBusyOverall || !isSufficient}
        className={[
          'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5',
          'text-sm font-medium text-primary-foreground transition-opacity',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          isSufficient && !isBusyOverall
            ? 'bg-primary hover:opacity-90'
            : 'cursor-not-allowed bg-primary/40',
        ].join(' ')}
        aria-disabled={!isSufficient || isBusyOverall}
      >
        {commitCognitive.isPending ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" aria-hidden="true" />
            Saving…
          </>
        ) : !isSufficient ? (
          `Answer ${requiredTotal - requiredAnswered} more required question${
            requiredTotal - requiredAnswered !== 1 ? 's' : ''
          } to continue`
        ) : (
          'Continue →'
        )}
      </button>

      {/* Optional question nudge — only shown once required threshold is met */}
      {isSufficient && (
        <p className="text-center text-xs text-muted-foreground">
          You can also answer the optional questions above for a fuller profile.
        </p>
      )}

    </form>
  );
}
