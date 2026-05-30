/**
 * @file lib/alertDispatcher.ts
 * @description Alert delivery orchestration layer.
 *
 * POSITION IN THE PIPELINE:
 *
 *   Alert Engine (/lib/alerts.ts → evaluateAlerts())
 *           ↓
 *   Alert Dispatcher  ← YOU ARE HERE
 *           ↓
 *   Burst Control (alertBurstControl.ts)   ← NEW — group-level gate
 *           ↓
 *   Dedup (alertDedup.ts) + Rate Limiter (alertRateLimiter.ts)
 *           ↓
 *   Channel Delivery (with retry + jitter)
 *           ↓
 *   Slack / Email / Webhook
 *
 * RESPONSIBILITIES:
 *   1. Accept an Alert[] and the current _meta.
 *   2. Gate on shouldSuppressAlerts(meta) and alert_policy — skip the entire
 *      batch in mock mode or when policy is 'suppress'.
 *   3. Apply burst control — filter low-priority alerts when the group window
 *      is saturated. Critical alerts are never filtered.
 *   4. For each alert: run dedup → run rate limiting → dispatch to all channels.
 *   5. Wrap each channel call in withRetry() for resilience (with jitter).
 *   6. Track delivery outcomes via analytics:
 *        alert.delivery.failed  — on exhausted retries or rate-limit drop.
 *        alert.delivery.success — on confirmed channel delivery.  ← NEW
 *   7. Be fire-and-forget: the caller does NOT await delivery.
 *
 * GUARANTEES:
 *   - dispatchAlerts() NEVER throws.
 *   - Delivery failures are isolated and logged; they cannot affect metrics or UI.
 *   - The function returns a Promise<void> — safe to call with `void` prefix.
 *   - Burst control never suppresses 'critical' severity alerts.
 *   - Success tracking is fully wrapped in try/catch — analytics cannot throw.
 *
 * SCOPE:
 *   Internal — consumed only by the metrics adapter or integration layer.
 *   Must NOT be imported by hooks, UI, or pages.
 *
 * HOW TO TRIGGER (integration example — see bottom of file):
 *
 *   // Inside metricsAdapter.ts, AFTER data is resolved and BEFORE _meta is stripped:
 *   void dispatchAlerts(evaluatedAlerts, mappedMetrics._meta);
 *   // ^^ void = fire-and-forget; never blocks render.
 */

import type { Alert }      from '@/lib/alerts';
import type { MetricsMeta } from '@/types/internal/mappedMetrics';

import {
  shouldSuppressAlerts,
  getAlertPolicy,
}                           from '@/lib/integrations/metaHelpers';
import { isDuplicate }      from '@/lib/alertDedup';
import { isRateLimited }    from '@/lib/alertRateLimiter';
import {
  shouldThrottleGroup,
  filterAlertsForBurst,
  recordBurstWindow,
  getBurstScope,
}                           from '@/lib/alertBurstControl';
import { withRetry }        from '@/lib/utils/retry';
import { sendSlackAlert }   from '@/lib/channels/slack';
import { sendEmailAlert }   from '@/lib/channels/email';
import { sendWebhookAlert } from '@/lib/channels/webhook';
import { trackEvent }       from '@/lib/analytics';

// ── Micro-gap fixes (additive — no existing behaviour changed) ────────────────
import { shouldExecuteAction }        from '@/lib/actions/actionPolicy';
import { recordAction }               from '@/lib/actions/actionAudit';
import { isDryRun, trackDryRunEvent } from '@/lib/actions/actionDryRun';

// ─────────────────────────────────────────────────────────────────────────────
// CHANNEL REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registered delivery channels.
 *
 * Each entry maps a channel name (used for rate limiting + logging) to its
 * delivery function. Adding a new channel requires only a new entry here.
 * The dispatcher loop handles the rest.
 *
 * Channel functions must:
 *   - Accept an Alert.
 *   - Return Promise<void>.
 *   - Throw on failure (withRetry catches and classifies).
 *   - Be no-ops when their env var is absent (safe for unconfigured environments).
 */
const CHANNELS: Array<{
  name:    'slack' | 'email' | 'webhook';
  deliver: (alert: Alert) => Promise<void>;
}> = [
  { name: 'slack',   deliver: sendSlackAlert   },
  { name: 'email',   deliver: sendEmailAlert   },
  { name: 'webhook', deliver: sendWebhookAlert },
];

// ─────────────────────────────────────────────────────────────────────────────
// SUCCESS SAMPLING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base sampling rates by severity.
 *
 * Critical is pinned to 1.0 (always track) — these events feed incident
 * timelines and SLA reporting where gaps are unacceptable.
 *
 * Non-critical rates are intentionally low to reduce analytics event volume
 * while retaining statistically representative aggregate signal. A 20% sample
 * of high-frequency non-critical deliveries is sufficient for trend dashboards.
 *
 * These values are the floor; getSuccessSampleRate() may adjust them upward
 * based on runtime meta context (e.g. partial-data mode).
 */
const BASE_SAMPLE_RATES: Record<string, number> = {
  critical: 1.0,
  high:     0.2,
  medium:   0.2,
  low:      0.2,
};

/**
 * Compute the success-event sampling rate for a delivered alert.
 *
 * Returns a value in [0.0, 1.0]:
 *   1.0 → always emit alert.delivery.success
 *   0.0 → never emit
 *   0.2 → emit ~20% of the time (default non-critical)
 *
 * FUTURE TUNING HOOKS (no behaviour change today):
 *   meta.partial === true  → raise non-critical rate to 1.0 so degraded-data
 *                            delivery windows are fully observable.
 *   meta.mode === 'mock'   → suppress all tracking (mock alerts are synthetic).
 *   tenant / env fields    → per-tenant rate overrides when MetricsMeta carries them.
 *
 * RULES:
 *   - Does NOT affect delivery logic — purely an observability gate.
 *   - Critical alerts are always 1.0 regardless of meta state.
 *   - Wrapped in a try/catch at the call-site; this function itself is pure
 *     and cannot throw (no I/O, no external calls).
 *
 * @param alert - The alert that was successfully delivered.
 * @param meta  - The _meta object from the dispatch context (for future tuning).
 * @returns     Sampling rate in [0.0, 1.0].
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getSuccessSampleRate(alert: Alert, meta: MetricsMeta): number {
  // Critical: always fully sampled — no meta override can reduce this.
  if (alert.severity === 'critical') return 1.0;

  // Future hook: when operating in partial-data mode, raise non-critical rate
  // to 1.0 so we have complete delivery visibility during degraded windows.
  // Uncomment when the team is ready to consume the extra event volume:
  //
  //   if (meta.partial) return 1.0;

  // Future hook: suppress tracking entirely for mock-mode synthetic alerts.
  // (shouldSuppressAlerts already gates delivery before we reach this point,
  //  so this is a belt-and-suspenders defence for any future path changes):
  //
  //   if (meta.mode === 'mock') return 0.0;

  return BASE_SAMPLE_RATES[alert.severity] ?? 0.2;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deliver one alert to one channel, with retry (+ jitter) and failure isolation.
 *
 * All outcomes (success / retry-exhausted / non-retryable) are fully contained
 * here. Nothing propagates out of this function.
 *
 * SUCCESS TRACKING (sampled via getSuccessSampleRate):
 *   On confirmed delivery, conditionally fires alert.delivery.success.
 *   getSuccessSampleRate(alert, meta) returns a rate in [0, 1]; the call is
 *   gated behind Math.random() so critical alerts always track (rate=1.0) and
 *   non-critical alerts sample at 20% by default. meta is forwarded so future
 *   tuning hooks (partial mode, per-tenant overrides) can adjust the rate
 *   without changing call-sites.
 *
 * FAILURE TRACKING (unchanged):
 *   On retry exhaustion or non-retryable error, fires alert.delivery.failed.
 *
 * @internal
 */
async function _deliverToChannel(
  alert:   Alert,
  channel: typeof CHANNELS[number],
  meta:    MetricsMeta,
): Promise<void> {
  // ── Dry-run gate ──────────────────────────────────────────────────────────
  // When ACTION_MODE=dry-run: emit analytics event and return immediately.
  // No handler is called. Policy/dedup/rate-limit already ran above — the
  // simulation is faithful. Audit log is intentionally skipped (no real delivery).
  if (isDryRun) {
    trackDryRunEvent(alert, channel.name);
    return;
  }

  const result = await withRetry(
    () => channel.deliver(alert),
    { label: `${channel.name}:${alert.id}` },
  );

  if (result.success) {
    // ── Audit log — success ───────────────────────────────────────────────
    // Recorded AFTER withRetry resolves so attempts count is final.
    // recordAction() is internally try/catch — never propagates.
    recordAction({
      alertId:   alert.id,
      type:      alert.id,
      target:    alert.metric,
      channel:   channel.name,
      status:    'success',
      timestamp: Date.now(),
      attempts:  result.attempts,
    }, meta);

    // ── Delivery success tracking (rate-sampled) ──────────────────────────
    // getSuccessSampleRate() returns 1.0 for critical (always track) and 0.2
    // for all other severities (20% sample). It accepts meta so future hooks
    // (partial mode, mock suppression, tenant overrides) can adjust the rate
    // at a single point without touching delivery logic.
    //
    // Has NO effect on delivery — purely an observability gate.
    // Wrapped in try/catch: analytics must never propagate into the dispatcher.
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
      } catch {
        // analytics.track threw unexpectedly — swallow and continue.
      }
    }

    return;
  }

  // ── Delivery failed after all retry attempts ─────────────────────────────
  // ── Audit log — failure ───────────────────────────────────────────────────
  recordAction({
    alertId:   alert.id,
    type:      alert.id,
    target:    alert.metric,
    channel:   channel.name,
    status:    'failed',
    timestamp: Date.now(),
    attempts:  result.attempts,
  }, meta);

  // Log to analytics and move on. No throw. No UI side-effect.
  try {
    trackEvent('alert.delivery.failed' as never, {
      channel:   channel.name,
      alertId:   alert.id,
      severity:  alert.severity,
      metric:    alert.metric,
      attempts:  result.attempts,
      error:     String(result.error),
    } as never);
  } catch {
    // analytics.track itself cannot throw into the dispatcher.
    // If it does (unexpected), swallow and continue.
  }

  if (process.env.NODE_ENV === 'development') {
    console.error(
      `[alertDispatcher] Delivery failed: channel=${channel.name} ` +
      `alert=${alert.id} attempts=${result.attempts}`,
      result.error,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dispatch a batch of evaluated alerts to all configured delivery channels.
 *
 * CALL PATTERN (fire-and-forget):
 *   void dispatchAlerts(alerts, meta);
 *
 *   Do NOT await this function in render-critical paths. It is designed
 *   to run in the background and must not affect render timing.
 *
 * PIPELINE PER BATCH:
 *   1. Early exit on empty batch.
 *   2. Batch suppression check (shouldSuppressAlerts + alert_policy).
 *   3. Group burst control (shouldThrottleGroup → filterAlertsForBurst).   ← NEW
 *      Critical alerts always pass through; low-priority alerts are dropped
 *      when the window is saturated. recordBurstWindow() updates the counter.
 *   4. Per-alert deduplication (isDuplicate).
 *   5. Per-channel rate limiting (isRateLimited).
 *   6. Delivery with exponential-backoff retry + jitter (withRetry).        ← JITTER NEW
 *   7. Outcome logging via analytics (success + failed).                    ← SUCCESS NEW
 *
 * FAILURE MODEL:
 *   Every await is wrapped in try/catch. A failure in any single alert or
 *   channel does not prevent other alerts/channels from being attempted.
 *   The outer try/catch is a last-resort safety net for synchronous errors.
 *
 * @param alerts - Output of evaluateAlerts(). Empty array is a safe no-op.
 * @param meta   - The _meta object from the resolved MappedMetrics.
 *                 Used for suppression gating — never forwarded to channels.
 */
export async function dispatchAlerts(
  alerts: Alert[],
  meta:   MetricsMeta,
): Promise<void> {
  // ── Early exit: empty batch ──────────────────────────────────────────────
  if (alerts.length === 0) return;

  // ── Gate 1: Batch suppression (mock mode / alert policy) ─────────────────
  //
  // shouldSuppressAlerts guards against alert noise from synthetic/mock data.
  // getAlertPolicy provides the typed policy for forward-compatible gating.
  // Both must agree that delivery is appropriate before we process a single alert.
  if (shouldSuppressAlerts(meta)) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(
        `[alertDispatcher] Suppressing ${alerts.length} alert(s): ` +
        `shouldSuppressAlerts=true (mode=${meta.mode})`,
      );
    }
    return;
  }

  const policy = getAlertPolicy(meta);
  if (policy === 'suppress') {
    if (process.env.NODE_ENV === 'development') {
      console.debug(
        `[alertDispatcher] Suppressing ${alerts.length} alert(s): alert_policy=suppress`,
      );
    }
    return;
  }

  // ── Gate 2: Group burst control ───────────────────────────────────────────
  //
  // Scope key is derived from meta so future multi-tenant deployments can
  // isolate burst windows per tenant/env without any dispatcher changes.
  // In v1, getBurstScope() always returns 'global' — identical to before.
  const scopeKey = getBurstScope(meta);
  let alertsToDispatch: Alert[];

  if (shouldThrottleGroup(alerts.length, Date.now(), scopeKey)) {
    alertsToDispatch = filterAlertsForBurst(alerts, Date.now(), scopeKey);

    const dropped = alerts.length - alertsToDispatch.length;
    if (dropped > 0 && process.env.NODE_ENV === 'development') {
      console.warn(
        `[alertDispatcher] Burst control dropped ${dropped} alert(s). ` +
        `${alertsToDispatch.length} alert(s) will be dispatched.`,
      );
    }
  } else {
    alertsToDispatch = alerts;
  }

  recordBurstWindow(alertsToDispatch.length, Date.now(), scopeKey);

  // ── Per-alert delivery loop ───────────────────────────────────────────────
  //
  // All channel deliveries for one alert are fired concurrently (Promise.all).
  // Alerts are processed in severity order — filterAlertsForBurst preserves
  // the order from evaluateAlerts() (critical → high → medium → low).
  //
  // The outer try/catch ensures the entire loop is failure-isolated —
  // if an unexpected synchronous error occurs (defensive), it is swallowed.
  try {
    const alertDeliveryPromises: Promise<void>[] = [];

    for (const alert of alertsToDispatch) {
      // ── Gate: Execution policy ────────────────────────────────────────────
      // Runs BEFORE dedup so blocked alerts don't consume dedup cooldown slots.
      // Prevents rapid-repeat execution and critical escalation loops.
      // Returns true on any internal error — safe default is allow.
      if (!shouldExecuteAction(alert)) {
        if (process.env.NODE_ENV === 'development') {
          console.debug(
            `[alertDispatcher] Policy blocked: alert=${alert.id} ` +
            `metric=${alert.metric} severity=${alert.severity}`,
          );
        }
        continue;
      }

      // ── Gate 3: Deduplication ──────────────────────────────────────────
      // isDuplicate is side-effecting: on first occurrence it records the
      // timestamp and returns false; on repeat occurrences it returns true.
      if (isDuplicate(alert)) {
        if (process.env.NODE_ENV === 'development') {
          console.debug(
            `[alertDispatcher] Dedup suppressed: alert=${alert.id} ` +
            `severity=${alert.severity}`,
          );
        }
        continue;
      }

      // ── Per-channel delivery ───────────────────────────────────────────
      for (const channel of CHANNELS) {
        // ── Gate 4: Rate limiting ────────────────────────────────────────
        if (isRateLimited(channel.name)) {
          if (process.env.NODE_ENV === 'development') {
            console.warn(
              `[alertDispatcher] Rate limited: channel=${channel.name} ` +
              `alert=${alert.id} — dropped for this window`,
            );
          }
          // Track the drop so operators can tune CHANNEL_LIMITS.
          try {
            trackEvent('alert.delivery.failed' as never, {
              channel:  channel.name,
              alertId:  alert.id,
              severity: alert.severity,
              metric:   alert.metric,
              attempts: 0,
              error:    'rate_limited',
            } as never);
          } catch { /* swallow */ }
          continue;
        }

        // Queue the delivery (concurrent per alert, not per batch).
        // withRetry() applies jittered backoff — retries are desynchronised.
        // meta is forwarded for success-sampling rate context only — it has
        // no effect on delivery logic or retry behaviour.
        alertDeliveryPromises.push(
          _deliverToChannel(alert, channel, meta),
        );
      }
    }

    // Wait for all queued deliveries. Failures are handled inside
    // _deliverToChannel — Promise.all will not short-circuit on rejection
    // because _deliverToChannel itself never rejects.
    await Promise.all(alertDeliveryPromises);

  } catch (unexpectedError) {
    // This branch should never execute — it is a last-resort safety net
    // in case of a programming error in the loop above (e.g. a synchronous
    // throw from isDuplicate or isRateLimited).
    if (process.env.NODE_ENV === 'development') {
      console.error(
        '[alertDispatcher] Unexpected error in dispatch loop — swallowed.',
        unexpectedError,
      );
    }
  }
}