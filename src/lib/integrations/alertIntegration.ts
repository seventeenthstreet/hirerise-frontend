/**
 * @file lib/integrations/alertIntegration.ts
 * @description Integration shim: connects the metrics pipeline to the alert dispatcher.
 *
 * PURPOSE:
 *   This module provides the single call-site where alert evaluation meets
 *   alert delivery. It is called from inside the metrics data pipeline —
 *   specifically inside backendClient.ts or the metrics resolution path in
 *   the adapter — AFTER metrics data is fully assembled and BEFORE _meta is stripped.
 *
 * WHY A SEPARATE FILE?
 *   Keeping this shim separate from both the adapter and the dispatcher means:
 *   - The adapter has no direct dependency on the delivery channels.
 *   - The dispatcher has no knowledge of the metrics schema.
 *   - This file is the only place that imports from both sides.
 *   - Future: replace this with a queue subscription model without touching either side.
 *
 * CALL SITE RULES:
 *   1. Call triggerAlertPipeline() with `void` prefix — never await.
 *   2. Call it AFTER metrics are resolved, BEFORE _meta is stripped.
 *   3. Never call from hooks, UI, or pages.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * INTEGRATION EXAMPLE (inside backendClient.ts or metricsAdapter resolution):
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   import { evaluateAlerts }        from '@/lib/alerts';
 *   import { triggerAlertPipeline }  from '@/lib/integrations/alertIntegration';
 *
 *   // ... resolve mappedMetrics (with _meta still attached) ...
 *
 *   // Fire-and-forget: does not block rendering or metric return.
 *   void triggerAlertPipeline(mappedMetrics);
 *
 *   // Strip _meta and return public sections to /lib/api/metrics.ts as usual.
 *   return { overview: mappedMetrics.overview, ... };
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { evaluateAlerts }   from '@/lib/alerts';
import { dispatchAlerts }   from '@/lib/alertDispatcher';
import type { MappedMetrics } from '@/types/internal/mappedMetrics';

// ─────────────────────────────────────────────────────────────────────────────
// ALERT METRICS ADAPTER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adapt a MappedMetrics object to the AlertMetricsInput shape required
 * by evaluateAlerts(). Both types cover the same six metric sections, but
 * AlertMetricsInput uses nullable sections (metric sections might be null
 * during partial loads) while MappedMetrics guarantees all sections present.
 *
 * The cast is safe: AlertMetricsInput is a strict subset of MappedMetrics.
 *
 * @internal
 */
function _toAlertInput(mapped: MappedMetrics) {
  return {
    overview:     mapped.overview,
    resumeFunnel: mapped.resumeFunnel,
    onboarding:   mapped.onboarding,
    performance:  mapped.performance,
    reliability:  mapped.reliability,
    experiments:  mapped.experiments,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluate alerts against resolved metrics and dispatch them to all channels.
 *
 * This function:
 *   1. Runs evaluateAlerts() on the metrics data (pure, synchronous).
 *   2. Hands the resulting Alert[] and _meta to dispatchAlerts() (async, fire-and-forget).
 *   3. Returns void immediately — the caller is not blocked.
 *
 * CALL WITH VOID:
 *   void triggerAlertPipeline(mappedMetrics);
 *
 * Any errors inside dispatchAlerts() are fully contained there — they cannot
 * propagate back through this function.
 *
 * @param mappedMetrics - The fully resolved MappedMetrics with _meta still attached.
 *                        Must be called before _meta is stripped.
 */
export function triggerAlertPipeline(mappedMetrics: MappedMetrics): void {
  // Evaluate alerts synchronously — pure function, no I/O.
  const alerts = evaluateAlerts(_toAlertInput(mappedMetrics));

  // Dispatch asynchronously — fire-and-forget.
  // dispatchAlerts() guarantees it never throws; void is safe here.
  void dispatchAlerts(alerts, mappedMetrics._meta);
}
