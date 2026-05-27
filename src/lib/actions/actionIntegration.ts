/**
 * @file lib/actions/actionIntegration.ts
 * @description Integration reference: shows exactly how to wire the four
 *   micro-gap fixes into alertDispatcher.ts.
 *
 * ⚠️  THIS FILE IS NOT A REPLACEMENT FOR alertDispatcher.ts.
 *
 * It is an authoritative annotation document that shows:
 *   1. Where each new import goes in alertDispatcher.ts.
 *   2. The exact insertion points for each new layer.
 *   3. The complete updated _deliverToChannel and dispatchAlerts snippets.
 *
 * Copy only the labelled diff-hunks into alertDispatcher.ts.
 * All existing behaviour is preserved — every addition is strictly additive.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FINAL PIPELINE ORDER (after integration):
 *
 *   evaluateAlerts()                     — alert engine (unchanged)
 *        ↓
 *   shouldSuppressAlerts / policy gate   — batch suppression (unchanged)
 *        ↓
 *   filterAlertsForBurst                 — burst control (unchanged)
 *        ↓
 *   shouldExecuteAction()   ← NEW        — execution policy (actionPolicy.ts)
 *        ↓
 *   isDuplicate()                        — dedup (unchanged)
 *        ↓
 *   isRateLimited()                      — rate limiter (unchanged)
 *        ↓
 *   isDryRun check          ← NEW        — dry-run gate (actionDryRun.ts)
 *        ↓
 *   withRetry(channel.deliver)           — channel delivery with retry (unchanged)
 *        ↓
 *   recordAction()          ← NEW        — audit log (actionAudit.ts)
 *        ↓
 *   trackEvent('alert.delivery.*')       — analytics (unchanged)
 *
 * Idempotency keys are injected INSIDE the channel deliver functions
 * (slack.ts, email.ts, webhook.ts) at the fetch() call-site.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * GUARANTEES (all preserved):
 *   - dispatchAlerts() NEVER throws.
 *   - No change to Alert or Insight required fields.
 *   - No modification to alert or insight evaluation logic.
 *   - Retry behaviour is unchanged.
 *   - All new layers fall back safely (try/catch → allow/no-op).
 */

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — ADD IMPORTS (top of alertDispatcher.ts, after existing imports)
// ─────────────────────────────────────────────────────────────────────────────

/*
  // ── Micro-gap fixes ────────────────────────────────────────────────────────
  import { shouldExecuteAction }          from '@/lib/actions/actionPolicy';
  import { recordAction }                 from '@/lib/actions/actionAudit';
  import { isDryRun, trackDryRunEvent }   from '@/lib/actions/actionDryRun';
*/

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — UPDATED _deliverToChannel (replace in alertDispatcher.ts)
//
// Changes marked with ← NEW
// Everything else is UNCHANGED from the original.
// ─────────────────────────────────────────────────────────────────────────────

/*
async function _deliverToChannel(
  alert:   Alert,
  channel: typeof CHANNELS[number],
  meta:    MetricsMeta,
): Promise<void> {

  // ── Dry-run gate  ← NEW ─────────────────────────────────────────────────
  // When ACTION_MODE=dry-run: log analytics, skip all handler execution.
  // Audit log is NOT written (no real delivery occurred).
  // Policy + dedup + rate-limit ran above — the simulation is faithful.
  if (isDryRun) {
    trackDryRunEvent(alert, channel.name);
    return;
  }

  // ── Channel delivery (unchanged) ─────────────────────────────────────────
  const result = await withRetry(
    () => channel.deliver(alert),
    { label: `${channel.name}:${alert.id}` },
  );

  // ── Audit log  ← NEW ────────────────────────────────────────────────────
  // Record outcome AFTER withRetry resolves — captures final status + attempts.
  // Wrapped internally in try/catch — never propagates.
  recordAction({
    alertId:   alert.id,
    type:      alert.id,
    target:    alert.metric,
    channel:   channel.name,
    status:    result.success ? 'success' : 'failed',
    timestamp: Date.now(),
    attempts:  result.attempts,
  });

  if (result.success) {
    // ── Delivery success tracking (unchanged, rate-sampled) ───────────────
    if (Math.random() < getSuccessSampleRate(alert, meta)) {
      try {
        trackEvent('alert.delivery.success' as never, {
          channel:   channel.name,
          alertId:   alert.id,
          alertType: alert.id,
          severity:  alert.severity,
          metric:    alert.metric,
          attempts:  result.attempts,
        } as never);
      } catch { }
    }
    return;
  }

  // ── Delivery failed (unchanged) ───────────────────────────────────────────
  try {
    trackEvent('alert.delivery.failed' as never, {
      channel:   channel.name,
      alertId:   alert.id,
      severity:  alert.severity,
      metric:    alert.metric,
      attempts:  result.attempts,
      error:     String(result.error),
    } as never);
  } catch { }

  if (process.env.NODE_ENV === 'development') {
    console.error(
      `[alertDispatcher] Delivery failed: channel=${channel.name} ` +
      `alert=${alert.id} attempts=${result.attempts}`,
      result.error,
    );
  }
}
*/

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — UPDATED per-alert dispatch loop (inside dispatchAlerts)
//
// Insert the shouldExecuteAction() call AFTER recordBurstWindow()
// and BEFORE isDuplicate(). All surrounding code is UNCHANGED.
// ─────────────────────────────────────────────────────────────────────────────

/*
  for (const alert of alertsToDispatch) {

    // ── Gate: Execution policy  ← NEW ──────────────────────────────────────
    // Runs BEFORE dedup so blocked actions don't consume dedup slots.
    // On false: silently skips this alert — no channel, no dedup, no audit.
    if (!shouldExecuteAction(alert)) {
      if (process.env.NODE_ENV === 'development') {
        console.debug(
          `[alertDispatcher] Policy blocked: alert=${alert.id} ` +
          `metric=${alert.metric}`,
        );
      }
      continue;
    }

    // ── Gate 3: Deduplication (unchanged) ─────────────────────────────────
    if (isDuplicate(alert)) {
      // ... existing dedup logging ...
      continue;
    }

    // ── Per-channel delivery (unchanged) ──────────────────────────────────
    for (const channel of CHANNELS) {
      if (isRateLimited(channel.name)) {
        // ... existing rate-limit handling ...
        continue;
      }
      alertDeliveryPromises.push(
        _deliverToChannel(alert, channel, meta),
      );
    }
  }
*/

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — IDEMPOTENCY KEYS IN CHANNEL HANDLERS
//
// Add to the fetch() headers in: slack.ts, email.ts, webhook.ts
// No signature change. No new imports. One line per channel.
// ─────────────────────────────────────────────────────────────────────────────

/*
  // slack.ts — inside sendSlackAlert():
  const response = await fetch(webhookUrl, {
    method:  'POST',
    headers: {
      'Content-Type':    'application/json',
      'Idempotency-Key': alert.id,             // ← NEW
    },
    body: JSON.stringify(payload),
  });

  // webhook.ts — inside sendWebhookAlert():
  const headers: Record<string, string> = {
    'Content-Type':    'application/json',
    'User-Agent':      'HireRise-AlertDispatcher/1.0',
    'Idempotency-Key': alert.id,               // ← NEW
  };

  // email.ts — inside sendEmailAlert():
  const response = await fetch(apiUrl, {
    method:  'POST',
    headers: {
      'Content-Type':    'application/json',
      'Idempotency-Key': alert.id,             // ← NEW
    },
    body: JSON.stringify(payload),
  });
*/

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5 — OPTIONAL STARTUP LOG (in metricsAdapter.ts or app bootstrap)
// ─────────────────────────────────────────────────────────────────────────────

/*
  import { getActionMode } from '@/lib/actions/actionDryRun';

  if (process.env.NODE_ENV === 'development') {
    console.info(`[dispatcher] Action mode: ${getActionMode()}`);
  }
*/

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED TYPES — re-exported for consumers who want a single import
// ─────────────────────────────────────────────────────────────────────────────

export type { ActionLogEntry }    from './actionAudit';
export type { ActionPolicyMeta }  from './actionPolicy';

export {
  // Policy
  shouldExecuteAction,
  flushActionPolicy,
  actionPolicySize,
  criticalBurstCount,
} from './actionPolicy';

export {
  // Audit
  recordAction,
  getRecentActions,
  getActionsForAlert,
  getAuditSummary,
  flushAuditLog,
  auditLogSize,
} from './actionAudit';

export {
  // Dry-run
  isDryRun,
  trackDryRunEvent,
  getActionMode,
} from './actionDryRun';