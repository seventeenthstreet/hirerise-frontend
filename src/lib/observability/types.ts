/**
 * @file src/lib/observability/types.ts
 * @description Canonical event model for the Phase 3.5 observability layer.
 *
 * This file is intentionally import-free so it can be consumed anywhere in the
 * stack (API layer, hooks, UI, system) without creating circular dependencies.
 *
 * ARCHITECTURE POSITION: Foundation (imported by all observability modules)
 *   observability/types ← observability/context
 *                       ← observability/observability
 *                       ← observability/logger
 *                       ← observability/actions
 */

// ─────────────────────────────────────────────────────────────────────────────
// EVENT MODEL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The four event domains the observability layer covers.
 *
 *  ui     — user-initiated actions (clicks, submissions, navigation triggers)
 *  api    — request lifecycle (start / success / error)
 *  error  — error boundary triggers + silent window errors / unhandled rejections
 *  system — lifecycle / debug signals (mount, init, feature flag reads, etc.)
 */
export type ObservabilityEventType = 'ui' | 'api' | 'error' | 'system';

/**
 * Canonical event shape.
 *
 * All fields except the optional ones are always present after passing through
 * `createEvent()`. Consumers that receive a raw `ObservabilityEvent` from the
 * buffer can rely on `eventId`, `timestamp`, and `sessionId` always being set.
 */
export interface ObservabilityEvent {
  /** Globally unique identifier for this event (nanoid-style, 12 chars). */
  eventId: string;

  /** ISO-8601 timestamp at time of creation. */
  timestamp: string;

  /** Domain classifier. */
  type: ObservabilityEventType;

  /** Human-readable event name, e.g. "USER_ACTION", "API_REQUEST". */
  name: string;

  /**
   * Severity level.
   *  info  — normal operational events (requests, actions, navigations)
   *  warn  — degraded but non-fatal (retries, fallbacks, slow responses)
   *  error — failures requiring attention (API errors, boundary triggers, silent errors)
   */
  level: 'info' | 'warn' | 'error';

  /** Stable per-browser-session identifier (persisted in sessionStorage). */
  sessionId: string;

  /**
   * Per-user-action trace identifier.
   * Generated once per logical flow (click → API call → result) and threaded
   * through UI → Hook → API → Error so all events in the flow correlate.
   */
  traceId?: string;

  /**
   * Error boundary incident ID (Date.now() — matches errorId in ErrorBoundary).
   * Only present on error-type events that originate from an ErrorBoundary.
   */
  errorId?: number;

  /** Arbitrary key/value payload. Kept shallow for easy serialisation. */
  context?: Record<string, unknown>;
}

/**
 * Partial input accepted by `createEvent()`.
 * `eventId`, `timestamp`, and `sessionId` are auto-filled.
 */
export type ObservabilityEventInput = Omit<ObservabilityEvent, 'eventId' | 'timestamp' | 'sessionId'> & {
  sessionId?: string; // allowed override; auto-filled when absent
  level?: 'info' | 'warn' | 'error'; // defaults to 'info' in createEvent if omitted
};
