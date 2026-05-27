/**
 * @file lib/actions/utils/safeTrack.ts
 * @description Fire-and-forget analytics wrapper for the action pipeline.
 *
 * PURPOSE:
 *   Every analytics call inside actionPolicy, actionAudit, and actionDryRun
 *   must be incapable of throwing. A misconfigured analytics provider, a
 *   missing window object, or a bad payload must NEVER propagate into the
 *   dispatch pipeline and suppress a real alert delivery.
 *
 *   safeTrack() is the single place that enforces this contract. All action
 *   pipeline modules import from here instead of calling trackEvent() directly.
 *
 * GUARANTEES:
 *   - NEVER throws — all errors are swallowed.
 *   - No return value — callers cannot branch on success/failure.
 *   - Zero async — synchronous call, synchronous return.
 *   - No impact on hot path when analytics.ts dispatch() is a no-op.
 *
 * RULES:
 *   - Additive only — does not modify analytics.ts or any existing file.
 *   - No imports from React, hooks, UI, or pages.
 *   - No randomness.
 *   - Do NOT use safeTrack for UI-layer analytics — use trackEvent() directly
 *     there so type-safety errors surface at compile time.
 *
 * USAGE:
 *   import { safeTrack } from '@/lib/actions/utils/safeTrack';
 *
 *   safeTrack('action.policy.blocked', {
 *     action_id:   alert.id,
 *     action_type: alert.id,
 *     metric:      alert.metric,
 *     reason:      'rapid_repeat',
 *   });
 *
 * WHY NOT trackEvent() DIRECTLY?
 *   trackEvent<K>(name: K, props: EventMap[K]) is typed against EventMap.
 *   New action-pipeline event names ('action.policy.blocked', 'action.audit.*')
 *   must be added to EventMap to pass the compiler, which is the correct
 *   long-term path. In the interim, safeTrack() accepts `string` event names
 *   and `Record<string, unknown>` payloads, providing a safe escape hatch that
 *   does NOT loosen the type contract for UI-layer events.
 *
 *   Once 'action.policy.blocked' is added to EventMap, callers can migrate
 *   to trackEvent() — safeTrack() remains available for future additions.
 */

import { trackEvent } from '@/lib/analytics';

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safely emit an analytics event from within the action dispatch pipeline.
 *
 * Accepts any string event name and any serialisable payload. Uses a type
 * assertion to bypass EventMap enforcement — intentional for action-pipeline
 * internal events that are not yet registered in EventMap.
 *
 * SAFETY: Wrapped in try/catch. Any error (provider unavailable, SSR, bad
 * payload) is swallowed. In development, the error is logged to console so
 * engineers can diagnose misconfiguration without breaking tests.
 *
 * @param event   - The analytics event name. Use namespaced strings:
 *                  'action.policy.blocked', 'action.audit.recorded', etc.
 * @param payload - Arbitrary key/value context for this event. Keep keys
 *                  snake_cased and values serialisable (string | number | boolean).
 */
export function safeTrack(
  event:   string,
  payload: Record<string, unknown>,
): void {
  try {
    // Type assertion: action-pipeline events use string names not yet in
    // EventMap. This is the only place this cast exists — UI-layer code
    // continues to use the fully-typed trackEvent() directly.
    (trackEvent as (name: string, props: Record<string, unknown>) => void)(
      event,
      payload,
    );
  } catch {
    // Swallow all errors — analytics must never affect delivery.
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[safeTrack] Failed to emit event "${event}" — swallowed.`);
    }
  }
}