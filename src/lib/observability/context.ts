/**
 * @file src/lib/observability/context.ts
 * @description Session and trace context management.
 *
 * Provides:
 *  - `getSessionId()`  — stable per-browser-session identifier (sessionStorage)
 *  - `createTraceId()` — per-user-action flow identifier
 *
 * Both IDs use a lightweight random generator that avoids any external imports.
 * The format is intentionally readable in console output: 8 hex chars for the
 * session prefix + random suffix.
 *
 * SESSION PERSISTENCE:
 *  sessionStorage is used (not localStorage) so the ID resets on tab close,
 *  matching the user's intuitive session boundary. It survives page reloads
 *  within the same tab, which is the correct scope for correlating events
 *  across navigations within a single user session.
 *
 *  SSR-safe: the sessionStorage read is guarded by a `typeof window` check so
 *  this file is safe to import in Next.js server components / middleware.
 *
 * ARCHITECTURE POSITION: Observability foundation
 *   observability/context ← observability/observability ← logger ← actions
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_STORAGE_KEY = '__obs_session_id__';

// ─────────────────────────────────────────────────────────────────────────────
// ID GENERATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a random hex string of `length` characters.
 * Uses crypto.getRandomValues when available (all modern browsers + Node 19+),
 * falls back to Math.random for environments that lack the Web Crypto API.
 */
function randomHex(length: number): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(Math.ceil(length / 2));
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, length);
  }
  // Fallback — Math.random is not cryptographically strong but is fine for
  // observability correlation IDs where collision resistance is not a
  // security requirement.
  return Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

/**
 * Generates a new session ID.
 * Format: "s_<12 hex chars>"
 * Example: "s_3f8a1c9b42e7"
 */
function generateSessionId(): string {
  return `s_${randomHex(12)}`;
}

/**
 * Generates a new trace ID.
 * Format: "t_<10 hex chars>"
 * Example: "t_7b2c9f4e01"
 */
function generateTraceId(): string {
  return `t_${randomHex(10)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION ID
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the stable session ID for the current browser tab.
 *
 * Behaviour:
 *  - First call: generates and persists a new ID in sessionStorage.
 *  - Subsequent calls (same tab): reads and returns the persisted ID.
 *  - After tab close: resets (sessionStorage is cleared by the browser).
 *  - SSR: returns a static placeholder — no sessionStorage in server context.
 */
export function getSessionId(): string {
  // SSR guard — sessionStorage does not exist server-side.
  if (typeof window === 'undefined') {
    return 'ssr_session';
  }

  try {
    const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;

    const newId = generateSessionId();
    sessionStorage.setItem(SESSION_STORAGE_KEY, newId);
    return newId;
  } catch {
    // sessionStorage blocked (private browsing edge cases, quota exceeded) —
    // generate a fresh ID for this call. Not ideal but never fatal.
    return generateSessionId();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TRACE ID
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new trace ID to mark the start of a user-initiated flow.
 *
 * Call this once per logical action (e.g. button click, form submission,
 * navigation trigger) and pass the returned ID through:
 *   UI (trackUserAction) → Hook (meta.traceId) → API → Error (if any)
 *
 * This allows the full event chain to be reconstructed by filtering the event
 * buffer on a single traceId.
 */
export function createTraceId(): string {
  return generateTraceId();
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE TRACE CONTEXT (trace continuity fallback)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Module-level active trace ID.
 * Set whenever trackUserAction() fires. Consumed by extractTraceId() as a
 * fallback when no explicit traceId is passed (e.g. background queries
 * triggered implicitly after a user action).
 *
 * Intentionally NOT persisted — cleared on page reload, which matches the
 * expectation that a reload breaks the current trace flow.
 */
let _activeTraceId: string | null = null;

/**
 * Sets the module-level active trace ID.
 * Called automatically by trackUserAction() — callers should not need this
 * directly unless implementing a custom action tracking flow.
 */
export function setActiveTraceId(traceId: string | null): void {
  _activeTraceId = traceId;
}

/**
 * Returns the current active trace ID, or null if none is set.
 * Used by extractTraceId() as a fallback so API events that fire after a
 * user action still carry the correct traceId even when not passed explicitly.
 */
export function getActiveTraceId(): string | null {
  return _activeTraceId;
}
