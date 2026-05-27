/**
 * @file features/student-onboarding/lib/onboarding-snapshot.ts
 *
 * ONBOARDING SESSION SNAPSHOT DIAGNOSTICS
 * ─────────────────────────────────────────
 * Centralised, structured snapshot system for severe onboarding failure
 * conditions. Complements onboarding-diagnostics.ts — snapshots capture
 * richer orchestration state at the moment of failure, while diagnostics
 * emit lightweight per-event logs.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ARCHITECTURE POSITION
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   API → Hooks → UI → Pages
 *          ↑
 *   captureOnboardingSnapshot() is called from:
 *     - useStudentOnboardingFlow  (hook layer)
 *     - StepRouter               (component layer, invalid step only)
 *     - OnboardingRecoveryScreen (recovery layer)
 *     - VersionMismatchScreen    (version layer)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT A SNAPSHOT IS
 * ─────────────────────────────────────────────────────────────────────────────
 *   A snapshot is a serializable, privacy-safe record of the onboarding
 *   orchestration state at the moment a severe failure condition occurs.
 *
 *   Snapshots are NOT analytics events, NOT full state dumps, NOT user data.
 *   They contain ONLY architecture-diagnostic metadata — step names, version
 *   strings, boolean flags, retry counts, and timing.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SNAPSHOT TRIGGERS (severe conditions only)
 * ─────────────────────────────────────────────────────────────────────────────
 *   version_mismatch             critical
 *   invalid_step_detected        error
 *   malformed_session            error
 *   unrecoverable_route_state    error
 *   recovery_screen_rendered     warn
 *   load_timeout                 warn
 *   session_fetch_failed         error
 *   polling_stuck                warn
 *   onboarding_restart_triggered warn
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PRIVACY GUARANTEES
 * ─────────────────────────────────────────────────────────────────────────────
 *   NEVER captured:
 *     auth tokens, JWTs, session cookies, email addresses,
 *     cognitive answers, aspiration data, marks, activities,
 *     Supabase payloads, user personal data
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * STORAGE STRATEGY
 * ─────────────────────────────────────────────────────────────────────────────
 *   Development  → structured console.group() output
 *   All envs     → in-memory ring buffer (last 20 snapshots)
 *   All envs     → sessionStorage (key: hr_ob_snap, max 20 entries)
 *   Future       → telemetry forwarding via SNAPSHOT_SINK (stub provided)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DEDUPLICATION
 * ─────────────────────────────────────────────────────────────────────────────
 *   Fingerprint = scenario + primaryContext
 *   Cooldown    = 30 seconds per fingerprint
 *   Effect      = duplicate snapshots within the cooldown window are silently
 *                 dropped — prevents polling_stuck from generating 100 entries
 */

import { logOnboardingEvent } from './onboarding-diagnostics';
import type { RecoveryScenario } from './onboarding-hardening.types';

// ─────────────────────────────────────────────────────────────────────────────
// 1. SNAPSHOT SCENARIO REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All scenarios that may trigger a snapshot.
 *
 * RULE: APPEND only. Never rename — stored snapshots and future telemetry
 * dashboards depend on stable scenario identifiers.
 */
export const SNAPSHOT_SCENARIOS = [
  'version_mismatch',
  'invalid_step_detected',
  'malformed_session',
  'unrecoverable_route_state',
  'recovery_screen_rendered',
  'load_timeout',
  'session_fetch_failed',
  'polling_stuck',
  'onboarding_restart_triggered',
] as const;

export type SnapshotScenario = (typeof SNAPSHOT_SCENARIOS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// 2. SEVERITY MAPPING
// ─────────────────────────────────────────────────────────────────────────────

export type SnapshotSeverity = 'info' | 'warn' | 'error' | 'critical';

/**
 * Authoritative severity for each snapshot scenario.
 *
 * Severity drives:
 *   - console method in development (error/warn/info)
 *   - future alert routing (critical → PagerDuty, error → Sentry, etc.)
 *   - snapshot storage priority (critical always stored, info may be dropped)
 */
export const SNAPSHOT_SEVERITY_MAP: Readonly<Record<SnapshotScenario, SnapshotSeverity>> =
  Object.freeze({
    version_mismatch:             'critical',
    invalid_step_detected:        'error',
    malformed_session:            'error',
    unrecoverable_route_state:    'error',
    recovery_screen_rendered:     'warn',
    load_timeout:                 'warn',
    session_fetch_failed:         'error',
    polling_stuck:                'warn',
    onboarding_restart_triggered: 'warn',
  });

// ─────────────────────────────────────────────────────────────────────────────
// 3. SHARED SNAPSHOT TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Onboarding-specific state captured at the moment of the snapshot. */
export interface SnapshotOnboardingState {
  /** Current step ID as returned by the backend. */
  readonly currentStep:         string | null;
  /** Array of completed step IDs. Safe — step IDs are architecture metadata. */
  readonly completedSteps:      readonly string[];
  /** Completion percentage 0–100. */
  readonly completionPercent:   number;
  /** Whether the onboarding flow is marked complete. */
  readonly isComplete:          boolean;
  /** Engine version string from the backend session. */
  readonly engineVersion:       string | null | undefined;
  /** Whether engineVersion is in SUPPORTED_ONBOARDING_VERSIONS. */
  readonly isVersionCompatible: boolean;
}

/** Recovery state captured at the moment of the snapshot. */
export interface SnapshotRecoveryState {
  /** The recovery scenario that triggered (if any). */
  readonly scenario:       RecoveryScenario | SnapshotScenario | null;
  /** Number of times the user has retried in this session. */
  readonly retryCount:     number;
  /** Whether the recovery screen offers a retry action. */
  readonly isRecoverable:  boolean;
}

/** Operational/environment state captured at the moment of the snapshot. */
export interface SnapshotDiagnosticsState {
  /** Whether the polling loop is currently active. */
  readonly pollingActive:    boolean;
  /** The processing state label (e.g. 'idle', 'polling', 'timeout'). */
  readonly processingState:  string;
  /** The current browser path (pathname only — no query params). */
  readonly routePath:        string;
  /** The frontend engine version known to this build. */
  readonly frontendVersion:  string;
}

/** Full snapshot payload — serializable, privacy-safe. */
export interface OnboardingSnapshot {
  /** Unique snapshot identifier. Format: `snap_<base36timestamp><random>` */
  readonly snapshotId:   string;
  /** ISO-8601 timestamp when the snapshot was captured. */
  readonly timestamp:    string;
  /** The condition that triggered this snapshot. */
  readonly scenario:     SnapshotScenario;
  /** Severity level for routing and alerting. */
  readonly severity:     SnapshotSeverity;
  /** Onboarding flow state at capture time. */
  readonly onboarding:   SnapshotOnboardingState;
  /** Recovery state at capture time. */
  readonly recovery:     SnapshotRecoveryState;
  /** Operational diagnostics at capture time. */
  readonly diagnostics:  SnapshotDiagnosticsState;
}

/**
 * Input accepted by captureOnboardingSnapshot().
 * All fields are optional — defaults are applied for missing values.
 */
export interface SnapshotInput {
  readonly scenario:           SnapshotScenario;
  /** Current step ID (safe architecture string). */
  readonly currentStep?:       string | null;
  /** Completed step IDs. */
  readonly completedSteps?:    readonly string[];
  /** Completion percentage 0–100. */
  readonly completionPercent?: number;
  /** Whether onboarding is complete. */
  readonly isComplete?:        boolean;
  /** Engine version from session. */
  readonly engineVersion?:     string | null | undefined;
  /** Whether version is compatible. */
  readonly isVersionCompatible?: boolean;
  /** Recovery scenario active. */
  readonly recoveryScenario?:  RecoveryScenario | SnapshotScenario | null;
  /** Number of retries so far. */
  readonly retryCount?:        number;
  /** Whether recovery is recoverable. */
  readonly isRecoverable?:     boolean;
  /** Whether polling loop is active. */
  readonly pollingActive?:     boolean;
  /** Processing state label. */
  readonly processingState?:   string;
  /** Additional fingerprint context for deduplication (e.g. stepId). */
  readonly primaryContext?:    string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. SNAPSHOT ID GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a unique snapshot ID.
 * Format: `snap_<base36 timestamp><4-char random>`
 * Example: `snap_lx4f9a3k2m`
 *
 * Guaranteed unique within a session; not globally unique (fine for local
 * diagnostics and sessionStorage — use a UUID when persisting to a backend).
 */
function generateSnapshotId(): string {
  const ts  = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 6);
  return `snap_${ts}${rnd}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. SANITIZATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Keys that must NEVER appear in a snapshot payload.
 * Belt-and-suspenders guard — inputs should never contain these, but we
 * scrub them at serialization time regardless.
 */
const FORBIDDEN_KEYS = new Set([
  'token', 'accessToken', 'access_token',
  'refreshToken', 'refresh_token',
  'jwt', 'bearer',
  'email', 'password', 'secret',
  'authorization', 'apiKey', 'api_key',
  'supabase', 'serviceRole', 'service_role',
  // Onboarding user-data fields — safe step names are architecture metadata;
  // actual answer payloads are forbidden
  'cognitiveAnswers', 'cognitive_answers',
  'aspirationData', 'aspiration_data',
  'marks', 'activities',
]);

/**
 * Recursively sanitize an object, redacting any key that appears in
 * FORBIDDEN_KEYS. Returns a new plain object — never mutates the input.
 *
 * Depth-limited to 4 levels to prevent runaway recursion on unexpected inputs.
 */
export function sanitizeSnapshotPayload(
  obj: unknown,
  depth = 0,
): unknown {
  if (depth > 4 || obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.slice(0, 50).map(item => sanitizeSnapshotPayload(item, depth + 1));
  }

  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(k) || FORBIDDEN_KEYS.has(k.toLowerCase())) {
      clean[k] = '[REDACTED]';
    } else {
      clean[k] = sanitizeSnapshotPayload(v, depth + 1);
    }
  }
  return clean;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. SNAPSHOT BUILDER
// ─────────────────────────────────────────────────────────────────────────────

/** The frontend engine version known to this build. */
const FRONTEND_ENGINE_VERSION = '1.0.0';

/**
 * createOnboardingSnapshot
 *
 * Builds a complete, sanitized OnboardingSnapshot from a SnapshotInput.
 * Applies all defaults for missing fields.
 * Never throws.
 */
export function createOnboardingSnapshot(input: SnapshotInput): OnboardingSnapshot {
  const severity = SNAPSHOT_SEVERITY_MAP[input.scenario];

  const onboarding: SnapshotOnboardingState = {
    currentStep:         input.currentStep         ?? null,
    completedSteps:      input.completedSteps       ?? [],
    completionPercent:   input.completionPercent    ?? 0,
    isComplete:          input.isComplete           ?? false,
    engineVersion:       input.engineVersion        ?? null,
    isVersionCompatible: input.isVersionCompatible  ?? true,
  };

  const recovery: SnapshotRecoveryState = {
    scenario:      input.recoveryScenario ?? null,
    retryCount:    input.retryCount       ?? 0,
    isRecoverable: input.isRecoverable    ?? true,
  };

  const diagnostics: SnapshotDiagnosticsState = {
    pollingActive:   input.pollingActive   ?? false,
    processingState: input.processingState ?? 'unknown',
    routePath:       typeof window !== 'undefined'
      ? window.location.pathname
      : '/unknown',
    frontendVersion: FRONTEND_ENGINE_VERSION,
  };

  const raw: OnboardingSnapshot = {
    snapshotId:  generateSnapshotId(),
    timestamp:   new Date().toISOString(),
    scenario:    input.scenario,
    severity,
    onboarding,
    recovery,
    diagnostics,
  };

  // Sanitize the full payload before storage/forwarding
  return sanitizeSnapshotPayload(raw) as OnboardingSnapshot;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. DEDUPLICATION
// ─────────────────────────────────────────────────────────────────────────────

/** Cooldown window in ms — duplicate fingerprints within this window are dropped. */
const SNAPSHOT_COOLDOWN_MS = 30_000;

/** Map of fingerprint → timestamp of last capture. In-process only. */
const _snapshotCooldowns = new Map<string, number>();

/**
 * Compute a deduplication fingerprint for a snapshot input.
 * Format: `<scenario>:<primaryContext>`
 *
 * primaryContext should be the most discriminating piece of context:
 *   invalid_step_detected  → the invalid step ID
 *   version_mismatch       → the received version string
 *   polling_stuck          → 'processing'
 *   recovery_*             → the recovery scenario
 *   others                 → empty string (deduplicate by scenario alone)
 */
function buildSnapshotFingerprint(input: SnapshotInput): string {
  const ctx = input.primaryContext ?? '';
  return `${input.scenario}:${ctx}`;
}

/**
 * Returns true if this snapshot should be suppressed due to deduplication.
 * Registers the fingerprint if it passes.
 */
function isDuplicateSnapshot(input: SnapshotInput): boolean {
  const fingerprint = buildSnapshotFingerprint(input);
  const now         = Date.now();
  const lastSeen    = _snapshotCooldowns.get(fingerprint);

  if (lastSeen !== undefined && now - lastSeen < SNAPSHOT_COOLDOWN_MS) {
    return true;
  }

  _snapshotCooldowns.set(fingerprint, now);
  return false;
}

/**
 * Clear all deduplication cooldowns.
 * Call on onboarding restart or logout.
 *
 * @internal Exposed for testing.
 */
export function _resetSnapshotDeduplication(): void {
  _snapshotCooldowns.clear();
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. IN-MEMORY RING BUFFER
// ─────────────────────────────────────────────────────────────────────────────

const MAX_MEMORY_SNAPSHOTS = 20;
const _snapshotBuffer: OnboardingSnapshot[] = [];

function pushToMemoryBuffer(snapshot: OnboardingSnapshot): void {
  _snapshotBuffer.push(snapshot);
  if (_snapshotBuffer.length > MAX_MEMORY_SNAPSHOTS) {
    _snapshotBuffer.shift();
  }
}

/**
 * Returns a copy of the in-memory snapshot ring buffer (newest last).
 * Safe to expose to debug tooling — no mutation of internal state.
 */
export function getSnapshotBuffer(): readonly OnboardingSnapshot[] {
  return [..._snapshotBuffer];
}

/**
 * Clear the in-memory buffer.
 * @internal Exposed for testing.
 */
export function _clearSnapshotBuffer(): void {
  _snapshotBuffer.length = 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. SESSION STORAGE STRATEGY
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_STORAGE_KEY  = 'hr_ob_snap';
const MAX_SESSION_SNAPSHOTS = 20;

function persistToSessionStorage(snapshot: OnboardingSnapshot): void {
  if (typeof window === 'undefined') return;
  try {
    const raw      = sessionStorage.getItem(SESSION_STORAGE_KEY);
    const existing = raw ? (JSON.parse(raw) as OnboardingSnapshot[]) : [];
    existing.push(snapshot);
    // Keep only the most recent MAX_SESSION_SNAPSHOTS
    const trimmed  = existing.slice(-MAX_SESSION_SNAPSHOTS);
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // sessionStorage may be unavailable (private mode, quota exceeded) — swallow.
  }
}

/**
 * Read all snapshots persisted in sessionStorage for this tab.
 * Returns an empty array if unavailable or malformed.
 */
export function readSessionStorageSnapshots(): OnboardingSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OnboardingSnapshot[]) : [];
  } catch {
    return [];
  }
}

/**
 * Clear all snapshots from sessionStorage.
 * Call on onboarding restart or logout.
 */
export function clearSessionStorageSnapshots(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch { /* swallow */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. SNAPSHOT SINK STUB (future telemetry)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Set to true when a telemetry backend is ready to receive snapshots.
 * Flipping this flag is the ONLY change needed to activate forwarding.
 *
 * @future Replace forwardToSnapshotSink() body when provider is wired.
 */
const ENABLE_SNAPSHOT_FORWARDING = false;

/**
 * Forward a snapshot to the telemetry provider.
 *
 * CURRENT STATE: No-op stub.
 *
 * @example (future — custom endpoint)
 *   await fetch('/api/telemetry/onboarding-snapshot', {
 *     method: 'POST',
 *     body: JSON.stringify(snapshot),
 *     headers: { 'Content-Type': 'application/json' },
 *   });
 *
 * @example (future — Sentry breadcrumb)
 *   Sentry.addBreadcrumb({
 *     category: 'onboarding.snapshot',
 *     message: snapshot.scenario,
 *     level: snapshot.severity === 'critical' ? 'fatal' : snapshot.severity,
 *     data: snapshot,
 *   });
 */
function forwardToSnapshotSink(_snapshot: OnboardingSnapshot): void {
  // Intentional no-op — replace when ENABLE_SNAPSHOT_FORWARDING is true.
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. DEVELOPMENT LOGGING
// ─────────────────────────────────────────────────────────────────────────────

const IS_DEV = process.env.NODE_ENV !== 'production';

function logSnapshotDev(snapshot: OnboardingSnapshot): void {
  if (!IS_DEV) return;

  const label   = `[Snapshot:${snapshot.scenario}] ${snapshot.severity.toUpperCase()} — ${snapshot.snapshotId}`;
  const method  =
    snapshot.severity === 'critical' || snapshot.severity === 'error'
      ? 'error'
      : snapshot.severity === 'warn'
      ? 'warn'
      : 'info';

  console.groupCollapsed(label);
  console[method]('📸 Scenario:', snapshot.scenario);
  console[method]('🕐 Timestamp:', snapshot.timestamp);
  console[method]('🆔 Snapshot ID:', snapshot.snapshotId);

  console.group('Onboarding State');
  console.table({
    currentStep:         snapshot.onboarding.currentStep,
    completionPercent:   snapshot.onboarding.completionPercent,
    isComplete:          snapshot.onboarding.isComplete,
    engineVersion:       snapshot.onboarding.engineVersion,
    isVersionCompatible: snapshot.onboarding.isVersionCompatible,
    completedSteps:      snapshot.onboarding.completedSteps.join(', ') || '—',
  });
  console.groupEnd();

  console.group('Recovery State');
  console.table({
    scenario:      snapshot.recovery.scenario ?? '—',
    retryCount:    snapshot.recovery.retryCount,
    isRecoverable: snapshot.recovery.isRecoverable,
  });
  console.groupEnd();

  console.group('Diagnostics');
  console.table({
    pollingActive:   snapshot.diagnostics.pollingActive,
    processingState: snapshot.diagnostics.processingState,
    routePath:       snapshot.diagnostics.routePath,
    frontendVersion: snapshot.diagnostics.frontendVersion,
  });
  console.groupEnd();

  console.info('💾 Buffer size:', _snapshotBuffer.length);
  console.groupEnd();
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. PRIMARY API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * captureOnboardingSnapshot
 *
 * The single, centralised entry point for all onboarding snapshot captures.
 *
 * BEHAVIOUR:
 *   1. Deduplication check — duplicate within 30s cooldown → silent no-op
 *   2. Build sanitized snapshot
 *   3. Push to in-memory ring buffer
 *   4. Persist to sessionStorage
 *   5. Forward to telemetry sink (if ENABLE_SNAPSHOT_FORWARDING)
 *   6. Log to console in development (structured console.group)
 *   7. Forward diagnostic event to logOnboardingEvent() for shared log stream
 *
 * GUARANTEE: Never throws. All errors are swallowed internally.
 * GUARANTEE: Never blocks rendering or delays recovery UI.
 * GUARANTEE: Never captures tokens, emails, or user data.
 *
 * @example — version mismatch
 *   captureOnboardingSnapshot({
 *     scenario:            'version_mismatch',
 *     engineVersion:       session.engineVersion,
 *     isVersionCompatible: false,
 *     currentStep:         session.currentStep,
 *     primaryContext:      session.engineVersion ?? 'unknown',
 *   });
 *
 * @example — polling stuck
 *   captureOnboardingSnapshot({
 *     scenario:        'polling_stuck',
 *     currentStep:     'processing',
 *     pollingActive:   true,
 *     processingState: 'stuck',
 *     primaryContext:  'processing',
 *   });
 */
export function captureOnboardingSnapshot(input: SnapshotInput): void {
  try {
    // ── 1. Deduplication ──────────────────────────────────────────────────
    if (isDuplicateSnapshot(input)) return;

    // ── 2. Build ──────────────────────────────────────────────────────────
    const snapshot = createOnboardingSnapshot(input);

    // ── 3. In-memory buffer ───────────────────────────────────────────────
    pushToMemoryBuffer(snapshot);

    // ── 4. sessionStorage ─────────────────────────────────────────────────
    persistToSessionStorage(snapshot);

    // ── 5. Telemetry sink ─────────────────────────────────────────────────
    if (ENABLE_SNAPSHOT_FORWARDING) {
      try { forwardToSnapshotSink(snapshot); } catch { /* never surface */ }
    }

    // ── 6. Dev logging ────────────────────────────────────────────────────
    logSnapshotDev(snapshot);

    // ── 7. Emit into shared diagnostic stream ─────────────────────────────
    // Map snapshot scenarios to the nearest onboarding-diagnostics.ts event
    // so the two streams stay correlated in the same log output.
    _emitDiagnosticForSnapshot(input, snapshot);

  } catch {
    // Snapshot capture must never break onboarding — swallow all errors.
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. DIAGNOSTICS BRIDGE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map a snapshot scenario back to a logOnboardingEvent() call so the
 * shared diagnostic stream in onboarding-diagnostics.ts also carries an
 * entry for the same event. This keeps both streams aligned without
 * requiring consumers to call both APIs.
 *
 * Only maps scenarios that have a direct equivalent in onboarding-diagnostics.ts.
 */
function _emitDiagnosticForSnapshot(
  input:    SnapshotInput,
  snapshot: OnboardingSnapshot,
): void {
  try {
    const ts = snapshot.timestamp;

    switch (input.scenario) {
      case 'version_mismatch':
        logOnboardingEvent({
          event:    'version_mismatch',
          severity: 'error',
          timestamp: ts,
          metadata: {
            receivedVersion:   input.engineVersion ?? null,
            supportedVersions: ['1.0.0'],
            detectedAt:        ts,
          },
        });
        break;

      case 'invalid_step_detected':
        logOnboardingEvent({
          event:    'invalid_step_detected',
          severity: 'warn',
          timestamp: ts,
          onboardingStep: input.currentStep ?? undefined,
          metadata: {
            stepId:     input.currentStep ?? 'unknown',
            validSteps: ['education','academics','activities','cognitive','aspiration','processing','result'],
          },
        });
        break;

      case 'load_timeout':
        logOnboardingEvent({
          event:    'load_timeout',
          severity: 'warn',
          timestamp: ts,
          metadata: { maxDurationMs: 15_000 },
        });
        break;

      case 'session_fetch_failed':
        logOnboardingEvent({
          event:    'session_fetch_failed',
          severity: 'error',
          timestamp: ts,
          metadata: {
            errorCategory: input.processingState ?? 'unknown',
            errorMessage:  input.primaryContext  ?? 'Captured via snapshot',
          },
        });
        break;

      case 'recovery_screen_rendered':
        logOnboardingEvent({
          event:    'recovery_triggered',
          severity: 'warn',
          timestamp: ts,
          onboardingStep: input.currentStep ?? undefined,
          metadata: { scenario: input.recoveryScenario ?? 'unknown' },
        });
        break;

      case 'onboarding_restart_triggered':
        logOnboardingEvent({
          event:    'onboarding_restarted',
          severity: 'info',
          timestamp: ts,
          onboardingStep: input.currentStep ?? undefined,
          metadata: {
            triggeredFromScenario: input.recoveryScenario ?? input.primaryContext ?? 'unknown',
            stepAtRestart: input.currentStep ?? 'unknown',
          },
        });
        break;

      // malformed_session, unrecoverable_route_state, polling_stuck
      // have no direct diagnostic equivalent — snapshot-only.
      default:
        break;
    }
  } catch {
    // Never surface — diagnostic bridge is best-effort.
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 14. RECOVERY SNAPSHOT BUILDER (convenience helper)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * buildRecoverySnapshot
 *
 * Convenience wrapper that constructs a captureOnboardingSnapshot() call from
 * the values available in OnboardingRecoveryScreen and VersionMismatchScreen.
 *
 * Maps RecoveryScenario → SnapshotScenario automatically.
 *
 * @example — from OnboardingRecoveryScreen
 *   useEffect(() => {
 *     buildRecoverySnapshot({
 *       recoveryScenario: flow.recovery.scenario,
 *       retryCount:       retryCount,
 *       currentStep:      flow.currentStepId,
 *       completedSteps:   flow.session?.completedSteps ?? [],
 *       completionPercent: flow.progressPercent,
 *       isComplete:       flow.session?.isComplete ?? false,
 *       engineVersion:    flow.session?.engineVersion,
 *       isVersionCompatible: flow.versionCompatibility.isVersionCompatible,
 *       pollingActive:    flow.isProcessingStep,
 *     });
 *   }, []);
 */
export function buildRecoverySnapshot(params: {
  recoveryScenario:    RecoveryScenario | null;
  retryCount?:         number;
  currentStep?:        string | null;
  completedSteps?:     readonly string[];
  completionPercent?:  number;
  isComplete?:         boolean;
  engineVersion?:      string | null | undefined;
  isVersionCompatible?: boolean;
  pollingActive?:      boolean;
}): void {
  // Map RecoveryScenario → SnapshotScenario
  const scenarioMap: Partial<Record<RecoveryScenario, SnapshotScenario>> = {
    fetch_failed:        'session_fetch_failed',
    malformed_session:   'malformed_session',
    load_timeout:        'load_timeout',
    stale_session:       'malformed_session',
    backend_unavailable: 'unrecoverable_route_state',
    unauthorized:        'unrecoverable_route_state',
  };

  const scenario: SnapshotScenario =
    (params.recoveryScenario ? scenarioMap[params.recoveryScenario] : null)
    ?? 'recovery_screen_rendered';

  captureOnboardingSnapshot({
    scenario,
    recoveryScenario:    params.recoveryScenario,
    retryCount:          params.retryCount          ?? 0,
    currentStep:         params.currentStep         ?? null,
    completedSteps:      params.completedSteps       ?? [],
    completionPercent:   params.completionPercent    ?? 0,
    isComplete:          params.isComplete           ?? false,
    engineVersion:       params.engineVersion        ?? null,
    isVersionCompatible: params.isVersionCompatible  ?? true,
    pollingActive:       params.pollingActive         ?? false,
    isRecoverable:       params.recoveryScenario !== 'unauthorized',
    primaryContext:      params.recoveryScenario ?? 'unknown',
  });
}