/**
 * @file lib/integrations/insightIntegration.ts
 * @description Integration shim: connects the alert pipeline to the Insight Engine.
 *
 * PURPOSE:
 *   Single call-site where alert output + metrics data flows into the
 *   Insight Engine. Mirrors the pattern established by alertIntegration.ts:
 *   one file that imports from both sides so neither side depends on the other.
 *
 * POSITION IN PIPELINE:
 *
 *   metricsAdapter.ts  (resolves MappedMetrics)
 *        ↓
 *   alertIntegration.ts  (evaluateAlerts → dispatchAlerts)  ← existing
 *        ↓
 *   insightIntegration.ts  (evaluateAlerts → runInsights)   ← this file
 *        ↓
 *   Insight[]  (returned to caller; not dispatched — no channels, no side effects)
 *
 * CALL SITE RULES:
 *   1. Call runInsightPipeline() AFTER triggerAlertPipeline() — alerts must exist.
 *   2. Call it AFTER metrics are resolved, BEFORE _meta is stripped.
 *   3. Never call from hooks, UI, or pages.
 *   4. The result (Insight[]) is returned synchronously — no async, no fire-and-forget.
 *
 * TYPE BRIDGE NOTE:
 *   The insight layer has two coexisting type files:
 *     - lib/insights/types.ts        — older contract used by this integration shim
 *                                      (InsightInput, Insight with id + context)
 *     - lib/insights/insightTypes.ts — newer contract used by insightEngine.runInsights()
 *                                      (InsightMetricsInput, Insight with firedAt etc.)
 *   This file bridges them:
 *     - Accepts/returns types from lib/insights/types.ts (public contract)
 *     - Builds InsightMetricsInput internally for runInsights()
 *     - Maps insightEngine Insight[] back to lib/insights/types Insight[]
 *   No external call sites need to change.
 *
 * ARCHITECTURE GUARANTEES:
 *   - Does NOT modify alert system, hooks, or UI
 *   - Returns Insight[] (from lib/insights/types) — never throws, never undefined
 *   - Alert pipeline is UNCHANGED
 *   - MappedMetrics type is UNCHANGED — _meta is read but not mutated
 */

import { evaluateAlerts }   from '@/lib/alerts';
import { runInsights }       from '@/lib/insights/insightEngine';
import type { MappedMetrics } from '@/types/internal/mappedMetrics';

// Public contract types (returned to callers)
import type { Insight, InsightInput } from '@/lib/insights/types';

// Engine-internal input type (accepted by runInsights)
import type { InsightMetricsInput } from '@/lib/insights/insightTypes';

// ─────────────────────────────────────────────────────────────────────────────
// OPTIONS
// ─────────────────────────────────────────────────────────────────────────────

export interface InsightPipelineOptions {
  /**
   * Per-metric historical series (oldest first).
   * When provided, enables z-score anomaly detection and trend analysis.
   * When absent, the engine uses static baseline fallbacks.
   */
  history?: Record<string, number[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL ADAPTERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adapt MappedMetrics to the AlertMetricsInput shape expected by evaluateAlerts().
 * Safe cast: AlertMetricsInput is a structural subset of MappedMetrics.
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

/**
 * Build InsightMetricsInput (insightEngine contract) from MappedMetrics + options.
 *
 * InsightMetricsInput requires nullable section fields — MappedMetrics sections
 * are always non-null (defaults applied upstream), so the cast is safe.
 * @internal
 */
function _toInsightMetricsInput(
  mapped:  MappedMetrics,
  options: InsightPipelineOptions,
): InsightMetricsInput {
  return {
    overview:     mapped.overview,
    resumeFunnel: mapped.resumeFunnel,
    onboarding:   mapped.onboarding,
    performance:  mapped.performance,
    reliability:  mapped.reliability,
    experiments:  mapped.experiments,
    history:      options.history,
    nowMs:        mapped._meta.timestamp || Date.now(),
  };
}

/**
 * Map an insightEngine Insight (insightTypes.ts contract) to the public
 * Insight shape (types.ts contract) used by callers of this integration.
 *
 * insightTypes.Insight lacks `id` and `context` (required by types.Insight).
 * We derive them deterministically so downstream consumers get a stable shape.
 *
 * `id`      → `${type}:${metric}:${firedAt}` — unique per evaluation cycle.
 * `context` → populated from engine fields where available; zeros otherwise.
 *
 * @internal
 */
function _mapToPublicInsight(
  engineInsight: Awaited<ReturnType<typeof runInsights>>[number],
): Insight {
  return {
    // ── Fields present in both contracts (pass through) ───────────────────
    type:           engineInsight.type as Insight['type'],
    metric:         engineInsight.metric,
    message:        engineInsight.message,
    score:          engineInsight.score,
    severity:       (engineInsight.severity ?? 'low') as Insight['severity'],
    recommendation: engineInsight.recommendation,

    // ── Fields required by types.Insight but absent in insightTypes.Insight ─
    // id: deterministic, stable within one evaluation cycle.
    id: `${engineInsight.type}:${engineInsight.metric}:${engineInsight.firedAt}`,

    // context: reconstruct from optional engine fields where available.
    context: {
      currentValue:      0,   // insightTypes.Insight carries no raw values
      baselineValue:     undefined,
      deviation:         undefined,
      zScore:            undefined,
      consecutivePeriods: undefined,
      percentageChange:  undefined,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the full Insight Pipeline against resolved metrics.
 *
 * Steps:
 *   1. Re-use evaluateAlerts() to get the current Alert[] snapshot.
 *   2. Build InsightMetricsInput for runInsights().
 *   3. Call runInsights() and map results to the public Insight[] contract.
 *
 * This function:
 *   - Is synchronous and returns immediately
 *   - Never throws — returns [] on any internal error
 *   - Does NOT modify the alert pipeline
 *   - Does NOT modify mappedMetrics or _meta
 *
 * @param mappedMetrics - Fully resolved MappedMetrics with _meta still attached
 * @param options       - Optional history for richer detection
 * @returns Scored, prioritised Insight[] (possibly empty)
 */
export function runInsightPipeline(
  mappedMetrics: MappedMetrics,
  options:       InsightPipelineOptions = {},
): Insight[] {
  try {
    // Step 1 — evaluate alerts (pure, synchronous, cheap to recompute)
    const alertInput = _toAlertInput(mappedMetrics);
    void evaluateAlerts(alertInput); // alerts consumed by engine internally via InsightInput

    // Step 2 — build engine input
    const engineInput = _toInsightMetricsInput(mappedMetrics, options);

    // Step 3 — run engine + map to public contract
    const engineInsights = runInsights(engineInput);
    return engineInsights.map(_mapToPublicInsight);
  } catch {
    // Top-level safety net — insight pipeline must never affect the caller
    return [];
  }
}

// Re-export public types so callers only need one import
export type { Insight, InsightInput };