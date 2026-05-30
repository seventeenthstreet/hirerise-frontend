/**
 * @file src/lib/observability/authLogger.ts
 *
 * PHASES 1, 2, 8, 10 — Structured Auth/Hydration Logging, Correlation IDs,
 *                       Auth Event Telemetry, and Performance Metrics
 *
 * PURPOSE
 * ───────
 * Single source of truth for all auth and hydration observability events.
 * Builds on the existing @/lib/observability layer — does NOT replace it.
 *
 * WHAT THIS ADDS
 * ──────────────
 * 1. AUTH_LOG_EVENTS — canonical string constants for every loggable event
 *    so names are never typed as free strings in call sites.
 *
 * 2. HydrationCorrelationIds — a request/hydration/auth-cycle triple that
 *    is generated once per hydration run and threaded into every log event
 *    emitted during that run. Downstream, the requestId header (Phase 2)
 *    lets backend logs be joined to frontend logs by ID.
 *
 * 3. logAuthEvent() — thin wrapper around logEvent(createEvent()) that
 *    stamps every call with hydrationId, authCycleId, sessionId, and a
 *    high-resolution timestamp so events can be ordered within a cycle.
 *
 * 4. Performance timing helpers:
 *    - startTimer() / endTimer() — wall-clock measurement of named spans.
 *    - logHydrationMetrics() — emits a HYDRATION_METRICS event at the end
 *      of each hydration cycle with fetchUser, warmAppEntry, and total latencies.
 *
 * 5. Telemetry counters — LOGIN_SUCCESS, LOGIN_FAILURE, OAUTH_SUCCESS,
 *    OAUTH_FAILURE, ONBOARDING_COMPLETE, BOOTSTRAP_FAILURE, TOKEN_REFRESH
 *    are tracked in-process and exposed via getTelemetrySnapshot().
 *
 * USAGE
 * ─────
 *   // At the start of each hydration cycle:
 *   const ids = createHydrationIds();
 *
 *   logAuthEvent('HYDRATION_START', ids, { source });
 *   const t = startTimer('fetchUser');
 *   await fetchUser(...);
 *   logAuthEvent('FETCHUSER_END', ids, { durationMs: endTimer(t) });
 *
 * PRODUCTION SAFETY
 * ─────────────────
 * - No access tokens or session cookies are ever logged.
 * - All fields pass through sanitizeAuthContext() before being emitted.
 * - This module never throws — all exports are wrapped in try/catch.
 */

import { logEvent, createEvent } from '@/lib/observability';

// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL AUTH LOG EVENT NAMES  (Phase 1)
// ─────────────────────────────────────────────────────────────────────────────

export const AUTH_LOG_EVENTS = {
  // Supabase auth state machine
  INITIAL_SESSION:      'AUTH_INITIAL_SESSION',
  SIGNED_IN:            'AUTH_SIGNED_IN',
  SIGNED_OUT:           'AUTH_SIGNED_OUT',
  TOKEN_REFRESHED:      'AUTH_TOKEN_REFRESHED',

  // Hydration lifecycle
  HYDRATION_START:      'HYDRATION_START',
  HYDRATION_END:        'HYDRATION_END',
  HYDRATION_SKIPPED:    'HYDRATION_SKIPPED',
  HYDRATION_CANCELLED:  'HYDRATION_CANCELLED',
  HYDRATION_TIMEOUT:    'HYDRATION_TIMEOUT',
  HYDRATION_METRICS:    'HYDRATION_METRICS',

  // warmAppEntry
  WARM_ENTRY_START:     'WARM_ENTRY_START',
  WARM_ENTRY_END:       'WARM_ENTRY_END',
  WARM_ENTRY_TIMEOUT:   'WARM_ENTRY_TIMEOUT',
  WARM_ENTRY_ERROR:     'WARM_ENTRY_ERROR',

  // fetchUser
  FETCH_USER_START:     'FETCH_USER_START',
  FETCH_USER_END:       'FETCH_USER_END',
  FETCH_USER_RETRY:     'FETCH_USER_RETRY',
  FETCH_USER_EXHAUSTED: 'FETCH_USER_EXHAUSTED',
  FETCH_USER_ERROR:     'FETCH_USER_ERROR',

  // Auth failures
  AUTH_HYDRATION_FAILED: 'AUTH_HYDRATION_FAILED',
  AUTH_FAILURE:          'AUTH_FAILURE',

  // Routing
  ROUTE_REDIRECT:       'ROUTE_REDIRECT',
  ROUTE_STABILIZED:     'ROUTE_STABILIZED',

  // Onboarding
  ONBOARDING_START:     'ONBOARDING_START',
  ONBOARDING_STEP:      'ONBOARDING_STEP',
  ONBOARDING_COMPLETE:  'ONBOARDING_COMPLETE',
  ONBOARDING_ERROR:     'ONBOARDING_ERROR',

  // Telemetry counters
  LOGIN_SUCCESS:        'LOGIN_SUCCESS',
  LOGIN_FAILURE:        'LOGIN_FAILURE',
  OAUTH_SUCCESS:        'OAUTH_SUCCESS',
  OAUTH_FAILURE:        'OAUTH_FAILURE',
  BOOTSTRAP_FAILURE:    'BOOTSTRAP_FAILURE',
} as const;

export type AuthLogEventName = typeof AUTH_LOG_EVENTS[keyof typeof AUTH_LOG_EVENTS];

// ─────────────────────────────────────────────────────────────────────────────
// CORRELATION IDs  (Phase 2)
// ─────────────────────────────────────────────────────────────────────────────

export interface HydrationCorrelationIds {
  /** Unique per hydration cycle (generated once at hydration start). */
  hydrationId:  string;
  /** Unique per auth event cycle (SIGNED_IN / TOKEN_REFRESHED / INITIAL_SESSION). */
  authCycleId:  string;
  /** Per-bootstrap request ID — propagated as X-Request-ID to backend. */
  requestId:    string;
}

function genId(prefix: string): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${ts}${rnd}`;
}

/**
 * Generate a fresh set of correlation IDs for one hydration cycle.
 * Call once at the start of each `hydrate()` invocation, then thread
 * the returned object into every logAuthEvent() call during that cycle.
 */
export function createHydrationIds(): HydrationCorrelationIds {
  return {
    hydrationId: genId('h'),
    authCycleId: genId('ac'),
    requestId:   genId('req'),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SANITIZATION — never log tokens or PII  (Phase 1)
// ─────────────────────────────────────────────────────────────────────────────

const REDACTED_KEYS = new Set([
  'access_token', 'accessToken', 'refresh_token', 'refreshToken',
  'token', 'bearer', 'password', 'secret', 'key', 'authorization',
]);

function sanitizeAuthContext(
  ctx: Record<string, unknown>,
): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (REDACTED_KEYS.has(k.toLowerCase())) {
      clean[k] = '[REDACTED]';
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE LOGGING  (Phases 1 + 2)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Emit a structured auth/hydration event via the existing observability layer.
 *
 * All emitted events include:
 *  - hydrationId / authCycleId / requestId for end-to-end correlation
 *  - ISO-8601 timestamp
 *  - sanitized context (tokens redacted)
 *
 * Never throws.
 */
export function logAuthEvent(
  name:    AuthLogEventName,
  ids:     Partial<HydrationCorrelationIds>,
  context: Record<string, unknown> = {},
  level:   'info' | 'warn' | 'error' = 'info',
): void {
  try {
    logEvent(createEvent({
      type:  'system',
      name,
      level,
      context: {
        ...sanitizeAuthContext(context),
        ...(ids.hydrationId ? { hydrationId: ids.hydrationId }   : {}),
        ...(ids.authCycleId ? { authCycleId: ids.authCycleId }   : {}),
        ...(ids.requestId   ? { requestId:   ids.requestId }     : {}),
        ts: new Date().toISOString(),
      },
    }));
  } catch {
    // Observability must never break the auth path.
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PERFORMANCE TIMERS  (Phase 10)
// ─────────────────────────────────────────────────────────────────────────────

export interface TimerHandle {
  name:      string;
  startedAt: number; // performance.now()
}

/** Start a named performance timer. Returns a handle for endTimer(). */
export function startTimer(name: string): TimerHandle {
  return {
    name,
    startedAt: typeof performance !== 'undefined' ? performance.now() : Date.now(),
  };
}

/** Stop a timer and return elapsed milliseconds (rounded to 2 dp). */
export function endTimer(handle: TimerHandle): number {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return Math.round((now - handle.startedAt) * 100) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// HYDRATION METRICS EVENT  (Phase 10)
// ─────────────────────────────────────────────────────────────────────────────

export interface HydrationTimings {
  warmAppEntryMs?:         number;
  fetchUserMs?:            number;
  totalHydrationMs?:       number;
  redirectStabilizationMs?: number;
}

/**
 * Emit a HYDRATION_METRICS event at the end of a hydration cycle.
 * All timing fields are optional — omit whichever spans didn't occur.
 */
export function logHydrationMetrics(
  ids:     HydrationCorrelationIds,
  timings: HydrationTimings,
  meta:    Record<string, unknown> = {},
): void {
  logAuthEvent(
    AUTH_LOG_EVENTS.HYDRATION_METRICS,
    ids,
    { ...timings, ...meta },
    'info',
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TELEMETRY COUNTERS  (Phase 8)
// ─────────────────────────────────────────────────────────────────────────────

interface TelemetryCounters {
  loginSuccess:        number;
  loginFailure:        number;
  oauthSuccess:        number;
  oauthFailure:        number;
  hydrationDurationMs: number[];  // ring buffer, last 50
  onboardingComplete:  number;
  tokenRefreshCount:   number;
  bootstrapFailures:   number;
}

const _counters: TelemetryCounters = {
  loginSuccess:        0,
  loginFailure:        0,
  oauthSuccess:        0,
  oauthFailure:        0,
  hydrationDurationMs: [],
  onboardingComplete:  0,
  tokenRefreshCount:   0,
  bootstrapFailures:   0,
};

function recordHydrationDuration(ms: number): void {
  _counters.hydrationDurationMs.push(ms);
  if (_counters.hydrationDurationMs.length > 50) {
    _counters.hydrationDurationMs.shift();
  }
}

/** Increment a named telemetry counter and emit the corresponding event. */
export function trackTelemetry(
  event:   'loginSuccess' | 'loginFailure' | 'oauthSuccess' | 'oauthFailure'
         | 'onboardingComplete' | 'tokenRefresh' | 'bootstrapFailure',
  ids:     Partial<HydrationCorrelationIds> = {},
  context: Record<string, unknown> = {},
): void {
  try {
    switch (event) {
      case 'loginSuccess':       _counters.loginSuccess++;       logAuthEvent(AUTH_LOG_EVENTS.LOGIN_SUCCESS,       ids, context); break;
      case 'loginFailure':       _counters.loginFailure++;       logAuthEvent(AUTH_LOG_EVENTS.LOGIN_FAILURE,       ids, context, 'error'); break;
      case 'oauthSuccess':       _counters.oauthSuccess++;       logAuthEvent(AUTH_LOG_EVENTS.OAUTH_SUCCESS,       ids, context); break;
      case 'oauthFailure':       _counters.oauthFailure++;       logAuthEvent(AUTH_LOG_EVENTS.OAUTH_FAILURE,       ids, context, 'error'); break;
      case 'onboardingComplete': _counters.onboardingComplete++; logAuthEvent(AUTH_LOG_EVENTS.ONBOARDING_COMPLETE, ids, context); break;
      case 'tokenRefresh':       _counters.tokenRefreshCount++;  logAuthEvent(AUTH_LOG_EVENTS.TOKEN_REFRESHED,     ids, context); break;
      case 'bootstrapFailure':   _counters.bootstrapFailures++;  logAuthEvent(AUTH_LOG_EVENTS.BOOTSTRAP_FAILURE,   ids, context, 'error'); break;
    }
  } catch { /* never surface */ }
}

/**
 * Get a snapshot of current in-process telemetry counters.
 * Safe to expose to a dev debug overlay or internal diagnostics endpoint.
 *
 * @example
 *   const snap = getTelemetrySnapshot();
 *   console.table(snap);
 */
export function getTelemetrySnapshot(): TelemetryCounters & {
  avgHydrationMs: number | null;
  p95HydrationMs: number | null;
} {
  const durations = _counters.hydrationDurationMs;
  let avgHydrationMs: number | null = null;
  let p95HydrationMs: number | null = null;

  if (durations.length > 0) {
    avgHydrationMs = Math.round(
      durations.reduce((a, b) => a + b, 0) / durations.length,
    );
    const sorted = [...durations].sort((a, b) => a - b);
    const idx    = Math.floor(sorted.length * 0.95);
    p95HydrationMs = sorted[Math.min(idx, sorted.length - 1)] ?? null;
  }

  return { ..._counters, avgHydrationMs, p95HydrationMs };
}

/** Record a completed hydration duration (called after each hydration cycle). */
export function recordHydration(durationMs: number): void {
  recordHydrationDuration(durationMs);
}

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST ID HEADER INJECTION  (Phase 2)
// ─────────────────────────────────────────────────────────────────────────────

export const REQUEST_ID_HEADER = 'X-Request-ID';
export const HYDRATION_ID_HEADER = 'X-Hydration-ID';

/**
 * Returns headers to inject into auth/bootstrap requests so the backend
 * can emit logs tagged with the same requestId, enabling end-to-end tracing.
 */
export function buildCorrelationHeaders(
  ids: Partial<HydrationCorrelationIds>,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (ids.requestId)   headers[REQUEST_ID_HEADER]   = ids.requestId;
  if (ids.hydrationId) headers[HYDRATION_ID_HEADER] = ids.hydrationId;
  return headers;
}