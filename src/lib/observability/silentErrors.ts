/**
 * @file src/lib/observability/silentErrors.ts
 * @description Global silent error capture for non-render failures.
 *
 * React Error Boundaries only catch render-phase and lifecycle errors. This
 * module fills the gap by listening for:
 *
 *  - `window.onerror`          — uncaught synchronous + async script errors
 *  - `unhandledrejection`      — Promise rejections that escaped `.catch()`
 *
 * INSTALLATION:
 *  Call `initSilentErrorCapture()` once at application boot, inside a
 *  client-side entry point (e.g. the root layout or a 'use client' provider).
 *  The function is idempotent — calling it multiple times is safe.
 *
 * DESIGN CONSTRAINTS:
 *  - SSR-safe: all `window` access is guarded.
 *  - No side-effects at module evaluation time (listeners added only on call).
 *  - Never re-throws / never suppresses errors (returns false from onerror).
 *  - Adds a `window.__obs` debug handle for devtools inspection.
 *
 * ARCHITECTURE POSITION: System layer (below UI, above nothing)
 *   [browser runtime] → [this file] → logger → buffer
 */

import { createEvent, getEventBuffer, _clearEventBuffer } from './observability';
import { logEvent } from './logger';
import { getActiveTraceId } from './context';

// ─────────────────────────────────────────────────────────────────────────────
// IDEMPOTENCY GUARD
// ─────────────────────────────────────────────────────────────────────────────

let _initialized = false;

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Installs global silent-error listeners and a debug handle.
 * Safe to call multiple times — only installs once.
 *
 * @example
 *   // In your root layout or client-side provider:
 *   
 *   import { initSilentErrorCapture } from '@/lib/observability/silentErrors';
 *   initSilentErrorCapture();
 */
export function initSilentErrorCapture(): void {
  // SSR guard.
  if (typeof window === 'undefined') return;

  // Idempotency guard — only install listeners once per page lifecycle.
  if (_initialized) return;
  _initialized = true;

  // ── window.onerror ─────────────────────────────────────────────────────────
  // Captures uncaught synchronous and async script errors.
  // Returns false to preserve the browser's default error behaviour (console
  // output, devtools breakpoint on uncaught exception). Returning true would
  // suppress the browser's default handling — we never want that.
  const prevOnError = window.onerror;

  window.onerror = function (
    message,
    source,
    lineno,
    colno,
    error,
  ) {
    try {
      logEvent(createEvent({
        type:  'error',
        name:  'UNHANDLED_ERROR',
        level: 'error',
        traceId: getActiveTraceId() ?? undefined,
        context: {
          message: typeof message === 'string' ? message : String(message),
          source:  source   ?? 'unknown',
          line:    lineno   ?? 0,
          column:  colno    ?? 0,
          errorName:    error?.name    ?? 'UnknownError',
          errorMessage: error?.message ?? String(message),
          // Include truncated stack trace for source-map correlation.
          ...(error?.stack && { stack: error.stack.slice(0, 500) }),
        },
      }));
    } catch { /* never let the observer crash */ }

    // Chain to any previously registered onerror handler.
    if (typeof prevOnError === 'function') {
      return prevOnError.call(window, message, source, lineno, colno, error);
    }

    // false = do NOT suppress browser's default error handling.
    return false;
  };

  // ── unhandledrejection ─────────────────────────────────────────────────────
  // Captures Promise rejections that were not handled by a .catch() block.
  // This is the primary vector for silent async failures in React Query hooks,
  // setTimeout callbacks, and fire-and-forget API calls.
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    try {
      const reason  = event.reason;
      const context: Record<string, unknown> = {};

      if (reason instanceof Error) {
        context.errorName    = reason.name;
        context.errorMessage = reason.message;
        // Truncated stack for source-map correlation (not full stack — too verbose).
        if (reason.stack) context.stack = reason.stack.slice(0, 500);
        // Pull ApiClientError-specific fields without coupling to that class.
        const asRecord = reason as unknown as Record<string, unknown>;
        if (typeof asRecord.category === 'string') context.category = asRecord.category;
        if (typeof asRecord.status   === 'number') context.status   = asRecord.status;
      } else if (typeof reason === 'string') {
        context.errorMessage = reason;
      } else if (reason !== null && reason !== undefined) {
        context.errorType   = typeof reason;
        // Attempt safe serialisation for objects (e.g. plain-object rejections).
        try { context.reason = JSON.stringify(reason); } catch { /* unserializable */ }
      }

      logEvent(createEvent({
        type:  'error',
        name:  'UNHANDLED_PROMISE',
        level: 'error',
        traceId: getActiveTraceId() ?? undefined,
        context,
      }));
    } catch { /* never let the observer crash */ }

    // Do NOT call event.preventDefault() — that would suppress the browser's
    // unhandled rejection warning and make debugging harder.
  });

  // ── Debug handle ───────────────────────────────────────────────────────────
  // Exposes the event buffer on `window.__obs` for devtools inspection.
  // Wrapped in a try/catch in case window is not writable (CSP restrictions).
  try {
    (window as Window & { __obs?: unknown }).__obs = {
      getEventBuffer,

      /** Print the full session timeline as a console table. */
      printTimeline: () => {
        console.table(
          getEventBuffer().map((e) => ({
            time:      e.timestamp.slice(11, 23), // HH:mm:ss.mmm
            level:     e.level,
            type:      e.type,
            name:      e.name,
            traceId:   e.traceId ?? '—',
            errorId:   e.errorId ?? '—',
            sessionId: e.sessionId,
          })),
        );
      },

      /** Filter the buffer to all events sharing the given traceId. */
      getByTraceId: (traceId: string) =>
        getEventBuffer().filter((e) => e.traceId === traceId),

      /** Filter the buffer to all events associated with the given errorId. */
      getByErrorId: (errorId: number) =>
        getEventBuffer().filter((e) => e.errorId === errorId),

      /**
       * Clear all events from the in-memory buffer.
       * Intended for testing / manual reset in devtools — not for production use.
       */
      clear: _clearEventBuffer,

      /**
       * Returns a quick overview of session health.
       * Useful for a fast sanity check without reading the full timeline.
       *
       * @example window.__obs.getSummary()
       * // → { total: 42, errors: 3, apiCalls: 18, traces: 5 }
       */
      getSummary: () => {
        const events = getEventBuffer();
        return {
          total:    events.length,
          errors:   events.filter((e) => e.level === 'error').length,
          apiCalls: events.filter((e) => e.type  === 'api').length,
          // Set size = number of distinct traceIds (undefined counts as one slot — filter it out)
          traces:   new Set(events.map((e) => e.traceId).filter(Boolean)).size,
        };
      },
    };
  } catch { /* ignore CSP / environment restrictions */ }
}
