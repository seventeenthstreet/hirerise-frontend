/**
 * @file src/lib/observability/logger.ts
 * @description Vendor-agnostic logging adapter.
 *
 * The single public function — `logEvent(event)` — is the ONLY way events
 * should be emitted. It:
 *  1. Pushes the event into the in-memory buffer (for timeline reconstruction).
 *  2. Outputs a structured console entry (dev + prod).
 *
 * FUTURE INTEGRATIONS:
 *  To plug in Sentry, Datadog RUM, or a custom ingest endpoint, add a new
 *  section under "ADAPTERS" and call it from `logEvent`. The existing buffer
 *  push and console path must not be removed — they are the baseline guarantee.
 *
 * CONSOLE FORMAT:
 *  [OBS] <type>:<name> | session=<id> trace=<id>? error=<id>?
 *  The full event object follows in the collapsed group so devtools don't
 *  spam the console on every user click, but the data is always inspectable.
 *
 * ARCHITECTURE POSITION: Top of observability stack
 *   types → context → observability → [this file] → consumers
 */

import type { ObservabilityEvent } from './types';
import { pushEvent } from './observability';

// ─────────────────────────────────────────────────────────────────────────────
// CONSOLE ADAPTER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formats a single-line summary label for the console group header.
 * Kept narrow so it fits in collapsed devtools groups.
 *
 * Example:
 *   [OBS] api:API_REQUEST | session=s_3f8a1c9b42e7 trace=t_7b2c9f4e01
 */
function buildLabel(event: ObservabilityEvent): string {
  const parts: string[] = [
    `[OBS:${event.level.toUpperCase()}] ${event.type}:${event.name}`,
    `session=${event.sessionId.slice(0, 14)}`,
  ];
  if (event.traceId)  parts.push(`trace=${event.traceId}`);
  if (event.errorId)  parts.push(`error=${event.errorId}`);
  return parts.join(' | ');
}

function consoleAdapter(event: ObservabilityEvent): void {
  // Always log — observability is a production concern, not dev-only.
  // Use console.groupCollapsed so the output is inspectable but not intrusive.
  try {
    const label = buildLabel(event);

    // Route to the appropriate console method based on severity level.
    // console.info (not console.debug) for info events — debug is filtered out
    // by default in many browser devtools configurations, making info-level
    // observability events invisible without changing browser settings.
    const logFn =
      event.level === 'error' ? console.error :
      event.level === 'warn'  ? console.warn  :
      console.info;

    if (typeof console.groupCollapsed === 'function') {
      // Inside a collapsed group we always use console.log for the event
      // payload. Using console.error or console.warn here causes the Next.js
      // dev overlay to intercept the call and surface it as a "Console Error"
      // overlay, making every instrumented API error appear as an app crash.
      // The severity is already communicated by the label in the group header
      // (e.g. "[OBS:ERROR] api:API_ERROR | ...") so no information is lost.
      console.groupCollapsed(label);
      console.log(event);
      console.groupEnd();
    } else {
      // Fallback for environments that lack groupCollapsed (e.g. some CI runners).
      // Use the level-appropriate method here — no overlay risk in these envs.
      logFn(label, event);
    }
  } catch {
    // Never let logger errors surface to the application.
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTERS HOOK (future)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * External adapter registry.
 *
 * To add Sentry / Datadog / custom ingest:
 *  1. Create a function matching `(event: ObservabilityEvent) => void`.
 *  2. Push it into `_externalAdapters` during app initialisation:
 *       import { registerAdapter } from '@/lib/observability/logger';
 *       registerAdapter((ev) => Sentry.addBreadcrumb({ ...ev }));
 *
 * Adapters are called in registration order. A throwing adapter is silently
 * caught so it cannot disrupt the primary logging path.
 */
type LogAdapter = (event: ObservabilityEvent) => void;
const _externalAdapters: LogAdapter[] = [];

export function registerAdapter(adapter: LogAdapter): void {
  _externalAdapters.push(adapter);
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Emit a fully-formed observability event.
 *
 * Steps:
 *  1. Push into the in-memory ring buffer.
 *  2. Write a structured console entry (grouped, collapsible).
 *  3. Forward to any registered external adapters.
 *
 * This function never throws.
 */
export function logEvent(event: ObservabilityEvent): void {
  // 1. Buffer — always first so the event is available even if console throws.
  pushEvent(event);

  // 2. Console adapter.
  consoleAdapter(event);

  // 3. External adapters (Sentry, Datadog, etc.).
  for (const adapter of _externalAdapters) {
    try {
      adapter(event);
    } catch {
      // Silently ignore — a broken adapter must not crash the application.
    }
  }
}