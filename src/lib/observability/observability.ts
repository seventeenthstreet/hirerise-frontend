/**
 * @file src/lib/observability/observability.ts
 * @description In-memory circular event buffer and event factory.
 *
 * This is the storage backbone of the observability layer. It is intentionally
 * minimal: no persistence, no network calls, no subscriptions. It is a pure
 * write/read buffer that other modules build on top of.
 *
 * BUFFER DESIGN:
 *  - Fixed capacity (MAX_BUFFER_SIZE = 100).
 *  - When full, the oldest event is silently dropped (circular / ring buffer).
 *  - `getEventBuffer()` returns a snapshot copy — safe for external inspection
 *    without risk of callers mutating internal state.
 *
 * FACTORY DESIGN:
 *  `createEvent()` accepts a partial event and auto-fills:
 *  - eventId   → lightweight unique ID (timestamp + random suffix)
 *  - timestamp → ISO-8601 string
 *  - sessionId → via getSessionId()
 *
 * ARCHITECTURE POSITION: Observability core
 *   observability/context → [this file] → observability/logger → consumers
 *
 * DEBUG ACCESS:
 *  In a browser devtools console:
 *    import { getEventBuffer } from '@/lib/observability/observability';
 *    console.table(getEventBuffer());
 *  Or via the window-level debug handle (set by initSilentErrorCapture):
 *    window.__obs?.getEventBuffer()
 */

import type { ObservabilityEvent, ObservabilityEventInput } from './types';
import { getSessionId } from './context';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum number of events retained in the in-memory buffer. */
const MAX_BUFFER_SIZE = 100;

// ─────────────────────────────────────────────────────────────────────────────
// BUFFER
// ─────────────────────────────────────────────────────────────────────────────

/** Internal ring buffer — never exposed directly. */
const _buffer: ObservabilityEvent[] = [];

/**
 * Rolling window of recent error signatures for deduplication.
 * Suppresses repeated identical errors (same name + message) within a small
 * window, not just consecutive ones. Only applies to error-type events —
 * all other events are always stored. Distinct errors are never suppressed.
 */
let recentErrorSignatures: string[] = [];
const MAX_RECENT_ERRORS = 5;

/**
 * Pushes a fully-formed event into the ring buffer.
 * If the buffer is at capacity the oldest event is evicted (shift).
 *
 * This function is intentionally synchronous and never throws.
 */
export function pushEvent(event: ObservabilityEvent): void {
  // Deduplication: skip error events whose signature already appears in the
  // recent window. Covers repeated errors across async boundaries, not just
  // consecutive ones. Non-error events are never affected.
  if (event.type === 'error') {
    const message =
      event.context?.message ??
      event.context?.errorMessage ??
      '';
    const signature = `${event.name}-${message}`;

    if (recentErrorSignatures.includes(signature)) return;

    recentErrorSignatures.push(signature);

    if (recentErrorSignatures.length > MAX_RECENT_ERRORS) {
      recentErrorSignatures.shift();
    }
  }

  if (_buffer.length >= MAX_BUFFER_SIZE) {
    _buffer.shift();
  }
  _buffer.push(event);
}

/**
 * Returns a shallow copy of the current event buffer, ordered oldest-first.
 *
 * The copy ensures callers cannot mutate internal state. Suitable for:
 *  - Debug inspection in devtools
 *  - Flushing to an external service on page unload
 *  - Timeline reconstruction in error reporting
 */
export function getEventBuffer(): ReadonlyArray<ObservabilityEvent> {
  return [..._buffer];
}

/**
 * Clears all events from the buffer.
 * Intended for testing only — not for production use.
 */
export function _clearEventBuffer(): void {
  _buffer.length = 0;
  recentErrorSignatures = [];
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENT FACTORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a lightweight unique event ID.
 *
 * Format: "<base36 timestamp>_<4 random hex chars>"
 * Example: "lkv3f8_a2c9"
 *
 * Not globally collision-proof (unlike UUID v4) but sufficient for a
 * per-session event stream where IDs serve as display handles, not
 * primary keys in a distributed system.
 */
function generateEventId(): string {
  const ts  = Date.now().toString(36);
  const rnd = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
  return `${ts}_${rnd}`;
}

/**
 * Creates a fully-formed `ObservabilityEvent` from a partial input.
 *
 * Auto-filled fields:
 *  - `eventId`   — unique ID (see generateEventId)
 *  - `timestamp` — ISO-8601 string (Date.now())
 *  - `sessionId` — from getSessionId() unless caller provides one
 *
 * The returned event is NOT automatically pushed to the buffer — callers must
 * call `pushEvent(event)` or use `logEvent()` which does both.
 */
export function createEvent(input: ObservabilityEventInput): ObservabilityEvent {
  return {
    eventId:   generateEventId(),
    timestamp: new Date().toISOString(),
    sessionId: input.sessionId ?? getSessionId(),
    type:      input.type,
    name:      input.name,
    // Default to 'info' — callers that omit level get a safe default.
    level:     input.level ?? 'info',
    ...(input.traceId  !== undefined && { traceId:  input.traceId }),
    ...(input.errorId  !== undefined && { errorId:  input.errorId }),
    ...(input.context  !== undefined && { context:  input.context }),
  };
}