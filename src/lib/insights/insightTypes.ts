/**
 * @file lib/insights/insightTypes.ts
 * @description Shared type definitions for the Insight layer.
 *
 * RULES:
 *   - All required fields are NEVER modified (backward-compat guarantee)
 *   - All new fields are OPTIONAL — zero breaking changes
 *   - No imports from React, hooks, UI, or alert system
 *   - This file has no runtime dependencies — import cost is zero
 *
 * EXTENSION PATTERN:
 *   New optional fields may be added to Insight without touching any consumer.
 *   Consumers that don't know about new fields simply ignore them (structural typing).
 */

// ─────────────────────────────────────────────────────────────────────────────
// CORE INSIGHT TYPE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Insight type discriminant.
 *
 * - 'anomaly'     — z-score or fallback anomaly detection
 * - 'trend'       — consecutive directional periods
 * - 'correlation' — multi-signal cross-metric pattern
 * - 'recommendation' — actionable next step derived from the above
 */
export type InsightType = 'anomaly' | 'trend' | 'correlation' | 'recommendation';

/**
 * Severity of an insight, mirroring alert severity for operator familiarity.
 * Optional on 'correlation' insights that synthesize across severities.
 */
export type InsightSeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Structured reason type — distinguishes how an insight was produced.
 *
 * - 'anomaly'     — statistical deviation (z-score / fallback)
 * - 'trend'       — consecutive directional movement
 * - 'correlation' — rule-matched multi-metric co-occurrence
 */
export type InsightReasonType = 'anomaly' | 'trend' | 'correlation';

/**
 * A fired insight instance.
 *
 * Required fields are FROZEN — never rename or delete them.
 * Optional fields (marked with ?) are additive — safe to ignore.
 *
 * Produced by insightEngine.ts and consumed by insightIntegration.ts.
 * UI receives Insight[] — renders only, zero computation.
 */
export interface Insight {
  // ── Required fields (frozen contract) ─────────────────────────────────────

  /** Discriminant type of this insight. */
  type:    InsightType;

  /** The metric key this insight targets. 'composite' for correlations. */
  metric:  string;

  /** Human-readable description of what was detected. */
  message: string;

  /**
   * Numeric relevance score (0–100).
   * Higher = more important. Used for dedup and ranking.
   */
  score:   number;

  /** Unix timestamp (ms) when this insight was evaluated. */
  firedAt: number;

  // ── Optional fields (additive — all new fields go here) ───────────────────

  /**
   * Severity classification, when applicable.
   * Absent on pure 'correlation' insights that synthesize across severities.
   */
  severity?: InsightSeverity;

  /**
   * Structured explainability — how this insight was produced.
   * Populated by anomaly, trend, and correlation detectors.
   */
  reasonType?: InsightReasonType;

  /**
   * Confidence in this insight (0–1, inclusive).
   *
   * Derivation per reasonType:
   *   anomaly     → normalised z-score: min(|z| / Z_MAX, 1)
   *   trend       → consecutivePeriods / maxPeriods
   *   correlation → rule-defined fixed confidence
   */
  confidence?: number;

  /**
   * Human-readable signal names that drove this insight.
   * Array of metric keys or descriptive labels, e.g.
   * ['conversion_rate↓', 'latency↑'].
   */
  drivers?: string[];

  /**
   * Type-weighted confidence (0–1, inclusive).
   *
   * Derived from `confidence * typeWeight` where typeWeight reflects the
   * inherent signal strength of the insight type:
   *   anomaly/correlation → 1.0  (statistically grounded)
   *   risk                → 0.9
   *   trend               → 0.7  (directional, not conclusive)
   *   opportunity         → 0.6  (speculative)
   *
   * `confidence` is preserved unchanged. `normalizedConfidence` is the
   * cross-type-comparable value for ranking and display.
   * Populated by scoring.scoreAndDedup(); absent before that stage.
   */
  normalizedConfidence?: number;

  /**
   * Context-enriched recommendation text.
   * More specific than a generic recommendation — includes trend / anomaly /
   * correlation context when available.
   */
  recommendation?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// METRIC SNAPSHOT TYPE
// Mirrors AlertMetricsInput but declared independently — no alert coupling.
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
 * Input snapshot passed to insightEngine.runInsights().
 *
 * All section fields are nullable — the engine skips sections that haven't
 * loaded yet, producing no false positives on initial page load.
 */
export interface InsightMetricsInput {
  overview:     OverviewMetrics         | null;
  resumeFunnel: ResumeFunnelMetrics     | null;
  onboarding:   OnboardingFunnelMetrics | null;
  performance:  PerformanceMetrics      | null;
  reliability:  ReliabilityMetrics      | null;
  experiments:  ExperimentMetrics       | null;

  /**
   * Historical values per metric key, oldest first.
   * Enables anomaly detection and trend analysis across evaluation cycles.
   * Optional — detectors fall back to single-point heuristics when absent.
   */
  history?: Record<string, number[]>;

  /**
   * Current evaluation timestamp (ms).
   * Defaults to Date.now() when absent — override in tests for determinism.
   */
  nowMs?: number;
}