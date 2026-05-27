/**
 * @file lib/monitoring.ts
 * @description Lightweight monitoring system for the HireRise SaaS platform.
 *
 * PHASE 0 HARDENING — SaaS Maturity Layer (Pre-Implementation)
 *
 * Changes in this revision:
 *  FLUSH STRATEGY — no data loss on page exit
 *
 *  Previous state: microtask buffer only (Promise.resolve().then()).
 *  Problem: microtask queue does not survive tab close or navigation.
 *  Events buffered in the microtask queue on page exit are lost.
 *
 *  New guarantees:
 *  1. visibilitychange (hidden) → flush immediately when tab goes background.
 *     This is the most reliable signal for mobile (tab switching, home button).
 *  2. beforeunload → flush synchronously. Last-ditch for desktop close/navigate.
 *  3. Periodic flush interval → drains buffer every FLUSH_INTERVAL_MS.
 *     Prevents unbounded buffer growth during long sessions.
 *  4. sendBeacon → preferred flush transport. Non-blocking, survives page unload.
 *     Falls back to synchronous XHR if sendBeacon is unavailable (rare).
 *  5. Failure handling → flush errors are always swallowed. Monitoring must
 *     NEVER affect app flow. Failed flush attempts are logged (dev only).
 *  6. Flush idempotency → entries are removed from _buffer before the flush
 *     attempt, not after. This prevents double-send if flush is called twice
 *     concurrently (e.g. visibilitychange fires milliseconds before beforeunload).
 *
 *  NON-BLOCKING GUARANTEE MAINTAINED:
 *  - enqueue() still uses microtask deferral for the call site (no change).
 *  - flush() is called outside the hot path — never blocks the UI thread.
 *
 *  PROVIDER SWAP:
 *  Replace sendToProvider() to wire Sentry, Datadog, New Relic, or custom.
 *  The flush plumbing (triggers, sendBeacon, failure handling) does not change.
 *
 * ARCHITECTURE (unchanged):
 *  Pure lib module — no React, no hooks.
 *  Used in: lib/api/core (error capture), hooks (perf tracking).
 *  UI layer: ZERO direct calls allowed.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info';

export interface UserStateSnapshot {
  userId?:             string;
  userType?:           string | null;
  onboardingComplete?: boolean;
  resumeUploaded?:     boolean;
  tier?:               string;
}

export interface ErrorContext {
  subsystem:   string;
  action?:     string;
  statusCode?: number;
  errorCode?:  string;
  userState?:  UserStateSnapshot;
  metadata?:   Record<string, unknown>;
  severity?:   ErrorSeverity;
}

export interface PerformanceMetric {
  name:   string;
  value:  number;
  unit?:  string;
  tags?:  Record<string, string | number | boolean>;
}

export interface PollingCycleMetric {
  name:           string;
  durationMs:     number;
  attempts:       number;
  networkRetries: number;
  exitReason:     'success' | 'timeout' | 'failed' | 'network_error' | 'quota';
  metadata?:      Record<string, string | number | boolean>;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL BUFFER
// ─────────────────────────────────────────────────────────────────────────────

interface BufferedEntry {
  type:    'error' | 'perf' | 'polling';
  payload: unknown;
  ts:      number;
}

const _buffer: BufferedEntry[] = [];
const MAX_BUFFER_SIZE    = 200;

/**
 * Flush configuration constants.
 * FLUSH_ENDPOINT: replace with your monitoring ingest URL when wiring a provider.
 * FLUSH_INTERVAL_MS: how often the periodic flush runs (90 seconds).
 */
const FLUSH_ENDPOINT     = '/api/v1/monitoring/ingest'; // placeholder — replace on provider wire
/**
 * Flush interval: 90 seconds.
 *
 * Rationale for 90s (vs prior 5 min):
 *  - Reduces maximum data loss window from 5 min to 90s on unexpected crash.
 *  - CPU impact is negligible: flush() is a no-op when _buffer is empty,
 *    and the setInterval tick itself is ~1µs overhead per fire.
 *  - Does NOT conflict with visibilitychange / beforeunload triggers:
 *    those flush immediately on exit; the interval merely drains between exits.
 *  - 90s is within the [60, 120] target range with a balanced trade-off.
 */
const FLUSH_INTERVAL_MS  = 90 * 1000; // 90 seconds

// ─────────────────────────────────────────────────────────────────────────────
// ENQUEUE — microtask-deferred call-site non-blocking guarantee
//
// The call site returns immediately. The buffer append happens in a microtask
// so the caller's stack unwinds before any I/O is even queued. This ensures
// monitoring NEVER adds latency to the hot path (API calls, user interactions).
// ─────────────────────────────────────────────────────────────────────────────

function enqueue(type: BufferedEntry['type'], payload: unknown): void {
  if (typeof window === 'undefined') return; // SSR guard

  Promise.resolve().then(() => {
    try {
      if (_buffer.length >= MAX_BUFFER_SIZE) {
        _buffer.shift(); // evict oldest under memory pressure
      }
      _buffer.push({ type, payload, ts: Date.now() });

      // Mirror into window queue for DevTools inspection
      const win   = window as unknown as Record<string, unknown>;
      const queue = ((win.__monitoringQueue ??= []) as unknown[]);
      queue.push({ type, payload, ts: Date.now() });
    } catch {
      // Swallow — monitoring must never affect app flow
    }
  }).catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// FLUSH ENGINE
//
// Architecture:
//  1. Drain _buffer into a local snapshot (prevents double-send on concurrent
//     flush calls — entries leave the buffer BEFORE the I/O attempt).
//  2. Attempt sendBeacon (non-blocking, survives page unload).
//  3. Fall back to synchronous XHR if sendBeacon is unavailable.
//  4. If I/O fails: re-queue entries at the front of _buffer for the next flush.
//  5. All errors are swallowed (logged in dev only).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serialize entries for transport.
 * The format here is a simple JSON batch — replace with provider-specific
 * serialization when wiring a real backend.
 */
function serializeEntries(entries: BufferedEntry[]): string {
  return JSON.stringify({ entries, _flushedAt: Date.now() });
}

/**
 * Provider dispatch — replace this body when wiring a real monitoring provider.
 *
 * Sentry example:
 *   entries.forEach(e => {
 *     if (e.type === 'error') Sentry.captureException(...);
 *   });
 *
 * Datadog example:
 *   entries.forEach(e => {
 *     if (e.type === 'perf') datadogRum.addTiming(e.payload.name, e.payload.value);
 *   });
 *
 * Custom beacon:
 *   navigator.sendBeacon(FLUSH_ENDPOINT, serializeEntries(entries));
 *
 * Until wired, this function is a no-op (entries stay in window.__monitoringQueue).
 */
function sendToProvider(_entries: BufferedEntry[]): void {
  // ── PLACEHOLDER — replace with provider SDK call or beacon ────────────────
  // No-op until a provider is wired. Entries are already in window.__monitoringQueue.
  void _entries;
}

/**
 * Attempt to flush the buffer using navigator.sendBeacon.
 * sendBeacon is the preferred transport for page-exit scenarios:
 *  - Non-blocking (doesn't delay page close or navigation).
 *  - Survives page unload (unlike fetch() which is cancelled).
 *  - Returns a boolean indicating whether the browser accepted the data.
 *
 * Falls back to synchronous XHR if sendBeacon is unavailable (rare).
 * Returns true if the flush was accepted, false otherwise.
 */
function flushViaBeacon(entries: BufferedEntry[]): boolean {
  if (typeof navigator === 'undefined') return false;

  const payload = serializeEntries(entries);

  if (typeof navigator.sendBeacon === 'function') {
    try {
      const accepted = navigator.sendBeacon(FLUSH_ENDPOINT, payload);
      if (process.env.NODE_ENV === 'development') {
        console.debug(`[Monitoring] sendBeacon ${accepted ? 'accepted' : 'rejected'} (${entries.length} entries)`);
      }
      return accepted;
    } catch {
      // sendBeacon can throw in some browser privacy modes
    }
  }

  // Fallback: synchronous XHR (last resort, only if sendBeacon unavailable)
  try {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', FLUSH_ENDPOINT, false); // false = synchronous
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(payload);
    return xhr.status >= 200 && xhr.status < 300;
  } catch {
    return false;
  }
}

/**
 * Core flush — drains the buffer and dispatches to the provider.
 *
 * Idempotency guarantee:
 *  Entries are spliced OUT of _buffer before the I/O attempt. If the I/O
 *  fails, they are re-prepended at the front. This prevents duplicate sends
 *  if two flush triggers fire simultaneously (e.g. visibility + beforeunload).
 *
 * Non-blocking: this function is synchronous but delegates to sendBeacon
 * which is async-on-the-browser side. The call site returns immediately.
 */
function flush(): void {
  if (typeof window === 'undefined') return;
  if (_buffer.length === 0) return;

  // Re-entrancy guard — exit immediately if a flush is already in progress.
  // This covers the case where visibilitychange and beforeunload both fire
  // within the same synchronous frame (common on desktop tab close).
  if (_isFlushing) return;
  _isFlushing = true;

  // Drain buffer atomically — splice all entries out before I/O
  const toSend = _buffer.splice(0, _buffer.length);

  try {
    // 1. Attempt sendBeacon / XHR flush
    const flushed = flushViaBeacon(toSend);

    if (!flushed) {
      // I/O failed or was rejected — re-queue at front of buffer for next flush
      _buffer.unshift(...toSend);
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Monitoring] Flush failed — entries re-queued:', toSend.length);
      }
      return;
    }

    // 2. Provider-specific dispatch (no-op until wired)
    sendToProvider(toSend);

  } catch {
    // Re-queue on unexpected error
    _buffer.unshift(...toSend);
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Monitoring] Flush threw — entries re-queued');
    }
  } finally {
    _isFlushing = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FLUSH TRIGGERS — registered once on first module import (browser only)
//
// Three triggers provide layered coverage:
//
//  1. visibilitychange (document hidden)
//     Best signal for mobile — fires when user switches tab, goes to home screen,
//     or the browser backgroundsthe tab. More reliable than beforeunload on mobile.
//     Also fires on desktop tab switch (gives us early flush while tab is alive).
//
//  2. beforeunload
//     Traditional desktop signal — fires on tab close, browser close, navigation.
//     Less reliable on mobile (often skipped). Used as belt-and-suspenders.
//
//  3. Periodic interval (FLUSH_INTERVAL_MS = 90 seconds)
//     Drains buffer during long-running sessions to cap memory usage and
//     prevent data loss from unexpected crashes. Also provides a heartbeat for
//     session-level monitoring health checks.
//
// All triggers are registered once (guarded by _listenersRegistered).
// They are never unregistered (module-level singletons, tab lifetime).
// ─────────────────────────────────────────────────────────────────────────────

let _listenersRegistered = false;
let _flushIntervalId: ReturnType<typeof setInterval> | null = null;
/**
 * Re-entrancy guard — prevents double-send when two flush triggers fire
 * within the same synchronous execution (e.g. visibilitychange fires
 * milliseconds before beforeunload on desktop close).
 *
 * flush() sets this to true before any I/O and clears it after.
 * A concurrent flush() call that finds it already true exits immediately.
 * This is safe because both triggers fire on the same JS thread — there
 * is no true concurrency, only interleaved sync calls.
 */
let _isFlushing = false;

function registerFlushListeners(): void {
  if (_listenersRegistered) return;
  if (typeof window === 'undefined') return;

  _listenersRegistered = true;

  // 1. visibilitychange — flush when tab goes to background
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flush();
    }
  }, { passive: true });

  // 2. beforeunload — flush synchronously on page close/navigation
  window.addEventListener('beforeunload', () => {
    flush();
  });

  // 3. Periodic flush — drain buffer on interval
  _flushIntervalId = setInterval(() => {
    if (_buffer.length > 0) {
      flush();
    }
  }, FLUSH_INTERVAL_MS);

  if (process.env.NODE_ENV === 'development') {
    console.debug('[Monitoring] Flush listeners registered (visibility, beforeunload, interval)');
  }
}

// Register immediately on module load in browser environments.
// This is safe — the functions are no-ops if window is unavailable (SSR).
if (typeof window !== 'undefined') {
  registerFlushListeners();
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL DISPATCH — single egress point per concern
// ─────────────────────────────────────────────────────────────────────────────

function dispatchError(error: unknown, context: ErrorContext): void {
  if (typeof window === 'undefined') return;

  try {
    if (process.env.NODE_ENV === 'development') {
      console.error('[Monitoring:error]', {
        subsystem:  context.subsystem,
        action:     context.action ?? 'unknown',
        severity:   context.severity,
        statusCode: context.statusCode,
        errorCode:  context.errorCode,
        userState:  context.userState,
        metadata:   context.metadata,
        message:    error instanceof Error ? error.message : String(error),
        stack:      error instanceof Error ? error.stack  : undefined,
      });
    }

    // ── Production adapter hook ─────────────────────────────────────────────
    // Sentry:
    // Sentry.withScope(scope => {
    //   scope.setTag('subsystem', context.subsystem);
    //   scope.setTag('action', context.action ?? 'unknown');
    //   scope.setLevel(context.severity ?? 'error');
    //   if (context.statusCode) scope.setTag('status_code', String(context.statusCode));
    //   if (context.errorCode)  scope.setTag('error_code', context.errorCode);
    //   if (context.userState)  scope.setUser({ id: context.userState.userId });
    //   scope.setExtras({ ...context.metadata });
    //   Sentry.captureException(error);
    // });
    //
    // Datadog:
    // datadogRum.addError(error, { subsystem: context.subsystem, ...context.metadata });

    enqueue('error', {
      error: error instanceof Error
        ? { message: error.message, stack: error.stack }
        : String(error),
      context,
    });
  } catch {
    // Monitoring MUST NEVER crash the app — swallow silently.
  }
}

function dispatchPerformance(metric: PerformanceMetric): void {
  if (typeof window === 'undefined') return;
  try {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[Monitoring:perf]', metric);
    }
    enqueue('perf', metric);
  } catch {
    // Swallow
  }
}

function dispatchPollingCycle(metric: PollingCycleMetric): void {
  if (typeof window === 'undefined') return;
  try {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[Monitoring:polling]', metric);
    }
    enqueue('polling', metric);
  } catch {
    // Swallow
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API — unchanged from prior version
// ─────────────────────────────────────────────────────────────────────────────

export function captureError(error: unknown, context: ErrorContext): void {
  dispatchError(error, { severity: 'error', ...context });
}

export function captureWarning(message: string, context: ErrorContext): void {
  dispatchError(new Error(message), { ...context, severity: 'warning' });
}

export function trackPerformance(
  name: string,
  value: number,
  unit: string = 'ms',
  tags?: Record<string, string | number | boolean>,
): void {
  dispatchPerformance({ name, value, unit, tags });
}

export function trackPollingCycle(metric: PollingCycleMetric): void {
  dispatchPollingCycle(metric);
  trackPerformance(metric.name, metric.durationMs, 'ms', {
    attempts:        metric.attempts,
    network_retries: metric.networkRetries,
    exit_reason:     metric.exitReason,
    ...metric.metadata,
  });
}

export function startTimer(
  name: string,
): (tags?: Record<string, string | number | boolean>) => number {
  const start = performance.now();
  // [FIX] Idempotency flag — set to true after the first call.
  // Subsequent calls return 0 immediately: no duplicate performance event,
  // no throw, no console noise. Safe under defensive double-calls and races.
  let stopped = false;
  return (tags?: Record<string, string | number | boolean>): number => {
    if (stopped) return 0;
    stopped = true;
    const elapsed = Math.round(performance.now() - start);
    trackPerformance(name, elapsed, 'ms', tags);
    return elapsed;
  };
}

export function getMonitoringBuffer(): Readonly<BufferedEntry[]> {
  return _buffer;
}

/**
 * Manually trigger a flush. Exposed for testing and for explicit flush
 * at known safe points (e.g. after a major flow completes).
 *
 * Most callers should NOT need this — automatic triggers handle normal cases.
 */
export function flushMonitoringBuffer(): void {
  flush();
}

// ─────────────────────────────────────────────────────────────────────────────
// METRIC + SUBSYSTEM CONSTANTS (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const METRICS = {
  RESUME_UPLOAD_DURATION:     'resume_upload_duration',
  RESUME_POLLING_DURATION:    'resume_polling_duration',
  RESUME_POLLING_ATTEMPTS:    'resume_polling_attempts',
  ONBOARDING_STEP_LOAD:       'onboarding_step_load',
  ONBOARDING_SUBMIT_DURATION: 'onboarding_submit_duration',
  ONBOARDING_TOTAL_DURATION:  'onboarding_total_duration',
  APP_HYDRATION_DURATION:     'app_hydration_duration',
  DASHBOARD_LOAD_DURATION:    'dashboard_load_duration',
} as const;

export const SUBSYSTEMS = {
  RESUME_UPLOAD:  'resume_upload',
  RESUME_POLLING: 'resume_polling',
  ONBOARDING:     'onboarding',
  DIRECTION:      'direction',
  DASHBOARD:      'dashboard',
  APP_CONTEXT:    'app_context',
  QUOTA:          'quota',
} as const;

export const ACTIONS = {
  UPLOAD_RESUME:     'upload_resume',
  POLL_TICK:         'poll_tick',
  FETCH_STEPS:       'fetch_steps',
  SAVE_PROGRESS:     'save_progress',
  SUBMIT_ONBOARDING: 'submit_onboarding',
  LOAD_DASHBOARD:    'load_dashboard',
  WIDGET_LOAD:       'widget_load',
} as const;