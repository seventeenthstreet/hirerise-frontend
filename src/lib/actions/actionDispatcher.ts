/**
 * @file lib/actions/actionDispatcher.ts
 * @description Action delivery orchestration layer.
 *
 * POSITION IN THE PIPELINE:
 *
 *   Insight Engine → ActionEngine → ActionRules
 *           ↓
 *   Action Dispatcher  ← YOU ARE HERE
 *           ↓
 *   Dedup (actionDedupStore.ts) + Rate Limiter (actionRateLimiter.ts)
 *           ↓
 *   Handler (withRetry + jitter)
 *           ↓
 *   Slack / Webhook / Internal
 *
 * RESPONSIBILITIES:
 *   1. Accept an Action[] and MetricsMeta.
 *   2. Gate on shouldSuppressAlerts(meta) — suppress all actions in mock mode.
 *   3. For each action: run dedup → run rate limiting → call handler with retry.
 *   4. Track outcomes via analytics: 'action.executed' / 'action.failed'.
 *   5. Be fire-and-forget: caller uses `void dispatchActions(...)`.
 *
 * HANDLER REGISTRY:
 *   type → channel → handler function
 *   'notify'  → 'slack'    → handleSlackAction
 *   'webhook' → 'webhook'  → handleWebhookAction
 *   'scale'   → 'internal' → handleInternalAction
 *   'restart' → 'internal' → handleInternalAction
 *
 * GUARANTEES:
 *   - dispatchActions() NEVER throws.
 *   - Failures are isolated per-action; one failure cannot affect others.
 *   - All ops are fire-and-forget; never blocks the insight pipeline.
 *   - Actions are optional — system functions identically without them.
 *
 * SCOPE:
 *   Internal — consumed only by actionEngine.ts.
 *   Must NOT be imported by hooks, UI, or pages.
 */

import type { Action, ActionChannel, ActionResult } from './types';
import type { MetricsMeta }     from '@/types/internal/mappedMetrics';

import { shouldSuppressAlerts } from '@/lib/integrations/metaHelpers';
import { withRetry }            from '@/lib/utils/retry';
import { trackEvent }           from '@/lib/analytics';
import { isDevelopment }        from '@/lib/utils/env';

import { isActionDuplicate }    from './actionDedupStore';
import { isActionRateLimited }  from './actionRateLimiter';

import { handleSlackAction }    from './handlers/slackAction';
import { handleWebhookAction }  from './handlers/webhookAction';
import { handleInternalAction } from './handlers/internalAction';

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps each action type to its delivery channel and handler function.
 *
 * 'channel' drives rate limiting (one counter per channel per window).
 * 'handler' is the async function that makes the outbound call.
 *
 * Adding a new action type requires only a new entry here — no changes
 * to the dispatcher loop.
 */
const ACTION_HANDLERS: Array<{
  types:   Action['type'][];
  channel: ActionChannel;
  handler: (action: Action) => Promise<void>;
}> = [
  {
    types:   ['notify'],
    channel: 'slack',
    handler: handleSlackAction,
  },
  {
    types:   ['webhook'],
    channel: 'webhook',
    handler: handleWebhookAction,
  },
  {
    types:   ['scale', 'restart'],
    channel: 'internal',
    handler: handleInternalAction,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL — SINGLE ACTION DISPATCH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dispatch a single action through its registered handler with retry.
 *
 * @internal
 */
async function _dispatchOne(action: Action, nowMs: number): Promise<ActionResult> {
  // Find the registered handler for this action type.
  const registration = ACTION_HANDLERS.find(r => r.types.includes(action.type));

  if (!registration) {
    if (isDevelopment) {
      console.warn(`[actionDispatcher] No handler registered for type: ${action.type}`);
    }
    return { action, success: false, attempts: 0, error: 'no_handler' };
  }

  const { channel, handler } = registration;

  // ── Gate 1: Deduplication ─────────────────────────────────────────────────
  if (isActionDuplicate(action, nowMs)) {
    if (isDevelopment) {
      console.debug(
        `[actionDispatcher] Dedup suppressed: action=${action.id} severity=${action.severity}`,
      );
    }
    return { action, success: false, attempts: 0, error: 'dedup' };
  }

  // ── Gate 2: Rate limiting ─────────────────────────────────────────────────
  if (isActionRateLimited(channel, nowMs)) {
    if (isDevelopment) {
      console.warn(
        `[actionDispatcher] Rate limit reached for channel=${channel} — dropping action=${action.id}`,
      );
    }

    try {
      trackEvent('action.failed', {
        action_id:   action.id,
        action_type: action.type,
        target:      action.target,
        severity:    action.severity,
        reason:      'rate_limited',
      });
    } catch { /* analytics must never throw */ }

    return { action, success: false, attempts: 0, error: 'rate_limited' };
  }

  // ── Gate 3: Delivery with retry ───────────────────────────────────────────
  const result = await withRetry(
    () => handler(action),
    { label: `action:${action.type}:${action.target}` },
  );

  if (result.success) {
    try {
      trackEvent('action.executed', {
        action_id:   action.id,
        action_type: action.type,
        target:      action.target,
        severity:    action.severity,
        attempts:    result.attempts,
      });
    } catch { /* analytics must never throw */ }

    return { action, success: true, attempts: result.attempts };
  }

  // Exhausted retries
  try {
    trackEvent('action.failed', {
      action_id:   action.id,
      action_type: action.type,
      target:      action.target,
      severity:    action.severity,
      reason:      'retry_exhausted',
    });
  } catch { /* analytics must never throw */ }

  if (isDevelopment) {
    console.error(
      `[actionDispatcher] Retry exhausted for action=${action.id} after ${result.attempts} attempt(s).`,
      result.error,
    );
  }

  return { action, success: false, attempts: result.attempts, error: result.error };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dispatch an array of actions through the full safety pipeline.
 *
 * Pipeline per action:
 *   suppression check → dedup → rate limit → withRetry(handler)
 *
 * All actions are dispatched concurrently (Promise.allSettled) — one failure
 * cannot delay or cancel any other.
 *
 * NEVER throws — any internal error is caught and swallowed.
 * Returns Promise<void> — always called with `void` by the engine.
 *
 * @param actions - Actions from actionRules.mapInsightsToActions()
 * @param meta    - Pipeline metadata; used for suppression gate
 */
export async function dispatchActions(
  actions: Action[],
  meta:    MetricsMeta,
): Promise<void> {
  try {
    if (actions.length === 0) return;

    // ── Global gate: mock mode / suppression ──────────────────────────────
    if (shouldSuppressAlerts(meta)) {
      if (isDevelopment) {
        console.debug(
          `[actionDispatcher] Suppressing ${actions.length} action(s): mock mode.`,
        );
      }
      return;
    }

    const nowMs = Date.now();

    // Dispatch all actions concurrently — failures are isolated per-action.
    await Promise.allSettled(
      actions.map(action => _dispatchOne(action, nowMs)),
    );
  } catch {
    // Absolute safety net — the dispatcher must never propagate throws.
  }
}