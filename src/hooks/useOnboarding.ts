/**
 * hooks/useOnboarding.ts
 *
 * Onboarding flow data layer.
 *
 * v3 — Phase 2.6 Gap Closure: React Query migration
 *
 * BEFORE (v2): Manual useState + useCallback + useRef for all state.
 *   fetchSteps() fired its own GET each call with no cache deduplication.
 *   saveProgress() and submitOnboarding() were async functions with
 *   analytics side-effects woven directly into the try/catch body.
 *
 * AFTER (v3):
 *   ┌─────────────────────────────────────────────────────────────────────┐
 *   │  READ PATH                                                          │
 *   │  fetchSteps → useQuery({ queryKey: onboarding.all() })             │
 *   │   - Progress fetched once, cached, deduplicated across consumers   │
 *   │   - currentStep + restoredData derived via selector (stable ref)   │
 *   │   - stepsLoading / restoreLoading unified into isLoading           │
 *   │                                                                     │
 *   │  WRITE PATH                                                         │
 *   │  saveProgress    → useMutation (save step draft)                   │
 *   │  submitOnboarding → useMutation (terminal submit)                  │
 *   │   - Analytics fired in onSuccess / onError callbacks               │
 *   │   - Timing via startTimer in mutationFn, result piped to onSuccess │
 *   │   - variantRef + onboardingStartMsRef preserved as refs            │
 *   └─────────────────────────────────────────────────────────────────────┘
 *
 * ANALYTICS PRESERVATION:
 *   All trackEvent, funnelContract, captureError, startTimer calls are
 *   preserved identically — they have moved from inside async try/catch
 *   blocks into useMutation onSuccess/onError callbacks, which is the
 *   correct React Query v5 pattern for mutation side-effects.
 *
 *   startTimer cannot be called inside queryFn (it starts before the
 *   request, the result is needed after). Pattern: call startTimer at
 *   the top of mutationFn, capture the stopTimer fn, call it in onSuccess
 *   / onError. The timer runs across the full mutation lifecycle.
 *   NOTE: useMutation callbacks do not share closure with mutationFn refs,
 *   so stopTimer is stored in a module-level ref scoped to the hook instance.
 *
 * RETURN CONTRACT:
 *   Preserved verbatim. The onboarding page destructures:
 *     steps, currentStep, stepsLoading, restoreLoading, goToStep,
 *     saveProgress, submitOnboarding, restoredData, error, isSubmitting,
 *     setVariant
 *   All of these are present with the same types as before.
 *
 *   stepsLoading and restoreLoading were previously separate flags that
 *   both tracked the same single fetch. They are now aliases of
 *   query.isLoading — both remain in the return object for compatibility.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '@/context/AppContext';

import {
  getOnboardingSteps,
  submitOnboardingStep,
} from '@/lib/api/onboarding';
import type {
  OnboardingStep,
  OnboardingProgressResponse,
} from '@/lib/api/onboarding';
import type { ApiClientError } from '@/lib/api/core';
import { queryKeys } from '@/lib/query';
import { shouldRetry, retryDelay } from '@/lib/query';

// ── Analytics + Monitoring ────────────────────────────────────────────────────
import {
  trackEvent,
  funnelContract,
  EVENTS,
  FUNNELS,
} from '@/lib/analytics';
import {
  captureError,
  startTimer,
  METRICS,
  SUBSYSTEMS,
  ACTIONS,
} from '@/lib/monitoring';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Extended response shape — backend embeds restoredData on in-progress sessions. */
interface OnboardingProgressResponseExtended extends OnboardingProgressResponse {
  restoredData?: Record<string, unknown>;
}

/** Projected shape returned by the selector. */
interface OnboardingSelected {
  steps:        OnboardingStep[];
  progress:     OnboardingProgressResponseExtended;
  currentStep:  string | null;
  restoredData: Record<string, unknown> | null;
}

export interface UseOnboardingReturn {
  // Step data
  steps:         OnboardingStep[];
  progress:      OnboardingProgressResponse | null;
  currentStep:   string | null;
  // Loading flags
  stepsLoading:  boolean;
  restoreLoading: boolean;
  isSubmitting:  boolean;
  // Restored draft data
  restoredData:  Record<string, unknown> | null;
  // Error
  error:         ApiClientError | null;
  // Actions
  fetchSteps:    () => Promise<void>;
  goToStep:      (stepKey: string) => void;
  saveProgress:  (stepKey: string, data: Record<string, unknown>) => Promise<void>;
  submitOnboarding: (finalData: Record<string, unknown>) => Promise<void>;
  // [PHASE 1] Called by the page once user_type is known
  setVariant:    (variant: 'student' | 'professional') => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// STABLE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stable empty array for the loading state.
 *
 * WHY: `query.data?.steps ?? []` creates a new array identity on every render
 * while loading (data is undefined → a fresh [] is allocated). Any downstream
 * effect or memo that includes `steps` in its dependency array would fire on
 * every render during the loading window — even though nothing changed.
 *
 * Hoisting this constant outside render scope gives all consumers the same
 * array reference for the entire loading window, eliminating false-positive
 * dependency invalidations.
 */
const EMPTY_STEPS: OnboardingStep[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// SELECTOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stable selector — extracts and normalizes the onboarding progress response.
 * Derived fields (currentStep, restoredData) are computed here so components
 * never receive raw undefined values.
 */
function selectOnboardingProgress(
  raw: OnboardingProgressResponseExtended,
): OnboardingSelected {
  return {
    steps:        raw.steps        ?? EMPTY_STEPS,
    progress:     raw,
    currentStep:  raw.currentStep  ?? raw.steps?.[0]?.stepId ?? null,
    restoredData: raw.restoredData ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useOnboarding(): UseOnboardingReturn {
  const queryClient = useQueryClient();
  const { user, isHydrated } = useAppContext();

  // ── UI navigation state (not server state — stays local) ─────────────────
  // currentStep from the server is the *initial* step; the page navigates
  // forward/backward locally. goToStep updates this local cursor.
  const [localCurrentStep, setLocalCurrentStep] = useState<string | null>(null);

  // ── Analytics refs (not state — only needed for side-effects) ────────────
  const variantRef           = useRef<'student' | 'professional' | null>(null);
  const saveStopTimerRef     = useRef<((tags?: Record<string, string | number | boolean>) => number) | null>(null);
  const submitStopTimerRef   = useRef<((tags?: Record<string, string | number | boolean>) => number) | null>(null);

  // ── READ: onboarding progress ─────────────────────────────────────────────
  const query = useQuery<
    OnboardingProgressResponseExtended,
    ApiClientError,
    OnboardingSelected
  >({
    queryKey: queryKeys.onboarding.all(),
    queryFn:  () => getOnboardingSteps() as Promise<OnboardingProgressResponseExtended>,
    select:   selectOnboardingProgress,
    enabled:  isHydrated && !!user,
    // Do not retry on 4xx — deterministic failures surface immediately.
    retry: (failureCount, error) => shouldRetry(failureCount, error, 1),
    retryDelay,
  });

  // Sync the server-provided currentStep into local state on first load.
  // After that, goToStep takes over local navigation.
  useEffect(() => {
    if (query.data?.currentStep && localCurrentStep === null) {
      setLocalCurrentStep(query.data.currentStep);
    }
  }, [query.data?.currentStep, localCurrentStep]);

  // ── Timer cleanup on unmount ──────────────────────────────────────────────
  // If the component unmounts while a mutation is in-flight, stop any active
  // timers. The refs are nulled to prevent double-stop if onSuccess/onError
  // also fires after the cleanup runs.
  useEffect(() => {
    return () => {
      saveStopTimerRef.current?.();
      saveStopTimerRef.current = null;

      submitStopTimerRef.current?.();
      submitStopTimerRef.current = null;
    };
  }, []);

  // ── WRITE: save step draft ────────────────────────────────────────────────
  const saveProgressMutation = useMutation<
    void,
    ApiClientError,
    { stepKey: string; data: Record<string, unknown> }
  >({
    mutationFn: async ({ stepKey, data }) => {
      // Start timer before the request fires — stored in ref so onSuccess/onError
      // can call stopTimer after the async boundary.
      saveStopTimerRef.current = startTimer(METRICS.ONBOARDING_STEP_LOAD);
      await submitOnboardingStep(stepKey, data);
    },

    retry: (failureCount, error) => shouldRetry(failureCount, error, 1),
    retryDelay,

    onSuccess: (_data, { stepKey }) => {
      const stopTimer = saveStopTimerRef.current;
      stopTimer?.({ step: stepKey, status: 'success' });
      saveStopTimerRef.current = null;

      // [PHASE 1] Step saved analytics — idempotency key prevents double-fire
      // if auto-save retries on transient failure without user re-interaction.
      trackEvent(
        EVENTS.ONBOARDING_STEP_SAVED,
        { step: stepKey },
        { idempotencyKey: `onboarding_step_saved:${stepKey}` },
      );

      // Bust the progress cache so completedSteps reflects the saved step.
      void queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.all() });
    },

    onError: (error, { stepKey }) => {
      const stopTimer = saveStopTimerRef.current;
      stopTimer?.({ step: stepKey, status: 'failed' });
      saveStopTimerRef.current = null;

      // [PHASE 1] Step error analytics
      trackEvent(EVENTS.ONBOARDING_STEP_ERROR, { step: stepKey });
      captureError(error, {
        subsystem: SUBSYSTEMS.ONBOARDING,
        action:    ACTIONS.SAVE_PROGRESS,
        metadata:  { step: stepKey },
        severity:  'warning',
      });
    },
  });

  // ── WRITE: terminal submit ────────────────────────────────────────────────
  const submitOnboardingMutation = useMutation<
    void,
    ApiClientError,
    Record<string, unknown>
  >({
    mutationFn: async (finalData) => {
      submitStopTimerRef.current = startTimer(METRICS.ONBOARDING_TOTAL_DURATION);
      await submitOnboardingStep('complete', finalData);
    },

    // Terminal submit — do not retry. A duplicate submit to 'complete' would
    // attempt to re-complete an already-completed onboarding flow.
    retry: false,

    onSuccess: () => {
      const stopTimer = submitStopTimerRef.current;
      const durationMs = stopTimer?.({ status: 'success' });
      submitStopTimerRef.current = null;

      const variant = variantRef.current;

      // [PHASE 1] Terminal completion analytics
      if (variant) {
        trackEvent(EVENTS.ONBOARDING_COMPLETED, {
          variant,
          durationMs: durationMs ?? undefined,
        });
      }
      funnelContract.complete(FUNNELS.ONBOARDING, 'submitted', {
        variant:    variant ?? 'unknown',
        durationMs: durationMs ?? undefined,
      });

      // Invalidate onboarding + metrics sections on completion.
      void queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.metrics.sections() });
    },

    onError: (error) => {
      const stopTimer = submitStopTimerRef.current;
      stopTimer?.({ status: 'failed' });
      submitStopTimerRef.current = null;

      // [PHASE 1] Terminal failure analytics
      funnelContract.error(FUNNELS.ONBOARDING, 'submit_failed', {
        variant: variantRef.current ?? 'unknown',
      });
      captureError(error, {
        subsystem: SUBSYSTEMS.ONBOARDING,
        action:    ACTIONS.SUBMIT_ONBOARDING,
        severity:  'error',
      });
    },
  });

  // ── goToStep — local UI navigation (no API call) ──────────────────────────
  const goToStep = useCallback((stepKey: string): void => {
    setLocalCurrentStep(stepKey);
  }, []);

  // ── fetchSteps — manual refetch escape hatch ──────────────────────────────
  // The page used to call fetchSteps() imperatively on mount. With useQuery,
  // the fetch fires automatically. fetchSteps() is preserved for callers that
  // need to force a re-fetch (e.g. after a network recovery).
  const fetchSteps = useCallback(async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.all() });
  }, [queryClient]);

  // ── saveProgress — public wrapper, re-throws so page can handle 429 ───────
  const saveProgress = useCallback(async (
    stepKey: string,
    data: Record<string, unknown>,
  ): Promise<void> => {
    // mutateAsync propagates errors — the page's try/catch for quota handling
    // is preserved without change.
    await saveProgressMutation.mutateAsync({ stepKey, data });
  }, [saveProgressMutation]);

  // ── submitOnboarding — public wrapper, re-throws so page handles redirect ─
  const submitOnboarding = useCallback(async (
    finalData: Record<string, unknown>,
  ): Promise<void> => {
    await submitOnboardingMutation.mutateAsync(finalData);
  }, [submitOnboardingMutation]);

  // ── setVariant ────────────────────────────────────────────────────────────
  const setVariant = useCallback((variant: 'student' | 'professional'): void => {
    variantRef.current = variant;
  }, []);

  // ── Compose return — contract preserved verbatim ──────────────────────────
  const isLoading   = query.isLoading;
  const currentStep = localCurrentStep ?? query.data?.currentStep ?? null;
  const error       = (query.error ?? saveProgressMutation.error ?? submitOnboardingMutation.error) as ApiClientError | null;

  return {
    steps:          query.data?.steps        ?? EMPTY_STEPS,
    progress:       query.data?.progress     ?? null,
    currentStep,
    stepsLoading:   isLoading,
    restoreLoading: isLoading,                        // alias — same underlying fetch
    isSubmitting:   submitOnboardingMutation.isPending,
    restoredData:   query.data?.restoredData ?? null,
    error,
    fetchSteps,
    goToStep,
    saveProgress,
    submitOnboarding,
    setVariant,
  };
}