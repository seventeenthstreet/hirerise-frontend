/**
 * @file features/student-onboarding/lib/onboarding-diagnostics.ts
 *
 * STRUCTURED FRONTEND DIAGNOSTICS
 * ─────────────────────────────────
 * Centralised, typed diagnostic layer for the student onboarding flow.
 *
 * PHASE INTENT (Architecture Preparation):
 *   This module prepares the telemetry infrastructure WITHOUT introducing
 *   third-party providers or backend event ingestion.  When telemetry
 *   providers are adopted, replace the TELEMETRY_SINK stub at the bottom
 *   of this file — no call sites need to change.
 *
 * WHAT THIS REPLACES:
 *   All console.warn() / console.error() calls scattered across onboarding
 *   orchestration are replaced with logOnboardingEvent(), which:
 *     - Produces structured, typed payloads
 *     - Deduplicates noisy repeated events (e.g. invalid_step_detected)
 *     - Is a no-op in production by default (configurable)
 *     - Accepts future telemetry sinks without call-site changes
 *
 * DESIGN RULES:
 *   ✅ Single import surface — always import from this file
 *   ✅ Never call console.warn / console.error directly in onboarding code
 *   ✅ All event names are typed — no magic strings
 *   ✅ Deduplication guard prevents log spam
 *   ✅ Environment-aware — verbose in dev, silent in prod (default)
 *
 * FUTURE UPGRADE PATH (Telemetry Integration):
 *   1. Replace or extend TELEMETRY_SINK with your provider (Segment, Datadog,
 *      PostHog, Sentry breadcrumbs, custom endpoint, etc.)
 *   2. Set ENABLE_PROD_TELEMETRY = true when the provider is ready
 *   3. No call sites change — all callers already use logOnboardingEvent()
 */

// ─────────────────────────────────────────────────────────────────────────────
// EVENT NAME REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All supported diagnostic event names.
 *
 * RULE: Only APPEND.  Do not rename or remove — existing log searches and
 *       future telemetry dashboards depend on stable event names.
 *
 * NAMING CONVENTION: snake_case, verb_noun or noun_verb pattern.
 */
export const ONBOARDING_EVENT_NAMES = [
  'invalid_step_detected',
  'polling_enabled',
  'polling_disabled',
  'recovery_triggered',
  'load_timeout',
  'version_mismatch',
  'session_fetch_failed',
  'onboarding_resumed',
  'onboarding_restarted',
  // Phase 3A: normalization layer diagnostic — confirms engine_version flows
  // from DB → normalizeSession → Version Guard correctly.
  'session_version_received',
] as const;

export type OnboardingEventName = (typeof ONBOARDING_EVENT_NAMES)[number];

// ─────────────────────────────────────────────────────────────────────────────
// SEVERITY LEVELS
// ─────────────────────────────────────────────────────────────────────────────

export type DiagnosticSeverity = 'info' | 'warn' | 'error';

// ─────────────────────────────────────────────────────────────────────────────
// TYPED EVENT PAYLOADS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base shape shared by all diagnostic events.
 * Extended by each specific event payload via discriminated union.
 */
interface BaseDiagnosticEvent {
  /** The canonical event name. Stable identifier for telemetry. */
  readonly event: OnboardingEventName;
  /** ISO 8601 timestamp when the event was emitted. */
  readonly timestamp: string;
  /** The onboarding step active when the event occurred, if applicable. */
  readonly onboardingStep?: string;
  /** Severity classification. Drives console method and future alert routing. */
  readonly severity: DiagnosticSeverity;
}

/** invalid_step_detected — backend returned a step ID not in VALID_ONBOARDING_STEPS */
export interface InvalidStepDetectedEvent extends BaseDiagnosticEvent {
  readonly event: 'invalid_step_detected';
  readonly severity: 'warn';
  readonly metadata: {
    readonly stepId: string;
    readonly validSteps: readonly string[];
  };
}

/** polling_enabled — polling interval started for the processing step */
export interface PollingEnabledEvent extends BaseDiagnosticEvent {
  readonly event: 'polling_enabled';
  readonly severity: 'info';
  readonly metadata: {
    readonly intervalMs: number;
    readonly step: string;
  };
}

/** polling_disabled — polling interval cleared (step changed or flow complete) */
export interface PollingDisabledEvent extends BaseDiagnosticEvent {
  readonly event: 'polling_disabled';
  readonly severity: 'info';
  readonly metadata: {
    readonly reason: 'step_changed' | 'flow_complete' | 'recovery_active' | 'version_mismatch';
  };
}

/** recovery_triggered — recovery screen is about to render */
export interface RecoveryTriggeredEvent extends BaseDiagnosticEvent {
  readonly event: 'recovery_triggered';
  readonly severity: 'warn';
  readonly metadata: {
    readonly scenario: string;
  };
}

/** load_timeout — session loading exceeded MAX_LOADING_DURATION_MS */
export interface LoadTimeoutEvent extends BaseDiagnosticEvent {
  readonly event: 'load_timeout';
  readonly severity: 'warn';
  readonly metadata: {
    readonly maxDurationMs: number;
  };
}

/** version_mismatch — engine_version from backend is not in SUPPORTED_ONBOARDING_VERSIONS */
export interface VersionMismatchEvent extends BaseDiagnosticEvent {
  readonly event: 'version_mismatch';
  readonly severity: 'error';
  readonly metadata: {
    readonly receivedVersion: string | null | undefined;
    readonly supportedVersions: readonly string[];
    readonly detectedAt: string;
  };
}

/** session_fetch_failed — the session query returned an error */
export interface SessionFetchFailedEvent extends BaseDiagnosticEvent {
  readonly event: 'session_fetch_failed';
  readonly severity: 'error';
  readonly metadata: {
    readonly errorCategory: string;
    readonly errorMessage: string;
  };
}

/** onboarding_resumed — user is continuing a previously-started session */
export interface OnboardingResumedEvent extends BaseDiagnosticEvent {
  readonly event: 'onboarding_resumed';
  readonly severity: 'info';
  readonly metadata: {
    readonly resumeStep: string;
    readonly completedStepCount: number;
    readonly isStaleSession: boolean;
  };
}

/** onboarding_restarted — user clicked "Restart onboarding" from any recovery screen */
export interface OnboardingRestartedEvent extends BaseDiagnosticEvent {
  readonly event: 'onboarding_restarted';
  readonly severity: 'info';
  readonly metadata: {
    readonly triggeredFromScenario: string;
    readonly stepAtRestart: string;
  };
}

/**
 * session_version_received — dev-only diagnostic emitted by normalizeSession().
 *
 * Confirms that engine_version from the DB has been correctly mapped to
 * engineVersion in the normalized OnboardingSession domain object.
 * This event lets developers verify the normalization layer is working
 * BEFORE the Version Guard runs its compatibility check.
 *
 * PRODUCTION BEHAVIOUR: no-op (logOnboardingEvent is env-aware).
 * DEVELOPMENT BEHAVIOUR: logs to console so engineers can verify the flow.
 *
 * @see modules/student-onboarding/api/student-onboarding.api.ts → normalizeSession()
 * @see features/student-onboarding/lib/version-guard.ts → isSupportedSessionVersion()
 */
export interface SessionVersionReceivedEvent extends BaseDiagnosticEvent {
  readonly event: 'session_version_received';
  readonly severity: 'info';
  readonly metadata: {
    /** The engine_version value received from the DB, now mapped to engineVersion. */
    readonly engineVersion: string;
    /** The list of versions the current frontend build considers compatible. */
    readonly supportedVersions: readonly string[];
    /** Whether this version will pass the Version Guard check. */
    readonly isCompatible: boolean;
  };
}

/**
 * Discriminated union of all typed diagnostic events.
 * logOnboardingEvent() accepts any member of this union.
 */
export type OnboardingDiagnosticEvent =
  | InvalidStepDetectedEvent
  | PollingEnabledEvent
  | PollingDisabledEvent
  | RecoveryTriggeredEvent
  | LoadTimeoutEvent
  | VersionMismatchEvent
  | SessionFetchFailedEvent
  | OnboardingResumedEvent
  | OnboardingRestartedEvent
  | SessionVersionReceivedEvent;

// ─────────────────────────────────────────────────────────────────────────────
// DEDUPLICATION GUARD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tracks recently emitted (event, deduplicationKey) pairs.
 * Prevents identical events from flooding the console or telemetry sink.
 *
 * Example: invalid_step_detected with the same stepId should not log 50 times
 * during a polling loop — only the first occurrence per session.
 *
 * Key format: `${event}:${deduplicationKey}`
 * TTL: session-scoped (cleared on page navigation, not within a session).
 */
const _emittedKeys = new Set<string>();

/**
 * Returns the deduplication key for an event.
 * Events without meaningful metadata variation use the event name alone.
 */
function getDeduplicationKey(event: OnboardingDiagnosticEvent): string {
  switch (event.event) {
    case 'invalid_step_detected':
      return `${event.event}:${event.metadata.stepId}`;
    case 'version_mismatch':
      return `${event.event}:${event.metadata.receivedVersion ?? 'unknown'}`;
    case 'recovery_triggered':
      return `${event.event}:${event.metadata.scenario}`;
    case 'load_timeout':
    case 'session_fetch_failed':
      // Deduplicate per session — only report first occurrence
      return event.event;
    case 'polling_enabled':
    case 'polling_disabled':
      // Polling state changes are allowed to repeat (step changes)
      // Use a unique key so they are NOT deduplicated
      return `${event.event}:${Date.now()}`;
    case 'onboarding_resumed':
    case 'onboarding_restarted':
      return event.event;
    case 'session_version_received':
      // One log per engineVersion value per session — not per call
      return `${event.event}:${event.metadata.engineVersion}`;
  }
}

/**
 * Returns true if this event has already been emitted this session.
 * Registers the key as seen on first call.
 */
function isDuplicate(event: OnboardingDiagnosticEvent): boolean {
  const key = getDeduplicationKey(event);
  if (_emittedKeys.has(key)) return true;
  _emittedKeys.add(key);
  return false;
}

/**
 * Clears the deduplication registry.
 * Call on logout or full application reset — not between steps.
 *
 * @internal Exposed for testing only.
 */
export function _resetDiagnosticDeduplication(): void {
  _emittedKeys.clear();
}

// ─────────────────────────────────────────────────────────────────────────────
// ENVIRONMENT FLAGS
// ─────────────────────────────────────────────────────────────────────────────

const IS_DEV = process.env.NODE_ENV !== 'production';

/**
 * Set to true when a telemetry provider is wired up and safe to call
 * in production.  Flipping this flag is the ONLY change needed to
 * activate production event forwarding.
 *
 * @future Set to true when telemetry sink is production-ready.
 */
const ENABLE_PROD_TELEMETRY = false;

// ─────────────────────────────────────────────────────────────────────────────
// TELEMETRY SINK STUB
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Forward an event to the telemetry provider.
 *
 * CURRENT STATE: No-op stub.  Replace the body of this function with your
 * provider's track() call when telemetry is ready.
 *
 * @example (future — Segment)
 *   analytics.track(event.event, { ...event.metadata, severity: event.severity });
 *
 * @example (future — Datadog RUM)
 *   DD_RUM.addAction(event.event, { ...event.metadata });
 *
 * @example (future — custom endpoint)
 *   fetch('/api/telemetry/onboarding', { method: 'POST', body: JSON.stringify(event) });
 */
function forwardToTelemetrySink(_event: OnboardingDiagnosticEvent): void {
  // Intentional no-op — telemetry provider not yet wired.
  // Replace this body when ENABLE_PROD_TELEMETRY is set to true.
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIMARY LOGGER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * logOnboardingEvent
 *
 * The single, centralised entry point for all onboarding diagnostic events.
 *
 * BEHAVIOUR:
 *   Development   → structured console output (warn/error/info based on severity)
 *   Production    → no console output; telemetry forwarded if ENABLE_PROD_TELEMETRY
 *   Deduplication → identical events are silently dropped after first emission
 *
 * USAGE:
 *   Replace all console.warn / console.error in onboarding orchestration
 *   with a typed call to this function.
 *
 * @example
 *   logOnboardingEvent({
 *     event: 'invalid_step_detected',
 *     severity: 'warn',
 *     timestamp: new Date().toISOString(),
 *     onboardingStep: currentStepId,
 *     metadata: { stepId: currentStepId, validSteps: VALID_ONBOARDING_STEPS },
 *   });
 */
export function logOnboardingEvent(event: OnboardingDiagnosticEvent): void {
  // ── Deduplication guard ──────────────────────────────────────────────────
  if (isDuplicate(event)) return;

  // ── Development: structured console output ───────────────────────────────
  if (IS_DEV) {
    const prefix = `[StudentOnboarding:${event.event}]`;
    const payload = {
      timestamp: event.timestamp,
      ...(event.onboardingStep ? { step: event.onboardingStep } : {}),
      ...('metadata' in event ? { metadata: event.metadata } : {}),
    };

    switch (event.severity) {
      case 'error':
        console.error(prefix, payload);
        break;
      case 'warn':
        console.warn(prefix, payload);
        break;
      case 'info':
      default:
        console.info(prefix, payload);
        break;
    }
  }

  // ── Production: telemetry forwarding (when enabled) ──────────────────────
  if (!IS_DEV && ENABLE_PROD_TELEMETRY) {
    try {
      forwardToTelemetrySink(event);
    } catch {
      // Telemetry must never break onboarding — swallow silently.
    }
  }
}