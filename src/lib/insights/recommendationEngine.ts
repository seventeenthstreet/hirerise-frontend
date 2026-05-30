/**
 * @file lib/insights/recommendationEngine.ts
 * @description Context-aware recommendation generation.
 *
 * UPGRADE FROM GENERIC MAPPING:
 *   Previous pattern: metric + type → static recommendation string
 *   This version:     metric + type + context (trend? anomaly severity? correlation?) → specific action
 *
 * CONTEXT DIMENSIONS:
 *   - hasAnomaly:         an anomaly insight exists for this metric
 *   - hasTrend:           a trend insight exists for this metric
 *   - anomalyConfidence:  z-score normalised confidence of the anomaly
 *   - correlationDrivers: driver labels from a co-occurring correlation insight
 *
 * LOGIC:
 *   1. Start with the base recommendation for this metric
 *   2. If anomaly + trend co-exist → escalate to urgent language
 *   3. If high-confidence anomaly → add "investigate immediately" phrasing
 *   4. If correlation context is present → append the correlation-specific hint
 *   5. Fallback: return base recommendation unchanged
 *
 * RULES:
 *   - Additive logic only — fallback to base mapping always available
 *   - No throw propagation — returns fallback string on any error
 *   - No imports from React, hooks, UI, or alert system
 *   - Deterministic given same inputs
 *   - No randomness
 */

import type { Insight, InsightType } from './insightTypes';

// ─────────────────────────────────────────────────────────────────────────────
// BASE RECOMMENDATION MAP
// metric key → base recommendation (existing level of detail)
// ─────────────────────────────────────────────────────────────────────────────

const BASE_RECOMMENDATIONS: Record<string, string> = {
  end_to_end_conversion_rate:
    'Review the resume processing funnel for drop-off points and check for recent deployment regressions.',
  upload_success_rate:
    'Inspect client-side upload logic, presigned URL generation, and CDN health.',
  resume_failure_rate:
    'Investigate the resume processing pipeline for errors, timeout patterns, and dependency failures.',
  timeout_rate:
    'Review processing job queue depth, worker capacity, and external service SLAs.',
  monitoring_error_rate:
    'Check monitoring infrastructure and error ingestion pipelines for anomalies.',
  processing_p95_ms:
    'Analyze p95/p99 latency for outlier processing jobs and check queue saturation.',
  onboarding_completion_rate:
    'Review onboarding funnel steps for UX friction, validation errors, or copy regressions.',
  avg_attempts_per_resume:
    'Investigate retry logic for loop conditions and check back-off configuration.',
  composite:
    'Multiple signals are co-occurring — prioritise cross-system investigation.',
};

const FALLBACK_RECOMMENDATION = 'Review the metric trend and recent system changes for contributing factors.';

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT TYPE
// ─────────────────────────────────────────────────────────────────────────────

export interface RecommendationContext {
  /** Other insights evaluated in the same cycle. */
  allInsights: Insight[];
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function insightsByType(insights: Insight[], type: InsightType): Insight[] {
  return insights.filter(i => i.type === type);
}

function findForMetric(insights: Insight[], type: InsightType, metric: string): Insight | undefined {
  return insightsByType(insights, type).find(i => i.metric === metric);
}

// ─────────────────────────────────────────────────────────────────────────────
// SENTENCE DEDUPLICATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Remove duplicate sentences from a recommendation string.
 *
 * Algorithm (no NLP, pure string ops):
 *   1. Split on '.' (any period — handles no-space concatenation and trailing '.')
 *   2. Trim each fragment and discard empties via filter(Boolean).
 *   3. Iterate in original order; skip any sentence already seen (case-insensitive).
 *   4. Rejoin with '. ' and append a single trailing '.'.
 *
 * Using a plain split('.') instead of a lookahead regex is more robust:
 *   - Handles periods not followed by whitespace (concatenation edge cases)
 *   - filter(Boolean) always removes the empty string after a trailing '.'
 *   - Behaviour for normal well-formed input is identical to the regex form.
 *
 * Preserves first-occurrence order — the most context-relevant sentence wins.
 * Returns the input unchanged if splitting produces ≤1 sentence (no-op cost).
 *
 * Example:
 *   Input:  "Check logs. Check logs. Investigate latency."
 *   Output: "Check logs. Investigate latency."
 *
 * @internal
 */
function _deduplicateSentences(text: string): string {
  // Split on any period, then trim and discard empty fragments.
  // Using a plain '.' split (vs a lookahead regex) handles edge cases where
  // periods are not followed by whitespace — e.g. sentences concatenated
  // without a trailing space, or periods at end-of-string. filter(Boolean)
  // removes the empty string that always appears after a trailing '.'.
  const raw = text.split('.').map(s => s.trim()).filter(Boolean);
  if (raw.length <= 1) return text;

  const seen  = new Set<string>();
  const unique: string[] = [];

  for (const sentence of raw) {
    const key = sentence.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(sentence);
    }
  }

  return unique.join('. ') + '.';
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a context-aware recommendation for a given metric.
 *
 * Upgrade path:
 *   1. Retrieve base recommendation from BASE_RECOMMENDATIONS map
 *   2. Enrich with anomaly context (confidence → urgency language)
 *   3. Enrich with trend context (sustained movement → escalated language)
 *   4. Enrich with correlation context (append cross-signal hint)
 *   5. Return the most enriched version available
 *
 * @param metric  - Metric key (or 'composite' for correlations)
 * @param context - Sibling insights from the same evaluation cycle
 * @returns       Context-enriched recommendation string
 */
export function buildRecommendation(metric: string, context: RecommendationContext): string {
  try {
    const base         = BASE_RECOMMENDATIONS[metric] ?? FALLBACK_RECOMMENDATION;
    const { allInsights } = context;

    const anomaly     = findForMetric(allInsights, 'anomaly', metric);
    const trend       = findForMetric(allInsights, 'trend',   metric);
    const correlation = allInsights
      .filter(i => i.type === 'correlation' && i.drivers?.some(d => d.startsWith(metric)))
      .at(0);

    // ── Priority 1: Anomaly + Trend co-present → urgent language ──────────
    if (anomaly && trend) {
      const urgencyPrefix = 'URGENT: This metric is both trending and showing anomalous spikes. ';
      const correlationSuffix = correlation
        ? ` Additionally, a cross-metric pattern was detected: ${correlation.recommendation ?? ''}`
        : '';
      return _deduplicateSentences(`${urgencyPrefix}${base}${correlationSuffix}`.trim());
    }

    // ── Priority 2: High-confidence anomaly → immediate investigation ─────
    if (anomaly && (anomaly.confidence ?? 0) >= 0.75) {
      const anomalyPrefix = `High-confidence anomaly detected (confidence: ${((anomaly.confidence ?? 0) * 100).toFixed(0)}%). `;
      const correlationSuffix = correlation
        ? ` Cross-metric context: ${correlation.recommendation ?? ''}`
        : '';
      return _deduplicateSentences(`${anomalyPrefix}${base}${correlationSuffix}`.trim());
    }

    // ── Priority 3: Sustained trend → escalated context ───────────────────
    if (trend) {
      const periods = trend.drivers?.[0]?.match(/(\d+) consecutive/)?.[1];
      const trendPrefix = periods
        ? `Sustained ${periods}-period trend detected. `
        : 'Sustained trend detected. ';
      const correlationSuffix = correlation
        ? ` Correlated signal: ${correlation.recommendation ?? ''}`
        : '';
      return _deduplicateSentences(`${trendPrefix}${base}${correlationSuffix}`.trim());
    }

    // ── Priority 4: Correlation context only → append hint ────────────────
    if (correlation && correlation.recommendation) {
      return _deduplicateSentences(`${base} Cross-metric context: ${correlation.recommendation}`);
    }

    // ── Fallback: base recommendation unchanged ───────────────────────────
    return base;
  } catch {
    return BASE_RECOMMENDATIONS[metric] ?? FALLBACK_RECOMMENDATION;
  }
}

/**
 * Enrich an array of insights with context-aware recommendation fields.
 *
 * Iterates over every insight and sets `insight.recommendation` using
 * buildRecommendation(), passing all sibling insights as context.
 *
 * This is the primary integration point for the recommendation engine.
 * Modifies insights in-place — returns the same array reference for fluent
 * chaining without allocation.
 *
 * @param insights - Insights array (anomaly + trend + correlation)
 * @returns        The same array with recommendation fields populated
 */
export function enrichWithRecommendations(insights: Insight[]): Insight[] {
  try {
    const context: RecommendationContext = { allInsights: insights };

    for (const insight of insights) {
      try {
        // Only add recommendation if not already populated (e.g. by correlationEngine)
        if (!insight.recommendation) {
          insight.recommendation = buildRecommendation(insight.metric, context);
        }
      } catch {
        // Per-insight errors must never abort enrichment
      }
    }

    return insights;
  } catch {
    return insights;
  }
}