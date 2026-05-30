/**
 * @file types/internal/mappedMetrics.ts
 * @description Internal MappedMetrics type extending MetricsResponse with _meta.
 *
 * RULES (NON-NEGOTIABLE):
 *  - _meta MUST NOT be forwarded to the UI layer
 *  - _meta is stripped by metricsAdapter before returning public section types
 *  - This type is internal to the integration → mapping → adapter pipeline
 *  - ZERO imports from hooks, UI, or pages
 *
 * _meta LIFECYCLE:
 *
 *   posthogClient / backendClient
 *        ↓
 *   metricsMapper (attaches _meta)
 *        ↓
 *   metricsAdapter (reads _meta for monitoring, then strips it)
 *        ↓
 *   /lib/api/metrics.ts (returns clean public section types — _meta gone)
 *        ↓
 *   useMetrics hook → UI (never sees _meta)
 *
 * HOW _meta IS CONTAINED:
 *  - MappedMetrics is never exported from /lib/api/metrics.ts
 *  - Section extractors (resolveOverviewMetrics, etc.) return typed section slices
 *  - TypeScript structurally prevents _meta leaking: public types don't have _meta
 *  - ESLint rule (no-restricted-imports) can enforce this boundary in CI
 */

import type {
  OverviewMetrics,
  ResumeFunnelMetrics,
  OnboardingFunnelMetrics,
  PerformanceMetrics,
  ReliabilityMetrics,
  ExperimentMetrics,
} from '@/lib/api/metrics-types';

// ─────────────────────────────────────────────────────────────────────────────
// FRESHNESS METADATA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Data freshness and source availability metadata.
 * Internal only — never forwarded to the UI layer.
 */
export interface MetricsMeta {
  /** Which sources contributed to this result */
  sources: {
    posthog?: boolean;
    backend?: boolean;
  };
  /** Unix timestamp (ms) when this result was assembled */
  timestamp: number;
  /**
   * True if at least one source failed and defaults were used.
   * Monitoring uses this to detect degraded data quality.
   */
  partial: boolean;
  /**
   * Execution mode at the time of resolution.
   *
   * 'single'  — only one source was configured (posthog | backend).
   *             partial = true when that sole source fails.
   * 'hybrid'  — both sources were attempted (METRICS_SOURCE=hybrid).
   *             partial = true when either source fails.
   * 'mock'    — mock data; partial is always false (not a failure condition).
   *
   * Internal only. Improves debuggability without leaking topology to UI.
   *
   * @internal
   */
  mode: 'single' | 'hybrid' | 'mock';
}

// ─────────────────────────────────────────────────────────────────────────────
// MAPPED METRICS (INTERNAL TYPE)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Internal aggregate type: all six normalized metric sections + _meta.
 *
 * Used exclusively within the integration → mapping → adapter pipeline.
 * The adapter extracts individual sections (without _meta) before returning
 * to /lib/api/metrics.ts.
 */
export interface MappedMetrics {
  overview:     OverviewMetrics;
  resumeFunnel: ResumeFunnelMetrics;
  onboarding:   OnboardingFunnelMetrics;
  performance:  PerformanceMetrics;
  reliability:  ReliabilityMetrics;
  experiments:  ExperimentMetrics;
  /**
   * Internal freshness + observability metadata.
   * Prefixed with _ to signal it is not part of the public API contract.
   * MUST be stripped before data reaches /lib/api/metrics.ts return values.
   */
  _meta: MetricsMeta;
}