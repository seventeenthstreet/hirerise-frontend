/**
 * @file features/student-onboarding/lib/onboarding-hardening.types.ts
 *
 * SHARED TYPES — ONBOARDING HARDENING
 * ─────────────────────────────────────
 * Shared types for frontend hardening:
 *   1. Session Polling Guard
 *   2. Step Boundary Protection
 *   3. Route-Level Recovery
 *   4. Session Version Guard  ← NEW (Phase 3 hardening)
 *
 * These types are consumed by:
 *   - useStudentOnboardingFlow (hook)
 *   - StepRouter (component)
 *   - StudentOnboardingShell (component)
 *   - OnboardingRecoveryScreen (component)
 *   - VersionMismatchScreen (component)   ← NEW
 *
 * DO NOT import from modules/student-onboarding directly — use the
 * re-exports in features/student-onboarding/index.ts instead.
 */

// ─────────────────────────────────────────────────────────────────────────────
// VALID STEP REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The complete set of step IDs the frontend knows how to handle.
 *
 * RULE: If a step ID is returned by the backend but is NOT in this list,
 * StepRouter MUST render UnknownStepFallback — it must NEVER crash or
 * silently loop.
 *
 * Mirrors: ONBOARDING_STEPS in student-onboarding.types.ts
 * Mirrors: backend constants/index.js ONBOARDING_STEPS
 *
 * @contract Update this list whenever the backend adds a new step.
 *           Do not remove entries — deprecate with a comment.
 */
export const VALID_ONBOARDING_STEPS = [
  'education',
  'academics',
  'activities',
  'cognitive',
  'aspiration',
  'processing',
  'result',
] as const;

export type ValidOnboardingStep = (typeof VALID_ONBOARDING_STEPS)[number];

/**
 * Returns true if `stepId` is a known, valid onboarding step.
 *
 * @example
 * if (!isValidOnboardingStep(currentStepId)) {
 *   return <UnknownStepFallback stepId={currentStepId} />;
 * }
 */
export function isValidOnboardingStep(stepId: string): stepId is ValidOnboardingStep {
  return (VALID_ONBOARDING_STEPS as readonly string[]).includes(stepId);
}

// ─────────────────────────────────────────────────────────────────────────────
// POLLING STATE TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type PollingMode = 'active' | 'inactive';

export interface PollingGuardResult {
  readonly refetchInterval: number | false;
  readonly mode: PollingMode;
}

// ─────────────────────────────────────────────────────────────────────────────
// RECOVERY STATE TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scenarios that can trigger the OnboardingRecoveryScreen.
 *
 * 'fetch_failed'       — session query failed (network/server error)
 * 'unauthorized'       — 401/403 returned; user needs to log in again
 * 'stale_session'      — session is too old to trust safely
 * 'malformed_session'  — session exists but data shape is unexpected
 * 'backend_unavailable'— backend returned 5xx or timed out
 * 'load_timeout'       — loading spinner exceeded MAX_LOADING_DURATION_MS
 */
export type RecoveryScenario =
  | 'fetch_failed'
  | 'unauthorized'
  | 'stale_session'
  | 'malformed_session'
  | 'backend_unavailable'
  | 'load_timeout';

export type RecoveryAction =
  | 'retry'
  | 'restart'
  | 'dashboard';

export interface RecoveryState {
  readonly shouldShowRecovery: boolean;
  readonly scenario: RecoveryScenario | null;
  readonly isLoadTimeout: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// VERSION MISMATCH TYPES  (NEW — Phase 3 hardening)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The version mismatch state derived inside useStudentOnboardingFlow.
 *
 * When isVersionCompatible is false, the flow hook sets this object with the
 * mismatch detail.  The shell renders VersionMismatchScreen instead of the
 * normal onboarding UI.
 *
 * PRIORITY: Version check fires BEFORE recovery, polling, and routing.
 */
export interface VersionCompatibilityState {
  /**
   * True when session.engineVersion is in SUPPORTED_ONBOARDING_VERSIONS.
   * Starts as true (optimistic) until a session is loaded.
   */
  readonly isVersionCompatible: boolean;
  /**
   * Only populated when isVersionCompatible is false.
   * Contains the raw mismatch detail for the VersionMismatchScreen.
   */
  readonly versionMismatch: VersionMismatchInfo | null;
}

/**
 * Structured information emitted when an engine version mismatch is detected.
 * Passed directly to VersionMismatchScreen props and logOnboardingEvent.
 */
export interface VersionMismatchInfo {
  readonly receivedVersion: string | null | undefined;
  readonly supportedVersions: readonly string[];
  readonly detectedAt: string;
}
