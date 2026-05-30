/**
 * @file lib/insights/insightEngine.ts
 * @description Insight engine orchestration.
 *
 * PIPELINE:
 *   1. anomalyDetector   → raw anomaly insights
 *   2. trendAnalyzer     → raw trend insights
 *   3. correlationEngine → composite cross-metric insights
 *   4. recommendationEngine.enrichWithRecommendations → context-aware actions
 *   5. scoring.scoreAndDedup → deterministic score + dedup + sort
 *   6. insightMemory.filterByMemory → cooldown suppression
 *   7. final output → Insight[]
 *
 * GUARANTEES:
 *   - Always returns an array (never throws to caller)
 *   - Each stage failure falls back gracefully — empty stage, not abort
 *   - Deterministic: same inputs → same outputs (modulo memory state)
 *   - No UI/API coupling
 *   - No randomness
 *   - Performance: O(n) across all stages; no heavy ops
 *
 * RULES:
 *   - Additive only — no existing files modified
 *   - No imports from React, hooks, or alert system
 */

import type { Insight, InsightMetricsInput } from './insightTypes';
import { detectAnomalies }           from './anomalyDetector';
import { analyzeTrends }             from './trendAnalyzer';
import { detectCorrelations }        from './correlationEngine';
import { enrichWithRecommendations } from './recommendationEngine';
import { scoreAndDedup }             from './scoring';
import { filterByMemory }            from './insightMemory';

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the full insight evaluation pipeline.
 *
 * Stage order is intentional:
 *   - Detectors fire independently; their outputs are merged before cross-stage enrichment
 *   - correlationEngine runs after detectors so it can inspect detector outputs if needed
 *   - recommendationEngine runs after all signals are collected (needs full context)
 *   - scoreAndDedup runs before memory filter to ensure the best insight wins dedup
 *   - insightMemory (cooldown) runs last — it gates which scored insights actually emit
 *
 * @param metrics - Current metrics snapshot + optional history + optional nowMs
 * @returns       Stable array of insights that passed all stages
 */
export function runInsights(metrics: InsightMetricsInput): Insight[] {
  try {
    const nowMs = metrics.nowMs ?? Date.now();
    const metricsWithTime: InsightMetricsInput = { ...metrics, nowMs };

    // ── Stage 1 & 2: Single-metric detectors ─────────────────────────────
    let anomalies:     Insight[] = [];
    let trends:        Insight[] = [];
    let correlations:  Insight[] = [];

    try { anomalies    = detectAnomalies(metricsWithTime);   } catch { /* safe fallback */ }
    try { trends       = analyzeTrends(metricsWithTime);     } catch { /* safe fallback */ }

    // ── Stage 3: Cross-metric correlations ───────────────────────────────
    try { correlations = detectCorrelations(metricsWithTime); } catch { /* safe fallback */ }

    // ── Merge all raw insights ────────────────────────────────────────────
    const all: Insight[] = [...anomalies, ...trends, ...correlations];

    if (all.length === 0) return [];

    // ── Stage 4: Context-aware recommendations ───────────────────────────
    let enriched: Insight[] = all;
    try { enriched = enrichWithRecommendations(all); } catch { enriched = all; }

    // ── Stage 5: Score + dedup + sort ─────────────────────────────────────
    let scored: Insight[] = enriched;
    try { scored = scoreAndDedup(enriched); } catch { scored = enriched; }

    // ── Stage 6: Memory cooldown filter ──────────────────────────────────
    let final: Insight[] = scored;
    try { final = filterByMemory(scored, nowMs); } catch { final = scored; }

    return final;
  } catch {
    // Absolute safety net — the engine never propagates throws to the caller
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RE-EXPORTS
// Consumers only need to import from insightEngine — no need to know the
// internal module structure.
// ─────────────────────────────────────────────────────────────────────────────

export type { Insight, InsightMetricsInput } from './insightTypes';
export { flushInsightMemory, insightMemorySize } from './insightMemory';