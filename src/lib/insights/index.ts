/**
 * @file lib/insights/index.ts
 * @description Public API barrel for the Insight Layer.
 *
 * External consumers (e.g. useMetrics, future hooks) import only from
 * this file — internal module structure is an implementation detail.
 *
 * EXPORTED SURFACE:
 *   triggerInsights        — primary entry point for insight evaluation
 *   InsightSnapshot        — input type (mirrors AllMetricsData)
 *   TriggerInsightsOptions — optional config
 *   Insight                — output type
 *   flushInsightMemory     — test / operator reset
 *   insightMemorySize      — diagnostics
 */

export { triggerInsights }           from './insightIntegration';
export type { InsightSnapshot, TriggerInsightsOptions } from './insightIntegration';
export type { Insight, InsightType, InsightSeverity, InsightReasonType, InsightMetricsInput } from './insightTypes';
export { flushInsightMemory, insightMemorySize } from './insightMemory';

// Internal modules are NOT re-exported — they are implementation details.
// Import insightEngine directly only if you need runInsights() in isolation.