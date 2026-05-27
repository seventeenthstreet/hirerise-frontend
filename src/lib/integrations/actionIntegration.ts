/**
 * @file lib/integrations/actionIntegration.ts
 * @description Integration shim: connects the Insight Pipeline to the Action Engine.
 *
 * PURPOSE:
 *   Single call-site that bridges insight output to action execution.
 *   Mirrors the pattern established by alertIntegration.ts and insightIntegration.ts:
 *   one file that imports from both sides so neither side depends on the other.
 *
 * POSITION IN THE FULL PIPELINE:
 *
 *   metricsAdapter.ts  (resolves MappedMetrics)
 *        ↓
 *   alertIntegration.ts   (evaluateAlerts → dispatchAlerts)      ← unchanged
 *        ↓
 *   insightIntegration.ts (evaluateAlerts → generateInsights)    ← unchanged
 *        ↓
 *   actionIntegration.ts  (insights → executeActions)            ← NEW (this file)
 *
 * CALL SITE RULES:
 *   1. Call triggerActionPipeline() AFTER runInsightPipeline() — requires Insight[].
 *   2. Call it AFTER metrics are resolved, BEFORE _meta is stripped.
 *   3. Never await — it is fire-and-forget.
 *   4. Never call from hooks, UI, or pages.
 *
 * USAGE EXAMPLE (inside metricsAdapter.ts or backendClient.ts):
 *
 *   import { triggerAlertPipeline }   from '@/lib/integrations/alertIntegration';
 *   import { runInsightPipeline }     from '@/lib/integrations/insightIntegration';
 *   import { triggerActionPipeline }  from '@/lib/integrations/actionIntegration';
 *
 *   // ... resolve mappedMetrics (with _meta still attached) ...
 *
 *   // 1. Existing: alert pipeline (unchanged)
 *   void triggerAlertPipeline(mappedMetrics);
 *
 *   // 2. Existing: insight pipeline — returns Insight[]
 *   const insights = runInsightPipeline(mappedMetrics, { history });
 *
 *   // 3. NEW: action pipeline — fire-and-forget, never await
 *   triggerActionPipeline(insights, mappedMetrics._meta);
 *
 *   // 4. Return public data as normal
 *   return { overview: mappedMetrics.overview, ... };
 *
 * ARCHITECTURE GUARANTEES:
 *   - Does NOT modify alert system, insight system, hooks, or UI.
 *   - Is entirely fire-and-forget — never blocks or throws to caller.
 *   - Alert and insight pipelines are UNCHANGED — no modifications to either.
 *   - MappedMetrics type is UNCHANGED — _meta is read but not mutated.
 *   - System works correctly if triggerActionPipeline() is never called.
 */

import type { Insight }     from '@/lib/insights/types';
import type { MetricsMeta } from '@/types/internal/mappedMetrics';

import { executeActions } from '@/lib/actions/actionEngine';

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trigger the action pipeline for a resolved set of insights.
 *
 * This is the ONLY public entry point for the action engine from the
 * integration layer. It is:
 *   - Synchronous at the call-site (executeActions is sync; dispatch is async fire-and-forget)
 *   - Safe to call with any Insight[] including empty arrays
 *   - Safe to call without await — actions are fully fire-and-forget
 *   - Non-throwing — any internal error is swallowed by executeActions
 *
 * @param insights - Scored insights from runInsightPipeline()
 * @param meta     - Pipeline metadata (_meta from MappedMetrics)
 */
export function triggerActionPipeline(
  insights: Insight[],
  meta:     MetricsMeta,
): void {
  // executeActions() is synchronous and fire-and-forget internally.
  // No try/catch needed here — executeActions guarantees no throw.
  executeActions(insights, meta);
}