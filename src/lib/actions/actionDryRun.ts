/**
 * @file lib/actions/actionDryRun.ts
 * @description Dry-run mode support for the alert dispatch pipeline.
 *
 * PURPOSE:
 *   When ACTION_MODE=dry-run, the dispatcher skips all channel delivery
 *   (no HTTP calls, no Slack/email/webhook side effects) while still
 *   executing the full policy/dedup/rate-limit pipeline and logging
 *   analytics events. This enables safe simulation and smoke testing.
 *
 * DESIGN:
 *   - Single env flag: `ACTION_MODE === 'dry-run'`
 *   - Evaluated ONCE at module load time — no per-call overhead.
 *   - The isDryRun export is the only runtime check needed in the dispatcher.
 *   - trackDryRunEvent() wraps the analytics call so the dispatcher stays clean.
 *
 * INTEGRATION (in alertDispatcher.ts _deliverToChannel, BEFORE withRetry call):
 *
 *   import { isDryRun, trackDryRunEvent } from '@/lib/actions/actionDryRun';
 *
 *   async function _deliverToChannel(alert, channel, meta) {
 *     // ── Dry-run gate ────────────────────────────────────────────────────
 *     if (isDryRun) {
 *       trackDryRunEvent(alert, channel.name);
 *       return; // No handler execution. Audit + analytics still fire above.
 *     }
 *
 *     // ... existing withRetry + channel delivery ...
 *   }
 *
 * GUARANTEES:
 *   - isDryRun is a plain boolean — zero overhead in production.
 *   - trackDryRunEvent() NEVER throws.
 *   - No modification to Alert, Insight, dispatcher, or channel state.
 *   - Deterministic: same env → same isDryRun value.
 *   - No randomness.
 *
 * RULES:
 *   - Additive only — no existing files modified.
 *   - No imports from React, hooks, UI, or pages.
 */

import { trackEvent } from '@/lib/analytics';
import type { Alert }  from '@/lib/alerts';

// ─────────────────────────────────────────────────────────────────────────────
// DRY-RUN FLAG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * True when ACTION_MODE environment variable is set to 'dry-run'.
 *
 * Evaluated once at module load — no runtime cost per dispatch call.
 * Falsy in all other configurations (undefined, 'live', etc.).
 *
 * Usage:
 *   if (isDryRun) { trackDryRunEvent(...); return; }
 */
export const isDryRun: boolean =
  process.env.ACTION_MODE === 'dry-run';

// ─────────────────────────────────────────────────────────────────────────────
// DRY-RUN ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Emit an analytics event for a dry-run dispatch.
 *
 * Fired instead of (not in addition to) the real channel delivery.
 * Gives operators full observability into what WOULD have been dispatched
 * without any actual side effects.
 *
 * Event schema:
 *   event:   'action.dry_run'
 *   channel: The channel that would have received the alert.
 *   alertId: The alert rule ID.
 *   metric:  The metric that triggered the alert.
 *   severity: The alert severity tier.
 *   firedAt: Original alert timestamp (ms).
 *   dryRunAt: Wall-clock time of the simulated dispatch.
 *
 * SAFETY:
 *   Wrapped in try/catch — analytics must never propagate into the dispatcher.
 *
 * @param alert   - The alert being simulated.
 * @param channel - The channel name that would have been called.
 */
export function trackDryRunEvent(
  alert:   Alert,
  channel: 'slack' | 'email' | 'webhook',
): void {
  try {
    trackEvent('action.dry_run' as never, {
      channel,
      alertId:   alert.id,
      metric:    alert.metric,
      severity:  alert.severity,
      firedAt:   alert.firedAt,
      dryRunAt:  Date.now(),
    } as never);

    if (process.env.NODE_ENV === 'development') {
      console.info(
        `[actionDryRun] DRY-RUN — would have sent to ${channel}: ` +
        `alert=${alert.id} metric=${alert.metric} severity=${alert.severity}`,
      );
    }
  } catch (err) {
    // Analytics failure in dry-run must not surface anywhere.
    if (process.env.NODE_ENV === 'development') {
      console.error('[actionDryRun] trackDryRunEvent failed — swallowed.', err);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DIAGNOSTICS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return the current dry-run mode label for logging / diagnostics.
 *
 * Returns 'dry-run' when active, 'live' otherwise.
 * Intended for startup logging or health-check endpoints.
 *
 * @example
 *   console.info(`[dispatcher] Action mode: ${getActionMode()}`);
 */
export function getActionMode(): 'dry-run' | 'live' {
  return isDryRun ? 'dry-run' : 'live';
}