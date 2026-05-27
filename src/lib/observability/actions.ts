/**
 * @file src/lib/observability/actions.ts
 * @description UI action tracking helper.
 *
 * `trackUserAction()` is the entry point for the UI layer into the
 * observability system. Call it at the start of any user-initiated flow
 * (button click, form submission, navigation trigger) to:
 *  1. Generate a fresh traceId for the flow.
 *  2. Emit a `ui:USER_ACTION` event with the action name and optional context.
 *  3. Return the traceId so it can be threaded into hook meta / API calls.
 *
 * USAGE IN COMPONENTS:
 *
 *   import { trackUserAction } from '@/lib/observability/actions';
 *
 *   function handleUpload() {
 *     const traceId = trackUserAction('RESUME_UPLOAD_START', { fileType: 'pdf' });
 *     uploadResume({ file, meta: { traceId } });
 *   }
 *
 * ARCHITECTURE POSITION: UI layer hook into observability
 *   UI components → [trackUserAction] → logger → buffer
 *                              ↓
 *                     traceId flows into:
 *                       mutation meta → API events → error events
 */

import { createTraceId, setActiveTraceId } from './context';
import { createEvent } from './observability';
import { logEvent } from './logger';

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Records a user action and returns the traceId for flow correlation.
 *
 * @param name    - Descriptive action name in SCREAMING_SNAKE_CASE.
 *                  Examples: "RESUME_UPLOAD_START", "DIRECTION_SET", "DASHBOARD_REFRESH"
 * @param context - Optional key/value payload (page, component, relevant IDs).
 * @returns traceId — pass this into hook meta or API call options so all
 *          downstream events (API_REQUEST, API_SUCCESS/ERROR) share the same ID.
 *
 * @example
 *   const traceId = trackUserAction('ONBOARDING_STEP_SUBMIT', { step: 2 });
 *   submitStep({ stepData, meta: { traceId } });
 */
export function trackUserAction(
  name: string,
  context?: Record<string, unknown>,
): string {
  const traceId = createTraceId();
  // Trace continuity fallback — persist as the module-level active trace so
  // API calls that fire without an explicit traceId still correlate correctly.
  setActiveTraceId(traceId);
  // Trace leakage prevention: clear the active trace after the current
  // synchronous + microtask + async chain work completes. setTimeout(0)
  // covers deeper async chains (await-over-await) that queueMicrotask misses,
  // while still resetting before the next unrelated user action.
  setTimeout(() => {
    setActiveTraceId(null);
  }, 0);

  // Emit a system-level marker so the trace has an explicit start point in
  // the event timeline. Fires before the UI event so timeline order is
  // preserved: TRACE_START → USER_ACTION → downstream API events.
  logEvent(createEvent({
    type:  'system',
    name:  'TRACE_START',
    traceId,
    level: 'info',
    context: {
      source: 'trackUserAction',
      action: name,
    },
  }));

  const event = createEvent({
    type:    'ui',
    name:    'USER_ACTION',
    level:   'info',
    traceId,
    context: {
      action: name,
      ...context,
    },
  });

  logEvent(event);

  return traceId;
}

/**
 * Records a UI navigation trigger (page transition, tab switch, modal open).
 *
 * Separate from `trackUserAction` so navigation events can be filtered
 * independently in timeline reconstruction.
 *
 * @param to      - Destination route or view name.
 * @param context - Optional additional context.
 * @returns traceId for the navigation flow.
 */
export function trackNavigation(
  to: string,
  context?: Record<string, unknown>,
): string {
  const traceId = createTraceId();

  const event = createEvent({
    type:    'ui',
    name:    'NAVIGATION',
    level:   'info',
    traceId,
    context: {
      to,
      ...context,
    },
  });

  logEvent(event);

  return traceId;
}