/**
 * @file features/student-onboarding/hooks/use-student-onboarding-flow.ts
 *
 * HOOK: useStudentOnboardingFlow
 * ───────────────────────────────
 * Top-level orchestration hook for the student onboarding flow.
 *
 * ARCHITECTURE POSITION:
 *   API → Hooks (this file) → Shell → Page
 *
 * HARDENING (Phase 2):
 *   ✅ Session Polling Guard   — controlled polling ONLY during 'processing'
 *   ✅ Step Boundary Safety    — isCurrentStepValid flag for StepRouter
 *   ✅ Route-Level Recovery    — recovery state for shell/page
 *   ✅ Load Timeout Guard      — prevents permanent loading spinners
 *
 * HARDENING (Phase 3 — this file):
 *   ✅ Session Version Guard   — version compatibility check BEFORE all other logic
 *   ✅ Structured Diagnostics  — all console.warn/error replaced with logOnboardingEvent
 *
 * PHASE 3A PATCH (academics signal collection):
 *   ✅ 'academics' removed from PHASE2_UNIMPLEMENTED_STEPS — step is now real
 *   ✅ handleStepComplete 'academics' case is a no-op — AcademicsStep manages its
 *      own session progression via POST /step/academics (backend-authoritative).
 *      The shell never needs to call advanceStep for the academics step.
 *
 * GUARD PRIORITY ORDER (must not be reordered):
 *   1. Version compatibility check  ← NEW — halts everything if incompatible
 *   2. Polling guard
 *   3. Load timeout guard
 *   4. Recovery state resolution
 *   5. Step routing / processing logic
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/context/AppContext';

import {
  useStudentOnboardingSession,
  useSaveEducationProfile,
  useUpdateOnboardingStep,
  COMPLETABLE_STEP_ENTRIES,
  getProgressPercent,
} from '@/modules/student-onboarding';

import type {
  OnboardingSession,
  OnboardingStep,
  CompletableStep,
  SaveEducationProfileInput,
  StudentOnboardingError,
} from '@/modules/student-onboarding';

import { computePollingInterval } from '../lib/polling-guard';
import {
  isValidOnboardingStep,
} from '../lib/onboarding-hardening.types';
import type {
  RecoveryState,
  RecoveryScenario,
  VersionCompatibilityState,
} from '../lib/onboarding-hardening.types';

import {
  isSupportedSessionVersion,
  buildVersionMismatchDetail,
} from '../lib/version-guard';

import { logOnboardingEvent } from '../lib/onboarding-diagnostics';
import { captureOnboardingSnapshot } from '../lib/onboarding-snapshot';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MAX_LOADING_DURATION_MS = 15_000;

// Polling stuck threshold — if processing step stays active beyond this,
// a polling_stuck snapshot is captured for diagnostics.
const POLLING_STUCK_THRESHOLD_MS = 120_000; // 2 minutes

// ─────────────────────────────────────────────────────────────────────────────
// PHASE STEP SUPPORT CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Steps with full UI + backend implementations.
 *
 * Phase 2:  education
 * Phase 3A: academics  ← added; AcademicsStep manages its own API round-trip
 * Phase 3B+ (not yet): activities, cognitive, aspiration
 */
const PHASE2_IMPLEMENTED_STEPS = new Set<OnboardingStep>([
  'education',
  'academics',
  'activities',
  'cognitive',
  'aspiration',
]);

/**
 * Steps that the session router may return but whose UI is not yet built.
 * When current_step is in this set the shell renders a placeholder.
 *
 * Phase 3A: 'academics' removed — it is now a real step.
 * Add future unimplemented steps here as they are introduced by the backend
 * before their UI phase lands.
 */
export const PHASE2_UNIMPLEMENTED_STEPS = new Set<OnboardingStep>([
  // intentionally empty after Phase 3A
]);

export function isStepImplemented(step: string): boolean {
  return PHASE2_IMPLEMENTED_STEPS.has(step as OnboardingStep);
}

// ─────────────────────────────────────────────────────────────────────────────
// RETURN TYPE
// ─────────────────────────────────────────────────────────────────────────────

export interface UseStudentOnboardingFlowReturn {
  session: OnboardingSession | null;
  currentStepId: OnboardingStep;
  isSessionLoading: boolean;
  isSessionError: boolean;
  sessionError: StudentOnboardingError | null;
  refetchSession: () => void;
  progressPercent: number;
  completedStepCount: number;
  totalStepCount: number;
  isBusy: boolean;
  handleStepComplete: (data: Record<string, unknown>) => Promise<void>;
  isCurrentStepUnimplemented: boolean;
  isProcessingStep: boolean;
  isCurrentStepValid: boolean;
  recovery: RecoveryState;
  /** Version compatibility state. Shell must check this BEFORE rendering steps. */
  versionCompatibility: VersionCompatibilityState;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL: RECOVERY SCENARIO RESOLVER
// ─────────────────────────────────────────────────────────────────────────────

function resolveRecoveryScenario(
  isSessionError: boolean,
  sessionError: StudentOnboardingError | null,
  session: OnboardingSession | null,
  isLoadTimeout: boolean,
): RecoveryScenario | null {
  if (isLoadTimeout) return 'load_timeout';

  if (isSessionError) {
    const category = sessionError?.category ?? 'server';
    if (category === 'auth') return 'unauthorized';
    const message = (sessionError?.message ?? '').toLowerCase();
    if (message.includes('unavailable') || message.includes('503')) {
      return 'backend_unavailable';
    }
    return 'fetch_failed';
  }

  if (session !== null) {
    if (!session.currentStep || !Array.isArray(session.completedSteps)) {
      return 'malformed_session';
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useStudentOnboardingFlow(): UseStudentOnboardingFlowReturn {
  const navigate = useNavigate();
  const { refreshUser } = useAppContext();

  // ── Load timeout guard ────────────────────────────────────────────────────
  const [isLoadTimeout, setIsLoadTimeout] = useState(false);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Polling stuck detector ref ────────────────────────────────────────────
  // Tracks when polling started so we can detect a stuck processing step.
  const pollingStartRef = useRef<number | null>(null);

  // ── Session ───────────────────────────────────────────────────────────────
  const {
    session,
    isLoading: isSessionLoading,
    isError: isSessionError,
    error: sessionError,
    refetch: refetchSession,
  } = useStudentOnboardingSession();

  // ─────────────────────────────────────────────────────────────────────────
  // ① VERSION COMPATIBILITY CHECK  ← Must run BEFORE all other derived state
  // ─────────────────────────────────────────────────────────────────────────

  const versionCompatibility = useMemo<VersionCompatibilityState>(() => {
    // No session yet (loading or not started) — optimistically compatible.
    // The check fires once a session is available.
    if (!session) {
      return { isVersionCompatible: true, versionMismatch: null };
    }

    // `engineVersion` requires the OnboardingSession type patch described in
    // student-onboarding.types.PATCH.md.  The cast guards compilation before
    // the patch is applied; remove it after the patch lands.
    const engineVersion = (session as OnboardingSession & { engineVersion?: string }).engineVersion;

    if (isSupportedSessionVersion(engineVersion)) {
      return { isVersionCompatible: true, versionMismatch: null };
    }

    // Version mismatch detected — build detail and emit diagnostic event.
    const mismatch = buildVersionMismatchDetail(engineVersion);

    logOnboardingEvent({
      event: 'version_mismatch',
      severity: 'error',
      timestamp: mismatch.detectedAt,
      onboardingStep: (session?.currentStep as string) ?? undefined,
      metadata: {
        receivedVersion: mismatch.receivedVersion,
        supportedVersions: mismatch.supportedVersions,
        detectedAt: mismatch.detectedAt,
      },
    });

    // SNAPSHOT — critical severity; captures full orchestration state at
    // the moment the incompatible version is first detected.
    captureOnboardingSnapshot({
      scenario:            'version_mismatch',
      engineVersion:       mismatch.receivedVersion,
      isVersionCompatible: false,
      currentStep:         (session?.currentStep as string) ?? null,
      completedSteps:      session?.completedSteps ?? [],
      completionPercent:   session?.completionPct ?? 0,
      isComplete:          session?.isComplete ?? false,
      pollingActive:       false,
      processingState:     'version_blocked',
      primaryContext:      String(mismatch.receivedVersion ?? 'unknown'),
    });

    return {
      isVersionCompatible: false,
      versionMismatch: mismatch,
    };
  }, [session]);

  // ── Step derivation ───────────────────────────────────────────────────────
  const currentStepId: OnboardingStep =
    (session?.currentStep as OnboardingStep) ?? 'education';

  const isProcessingStep = currentStepId === 'processing';
  const isCurrentStepUnimplemented = PHASE2_UNIMPLEMENTED_STEPS.has(currentStepId);

  // ── Step boundary validation ──────────────────────────────────────────────
  const isCurrentStepValid = isValidOnboardingStep(currentStepId);

  // Emit structured diagnostic on invalid step (once per step change, dev only)
  useEffect(() => {
    if (!isCurrentStepValid) {
      logOnboardingEvent({
        event: 'invalid_step_detected',
        severity: 'warn',
        timestamp: new Date().toISOString(),
        onboardingStep: currentStepId,
        metadata: {
          stepId: currentStepId,
          validSteps: ['education','academics','activities','cognitive','aspiration','processing','result'],
        },
      });
      // SNAPSHOT — error severity; invalid step returned by backend may
      // indicate a session schema mismatch or a backend bug.
      captureOnboardingSnapshot({
        scenario:          'invalid_step_detected',
        currentStep:       currentStepId,
        completedSteps:    session?.completedSteps ?? [],
        completionPercent: session?.completionPct ?? 0,
        isComplete:        session?.isComplete ?? false,
        engineVersion:     (session as OnboardingSession & { engineVersion?: string })?.engineVersion,
        isVersionCompatible: versionCompatibility.isVersionCompatible,
        pollingActive:     pollingMode === 'active',
        processingState:   'invalid_step',
        primaryContext:    currentStepId,
      });
    }
  // session, pollingMode, versionCompatibility.isVersionCompatible appear only in
  // captureOnboardingSnapshot payload — snapshot-at-fire-time values, not trigger
  // conditions. Adding them would re-fire this diagnostic on every session poll.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepId, isCurrentStepValid]);

  // ── Polling guard ─────────────────────────────────────────────────────────
  // Polling is disabled entirely when version is incompatible.
  const { refetchInterval, mode: pollingMode } = computePollingInterval(
    // If version is incompatible, suppress polling by faking a non-processing step.
    versionCompatibility.isVersionCompatible ? currentStepId : 'version_blocked',
    session?.isComplete ?? false,
  );

  useEffect(() => {
    if (refetchInterval === false) {
      if (pollingMode === 'inactive' && currentStepId === 'processing') {
        // Polling was intentionally disabled — emit diagnostic
        logOnboardingEvent({
          event: 'polling_disabled',
          severity: 'info',
          timestamp: new Date().toISOString(),
          onboardingStep: currentStepId,
          metadata: {
            reason: versionCompatibility.isVersionCompatible
              ? 'flow_complete'
              : 'version_mismatch',
          },
        });
      }
      return;
    }

    logOnboardingEvent({
      event: 'polling_enabled',
      severity: 'info',
      timestamp: new Date().toISOString(),
      onboardingStep: currentStepId,
      metadata: {
        intervalMs: refetchInterval,
        step: currentStepId,
      },
    });

    const timer = setInterval(() => {
      refetchSession();
    }, refetchInterval);

    return () => {
      clearInterval(timer);
      logOnboardingEvent({
        event: 'polling_disabled',
        severity: 'info',
        timestamp: new Date().toISOString(),
        onboardingStep: currentStepId,
        metadata: { reason: 'step_changed' },
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetchInterval, pollingMode]);

  // ── Polling stuck detector ─────────────────────────────────────────────────
  // If the processing step stays active beyond POLLING_STUCK_THRESHOLD_MS
  // without completing, capture a polling_stuck snapshot once per cooldown.
  useEffect(() => {
    if (pollingMode === 'active') {
      if (!pollingStartRef.current) {
        pollingStartRef.current = Date.now();
      }
      const id = setTimeout(() => {
        if (pollingMode === 'active') {
          captureOnboardingSnapshot({
            scenario:          'polling_stuck',
            currentStep:       currentStepId,
            completedSteps:    session?.completedSteps ?? [],
            completionPercent: session?.completionPct ?? 0,
            isComplete:        session?.isComplete ?? false,
            engineVersion:     (session as OnboardingSession & { engineVersion?: string })?.engineVersion,
            isVersionCompatible: versionCompatibility.isVersionCompatible,
            pollingActive:     true,
            processingState:   'stuck',
            primaryContext:    'processing',
          });
        }
      }, POLLING_STUCK_THRESHOLD_MS);
      return () => clearTimeout(id);
    } else {
      pollingStartRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollingMode, currentStepId]);

  // ── Load timeout management ───────────────────────────────────────────────
  useEffect(() => {
    if (isSessionLoading && !isLoadTimeout) {
      loadTimeoutRef.current = setTimeout(() => {
        setIsLoadTimeout(true);
        logOnboardingEvent({
          event: 'load_timeout',
          severity: 'warn',
          timestamp: new Date().toISOString(),
          metadata: { maxDurationMs: MAX_LOADING_DURATION_MS },
        });
        // SNAPSHOT — warn severity; helps diagnose slow/hung backends.
        captureOnboardingSnapshot({
          scenario:          'load_timeout',
          currentStep:       currentStepId,
          completedSteps:    session?.completedSteps ?? [],
          completionPercent: session?.completionPct ?? 0,
          isComplete:        session?.isComplete ?? false,
          engineVersion:     (session as OnboardingSession & { engineVersion?: string })?.engineVersion,
          isVersionCompatible: versionCompatibility.isVersionCompatible,
          pollingActive:     pollingMode === 'active',
          processingState:   'load_timeout',
          primaryContext:    currentStepId,
        });
      }, MAX_LOADING_DURATION_MS);
    } else {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
      if (!isSessionLoading) {
        // Async orchestration state: clears the timeout flag once the session
        // loading workflow resolves. This must run in an effect — not at render
        // time — because it is gated on isSessionLoading transitioning to false,
        // an async event driven by React Query. Render-time derivation would
        // not correctly represent this transition and could mask a genuine
        // timeout that fires while loading is transiently false between retries.
        // The isLoadTimeout flag is authoritative: the UI and snapshot logic
        // both depend on it as a stable boolean, not a derived expression.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsLoadTimeout(false);
      }
    }

    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    };
  // currentStepId, session, pollingMode, versionCompatibility.isVersionCompatible
  // appear only in captureOnboardingSnapshot inside the setTimeout callback.
  // Adding them would restart the timeout on every session poll, preventing it from firing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSessionLoading, isLoadTimeout]);

  // ── Session fetch error diagnostic ───────────────────────────────────────
  useEffect(() => {
    if (isSessionError && sessionError) {
      logOnboardingEvent({
        event: 'session_fetch_failed',
        severity: 'error',
        timestamp: new Date().toISOString(),
        metadata: {
          errorCategory: sessionError.category ?? 'unknown',
          errorMessage: sessionError.message ?? 'Unknown error',
        },
      });
      // SNAPSHOT — error severity; captures error context for backend debugging.
      captureOnboardingSnapshot({
        scenario:          'session_fetch_failed',
        currentStep:       currentStepId,
        completedSteps:    session?.completedSteps ?? [],
        completionPercent: session?.completionPct ?? 0,
        isComplete:        session?.isComplete ?? false,
        engineVersion:     (session as OnboardingSession & { engineVersion?: string })?.engineVersion,
        isVersionCompatible: versionCompatibility.isVersionCompatible,
        pollingActive:     pollingMode === 'active',
        processingState:   sessionError.category ?? 'unknown',
        primaryContext:    sessionError.message ?? 'fetch_error',
        isRecoverable:     true,
      });
    }
  // currentStepId, pollingMode, session, versionCompatibility.isVersionCompatible
  // appear only in captureOnboardingSnapshot payload — snapshot-at-fire-time values.
  // Adding session would re-trigger on every successful poll (healthy data).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSessionError, sessionError]);

  // ── Recovery state ────────────────────────────────────────────────────────
  const recoveryScenario = useMemo(
    () => resolveRecoveryScenario(isSessionError, sessionError ?? null, session, isLoadTimeout),
    [isSessionError, sessionError, session, isLoadTimeout],
  );

  const recovery: RecoveryState = useMemo(() => {
    const shouldShowRecovery = recoveryScenario !== null;
    if (shouldShowRecovery) {
      logOnboardingEvent({
        event: 'recovery_triggered',
        severity: 'warn',
        timestamp: new Date().toISOString(),
        onboardingStep: currentStepId,
        metadata: { scenario: recoveryScenario! },
      });
      // SNAPSHOT — maps recovery scenario to the appropriate snapshot scenario.
      // Captured once per recovery activation (deduplication handles re-renders).
      captureOnboardingSnapshot({
        scenario:          'recovery_screen_rendered',
        currentStep:       currentStepId,
        completedSteps:    session?.completedSteps ?? [],
        completionPercent: session?.completionPct ?? 0,
        isComplete:        session?.isComplete ?? false,
        engineVersion:     (session as OnboardingSession & { engineVersion?: string })?.engineVersion,
        isVersionCompatible: versionCompatibility.isVersionCompatible,
        recoveryScenario,
        pollingActive:     pollingMode === 'active',
        processingState:   recoveryScenario ?? 'unknown',
        isRecoverable:     recoveryScenario !== 'unauthorized',
        primaryContext:    recoveryScenario ?? 'unknown',
      });
    }
    return { shouldShowRecovery, scenario: recoveryScenario, isLoadTimeout };
  // pollingMode, session, versionCompatibility.isVersionCompatible appear only in
  // captureOnboardingSnapshot — a side effect inside useMemo (Phase 3C.4 concern).
  // Adding them would recompute recovery state on every background session poll.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recoveryScenario, isLoadTimeout, currentStepId]);

  // ── Mutation hooks ────────────────────────────────────────────────────────
  const { saveAsync: saveEducation, isPending: isSavingEducation } =
    useSaveEducationProfile();

  const { updateAsync: advanceStep, isPending: isAdvancingStep } =
    useUpdateOnboardingStep();

  const isBusy = isSavingEducation || isAdvancingStep;

  // ── Progress ──────────────────────────────────────────────────────────────
  const progressPercent = useMemo(
    () => session?.completionPct ?? getProgressPercent(session?.completedSteps ?? []),
    [session?.completionPct, session?.completedSteps],
  );

  const completedStepCount = useMemo(
    () =>
      COMPLETABLE_STEP_ENTRIES.filter(
        (e) => session?.completedSteps?.includes(e.id as CompletableStep) ?? false,
      ).length,
    [session?.completedSteps],
  );

  const totalStepCount = COMPLETABLE_STEP_ENTRIES.length;

  // ── Step completion dispatch ──────────────────────────────────────────────
  const handleStepComplete = useCallback(
    async (data: Record<string, unknown>) => {
      const step: OnboardingStep = (session?.currentStep as OnboardingStep) ?? 'education';

      switch (step) {
        case 'education':
          await saveEducation(data as unknown as SaveEducationProfileInput);
          break;

        case 'academics':
          // NO-OP — Phase 3A: AcademicsStep manages its own session progression.
          // The component calls POST /api/v1/student-onboarding/v2/step/academics
          // with { is_partial: false } which advances the session server-side.
          // handleStepComplete is never called for this step from the shell.
          // Keeping the case here prevents TypeScript exhaustiveness warnings
          // if OnboardingStep becomes a discriminated union in future.
          break;
        case 'activities':
          await advanceStep({ completedStep: 'activities', nextStep: 'cognitive' });
          break;
        case 'cognitive':
          await advanceStep({ completedStep: 'cognitive', nextStep: 'aspiration' });
          break;
        case 'aspiration':
          await advanceStep({ completedStep: 'aspiration', nextStep: 'processing' });
          break;
        case 'result':
          await refreshUser();
          navigate('/dashboard', { replace: true });
          break;
        case 'processing':
        default:
          break;
      }
    },
    [session?.currentStep, saveEducation, advanceStep, navigate, refreshUser],
  );

  return {
    session,
    currentStepId,
    isSessionLoading,
    isSessionError,
    sessionError: sessionError ?? null,
    refetchSession,
    progressPercent,
    completedStepCount,
    totalStepCount,
    isBusy,
    handleStepComplete,
    isCurrentStepUnimplemented,
    isProcessingStep,
    isCurrentStepValid,
    recovery,
    versionCompatibility,
  };
}