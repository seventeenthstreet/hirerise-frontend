/**
 * @file lib/insights/insightIntegration.ts
 * @description Non-intrusive integration layer between the metrics data flow and the insight engine.
 *
 * PURPOSE:
 *   Bridges AllMetricsData (from useMetrics) to InsightMetricsInput (for insightEngine)
 *   without touching useMetrics, alerts.ts, or any existing types.
 *
 * INTEGRATION PATTERN:
 *   Callers (e.g. useMetrics) invoke triggerInsights() after a data fetch cycle
 *   with the latest snapshot. This file handles all the mapping and passes
 *   the result back as an Insight[] — no state, no side effects in this module.
 *
 * RULES:
 *   - No throw propagation — returns empty array on any error
 *   - No imports from React or hooks (pure lib utility)
 *   - No imports from alert system — completely decoupled
 *   - No modification of existing files
 *   - Output type is Insight[] — no new global state introduced
 */

import type { Insight, InsightMetricsInput } from './insightTypes';
import { runInsights } from './insightEngine';

// ─────────────────────────────────────────────────────────────────────────────
// INPUT TYPE
// Mirrors AllMetricsData from useMetrics without importing from it.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  OverviewMetrics,
  ResumeFunnelMetrics,
  OnboardingFunnelMetrics,
  PerformanceMetrics,
  ReliabilityMetrics,
  ExperimentMetrics,
} from '@/lib/api/metrics';

/**
 * Minimal snapshot shape required by triggerInsights().
 * Matches AllMetricsData from useMetrics but declared locally to avoid
 * creating a dependency on the hook layer.
 */
export interface InsightSnapshot {
  overview:     OverviewMetrics         | null;
  resumeFunnel: ResumeFunnelMetrics     | null;
  onboarding:   OnboardingFunnelMetrics | null;
  performance:  PerformanceMetrics      | null;
  reliability:  ReliabilityMetrics      | null;
  experiments:  ExperimentMetrics       | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// OPTIONS
// ─────────────────────────────────────────────────────────────────────────────

export interface TriggerInsightsOptions {
  /**
   * Historical values per metric key, oldest first.
   * Pass the accumulated series from the host's own history tracking.
   * When absent, detectors fall back to single-point heuristics.
   */
  history?: Record<string, number[]>;

  /**
   * Current evaluation timestamp (ms).
   * Override in tests for determinism. Defaults to Date.now().
   */
  nowMs?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trigger the insight engine from a metrics snapshot.
 *
 * This is the single call-site for all insight evaluation. Callers never
 * need to import individual detectors — this function encapsulates the
 * full pipeline and returns a stable Insight[].
 *
 * Safe to call on every data fetch cycle — the insightMemory layer handles
 * cooldown suppression so repeated evaluation is cheap and stable.
 *
 * @param snapshot - Latest AllMetricsData snapshot from the hook layer
 * @param options  - Optional history + timestamp override
 * @returns        Array of insights that passed all evaluation stages
 */
export function triggerInsights(
  snapshot: InsightSnapshot,
  options:  TriggerInsightsOptions = {},
): Insight[] {
  try {
    const input: InsightMetricsInput = {
      overview:     snapshot.overview,
      resumeFunnel: snapshot.resumeFunnel,
      onboarding:   snapshot.onboarding,
      performance:  snapshot.performance,
      reliability:  snapshot.reliability,
      experiments:  snapshot.experiments,
      history:      options.history,
      nowMs:        options.nowMs,
    };

    return runInsights(input);
  } catch {
    // Never propagate — the integration layer is an optional enhancement
    return [];
  }
}

// Re-export Insight type so callers only need one import
export type { Insight } from './insightTypes';