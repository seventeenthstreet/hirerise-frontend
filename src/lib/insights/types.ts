/**
 * @file lib/insights/types.ts
 * @description Shared types for the Insight Layer.
 *
 * RULES:
 *  - NO imports from React, hooks, UI, or pages
 *  - Pure TypeScript type definitions only
 *  - Stable, backward-compatible contract — additive only
 *
 * Architecture position: lib utility, consumed only by the insight sub-modules
 *   Metrics + Alerts → InsightEngine → Insight[] → (optional: UI / logs / reports)
 */

import type { Alert, AlertMetricsInput } from '@/lib/alerts';

// ─────────────────────────────────────────────────────────────────────────────
// CORE INSIGHT TYPE
// ─────────────────────────────────────────────────────────────────────────────

/** Four orthogonal lenses on a metric's behaviour. */
export type InsightType = 'anomaly' | 'trend' | 'risk' | 'opportunity';

/** Three-tier severity — intentionally lighter than AlertSeverity (no 'critical'). */
export type InsightSeverity = 'low' | 'medium' | 'high';

/**
 * A single structured insight produced by generateInsights().
 *
 * Design decisions:
 *  - `score` drives ordering: higher = more urgent/actionable.
 *  - `recommendation` is optional: not every anomaly has a prescribed action.
 *  - `context` carries raw numbers so downstream tooling can verify the insight
 *    without re-computing from scratch.
 */
export interface Insight {
  /** Stable, deterministic ID: `${type}:${metric}:${timeWindowKey}` */
  id:              string;
  type:            InsightType;
  severity:        InsightSeverity;
  /** Human-readable, self-contained explanation with metric context. */
  message:         string;
  /** Optional prescribed action — only present when a clear remedy exists. */
  recommendation?: string;
  /** Schema metric name this insight is about. */
  metric:          string;
  /** 0–100 priority score (higher = more urgent). Drives sort order. */
  score:           number;
  /** Raw values used to derive this insight — enables explainability. */
  context: InsightContext;
}

/** Numeric evidence attached to every insight for full explainability. */
export interface InsightContext {
  /** The metric value at the time of evaluation. */
  currentValue:   number;
  /** Baseline or expected value, when available. */
  baselineValue?: number;
  /** Absolute deviation from baseline (currentValue − baselineValue). */
  deviation?:     number;
  /** Deviation expressed as z-score standard deviations. */
  zScore?:        number;
  /**
   * Number of consecutive periods showing the same directional movement.
   * Present for trend insights.
   */
  consecutivePeriods?: number;
  /** Percentage change relative to baseline (0–1 scale). */
  percentageChange?:   number;
}

// ─────────────────────────────────────────────────────────────────────────────
// INSIGHT ENGINE INPUT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full input bundle for generateInsights().
 *
 * Mirrors the data available after alerts are computed in the pipeline:
 *  metricsAdapter → alertIntegration → [insightIntegration ← here]
 *
 * `_meta` is optional so the engine degrades gracefully when called without
 * the full pipeline context (e.g. in tests or offline tooling).
 */
export interface InsightInput {
  /** Full metrics snapshot (same shape as AlertMetricsInput). */
  metrics: AlertMetricsInput;
  /** Fired alerts from evaluateAlerts() — already computed, reused here. */
  alerts:  Alert[];
  /**
   * Optional temporal history per metric key (oldest first).
   * When provided, enables z-score anomaly detection and trend analysis.
   * When absent, the engine falls back to threshold-only rules.
   */
  history?: Record<string, number[]>;
  /**
   * Optional metadata from the pipeline (_meta from MappedMetrics).
   * Used to timestamp insights and annotate data quality.
   */
  _meta?: {
    timestamp: number;
    partial:   boolean;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ANOMALY DETECTOR OUTPUT
// ─────────────────────────────────────────────────────────────────────────────

/** Internal result returned by detectAnomalies() — not exported from the layer. */
export interface AnomalyResult {
  metric:        string;
  currentValue:  number;
  baselineValue: number;
  deviation:     number;
  zScore:        number;
  severity:      InsightSeverity;
}

// ─────────────────────────────────────────────────────────────────────────────
// TREND ANALYZER OUTPUT
// ─────────────────────────────────────────────────────────────────────────────

export type TrendDirection = 'up' | 'down' | 'flat';

/** Internal result returned by analyzeTrends() — not exported from the layer. */
export interface TrendResult {
  metric:              string;
  direction:           TrendDirection;
  consecutivePeriods:  number;
  firstValue:          number;
  lastValue:           number;
  totalChange:         number;
  severity:            InsightSeverity;
}