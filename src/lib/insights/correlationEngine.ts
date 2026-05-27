/**
 * @file lib/insights/correlationEngine.ts
 * @description Rule-based cross-metric correlation detection.
 *
 * PURPOSE:
 *   Combines signals across multiple metrics to surface composite patterns
 *   that single-metric detectors cannot see in isolation.
 *
 * EXAMPLES:
 *   ↓ conversion + ↑ latency    → performance degradation affecting conversion
 *   ↑ errors     + ↑ retries    → reliability issue amplified by retry storm
 *   ↓ onboarding + ↓ conversion → funnel-wide drop; systemic problem
 *   ↑ failure    + ↑ timeout    → processing pipeline at risk
 *
 * DESIGN:
 *   - Pure rule-based (no ML) — deterministic, auditable, zero latency cost
 *   - Each rule has a fixed confidence value declared in the rule definition
 *   - Outputs type: 'correlation', metric: 'composite' insights
 *   - Optional — only emits when all conditions in a rule are satisfied
 *   - All rules are independent — one rule's output never gates another
 *
 * RULES:
 *   - No throw propagation — returns empty array on any error
 *   - No imports from React, hooks, UI, or alert system
 *   - Additive only — does not modify existing detectors
 *   - No randomness
 */

import type { Insight, InsightMetricsInput } from './insightTypes';

// ─────────────────────────────────────────────────────────────────────────────
// CONDITION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true when a metric's current value is above its historical mean
 * by at least `margin` (relative), or simply above a static `threshold`.
 */
function isElevated(
  value:     number | null,
  history:   number[],
  threshold: number,
  margin:    number = 0.10,
): boolean {
  if (value === null) return false;
  if (value > threshold) return true;
  if (history.length >= 3) {
    const avg = history.reduce((s, v) => s + v, 0) / history.length;
    return value > avg * (1 + margin);
  }
  return false;
}

/**
 * Returns true when a metric's current value is below its historical mean
 * by at least `margin` (relative), or simply below a static `threshold`.
 */
function isDepressed(
  value:     number | null,
  history:   number[],
  threshold: number,
  margin:    number = 0.10,
): boolean {
  if (value === null) return false;
  if (value < threshold) return true;
  if (history.length >= 3) {
    const avg = history.reduce((s, v) => s + v, 0) / history.length;
    return value < avg * (1 - margin);
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// CORRELATION RULE TYPE
// ─────────────────────────────────────────────────────────────────────────────

interface CorrelationRule {
  /** Stable unique identifier for this correlation pattern. */
  id:         string;

  /**
   * Group identifier for overlap control.
   *
   * Multiple rules that diagnose the same root concern (e.g. "reliability")
   * share a groupId. After rule evaluation, only the highest-scored insight
   * per group is kept — this prevents redundant signals from separate rules
   * that share a common cause from all firing simultaneously.
   *
   * Groups: "performance" | "reliability" | "funnel"
   */
  groupId:    string;

  /** Human-readable description emitted as Insight.message. */
  message:    string;

  /**
   * Fixed confidence for this rule (0–1).
   * Rule confidence is declared statically — it reflects the strength of
   * the domain logic, not a probabilistic estimate.
   */
  confidence: number;

  /**
   * Numeric relevance score (0–100).
   * Used for ranking relative to single-metric insights.
   * Correlations are generally higher value, so 60–90 range is appropriate.
   */
  score:      number;

  /**
   * Condition function: receives current metrics + history.
   * Returns true when all signals in the pattern are simultaneously present.
   * Must never throw — errors are caught by the engine.
   */
  condition: (metrics: InsightMetricsInput, history: Record<string, number[]>) => boolean;

  /**
   * Driver labels included in the Insight.drivers field.
   * Descriptive multi-signal labels, e.g. ['conversion_rate↓', 'latency↑'].
   */
  drivers:    string[];

  /**
   * Context-enriched recommendation for this correlation pattern.
   * More specific than generic per-metric recommendations.
   */
  recommendation: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CORRELATION RULES
// ─────────────────────────────────────────────────────────────────────────────

const CORRELATION_RULES: CorrelationRule[] = [
  // ── Performance → Conversion ──────────────────────────────────────────────
  {
    id:         'perf-latency-conversion-drop',
    groupId:    'performance',
    message:    'Conversion drop co-occurring with elevated latency — performance likely degrading user experience',
    confidence: 0.80,
    score:      85,
    drivers:    ['end_to_end_conversion_rate↓', 'processing_p95_ms↑'],
    recommendation:
      'Investigate processing infrastructure. Check p95/p99 latency for outlier jobs, review queue depth, and consider circuit-breaker thresholds.',
    condition: (m, h) => {
      const conversion = m.resumeFunnel?.end_to_end_conversion_rate ?? null;
      const latency    = m.performance?.processing_p95_ms ?? null;
      return (
        isDepressed(conversion, h['end_to_end_conversion_rate'] ?? [], 0.65) &&
        isElevated(latency,    h['processing_p95_ms']            ?? [], 25_000)
      );
    },
  },

  // ── Errors + Retries → Reliability Storm ─────────────────────────────────
  {
    id:         'error-retry-reliability-storm',
    groupId:    'reliability',
    message:    'Elevated errors and high retry attempts signal a reliability storm — retries may be amplifying failures',
    confidence: 0.85,
    score:      90,
    drivers:    ['resume_failure_rate↑', 'avg_attempts_per_resume↑'],
    recommendation:
      'Check for cascading retry loops. Review retry back-off configuration, downstream service health, and consider temporary rate-limiting of retry queues.',
    condition: (m, h) => {
      const failureRate = m.reliability?.resume_failure_rate ?? null;
      const avgAttempts = m.performance?.avg_attempts_per_resume ?? null;
      return (
        isElevated(failureRate, h['resume_failure_rate']      ?? [], 0.08) &&
        isElevated(avgAttempts, h['avg_attempts_per_resume']   ?? [], 2.5)
      );
    },
  },

  // ── Failures + Timeouts → Pipeline at Risk ─────────────────────────────
  {
    id:         'failure-timeout-pipeline-risk',
    groupId:    'reliability',
    message:    'Concurrent rise in failure rate and timeout rate — processing pipeline may be under severe stress',
    confidence: 0.82,
    score:      88,
    drivers:    ['resume_failure_rate↑', 'timeout_rate↑'],
    recommendation:
      'Escalate to infrastructure team. Check worker capacity, memory pressure, and external dependency SLAs. Consider activating runbook for pipeline overload.',
    condition: (m, h) => {
      const failureRate = m.reliability?.resume_failure_rate ?? null;
      const timeoutRate = m.reliability?.timeout_rate ?? null;
      return (
        isElevated(failureRate, h['resume_failure_rate'] ?? [], 0.07) &&
        isElevated(timeoutRate, h['timeout_rate']        ?? [], 0.07)
      );
    },
  },

  // ── Onboarding + Conversion Funnel Drop ────────────────────────────────
  {
    id:         'funnel-wide-drop',
    groupId:    'funnel',
    message:    'Both onboarding completion and end-to-end conversion are depressed — systemic funnel issue suspected',
    confidence: 0.75,
    score:      78,
    drivers:    ['onboarding_completion_rate↓', 'end_to_end_conversion_rate↓'],
    recommendation:
      'Review the full user journey for regressions. Check for UX/copy changes, backend validations, or A/B variants that affect both onboarding and resume submission steps.',
    condition: (m, h) => {
      const onboarding = m.onboarding?.onboarding_completion_rate ?? null;
      const conversion = m.resumeFunnel?.end_to_end_conversion_rate ?? null;
      return (
        isDepressed(onboarding, h['onboarding_completion_rate']      ?? [], 0.50) &&
        isDepressed(conversion, h['end_to_end_conversion_rate']      ?? [], 0.60)
      );
    },
  },

  // ── Upload Failures → Funnel Entry Blocked ─────────────────────────────
  {
    id:         'upload-failure-funnel-entry',
    groupId:    'funnel',
    message:    'Low upload success rate is blocking funnel entry — downstream conversion drop is expected',
    confidence: 0.78,
    score:      80,
    drivers:    ['upload_success_rate↓', 'end_to_end_conversion_rate↓'],
    recommendation:
      'Check client-side upload flow, file validation, and CDN/presigned URL infrastructure. High upload failures directly block the resume processing pipeline.',
    condition: (m, h) => {
      const uploadRate = m.resumeFunnel?.upload_success_rate ?? null;
      const conversion = m.resumeFunnel?.end_to_end_conversion_rate ?? null;
      return (
        isDepressed(uploadRate, h['upload_success_rate']           ?? [], 0.88) &&
        isDepressed(conversion, h['end_to_end_conversion_rate']    ?? [], 0.65)
      );
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// GROUP DEDUPLICATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Priority weight per group — used only to break ties when two insights in
 * the same group have equal score.
 *
 * Higher value = preferred. All current groups are "high priority" relative
 * to hypothetical future groups that may have lower weights.
 *
 * This is a tie-break mechanism only — it never overrides score ordering.
 */
const GROUP_PRIORITY = {
  reliability: 3,
  performance: 3,
  funnel:      2,
} as const;

type KnownGroup = keyof typeof GROUP_PRIORITY;

/**
 * Within correlation outputs, keep only the highest-scored insight per groupId.
 *
 * Problem: Two rules in the same group (e.g. "reliability") may both fire
 * for the same underlying root cause, producing redundant signals.
 * Solution: After rule evaluation, group results by rule.groupId and retain
 * only the winner (highest score) per group.
 *
 * Winner selection — fully deterministic, three-level comparator:
 *   1. score DESC          — primary: highest raw rule score wins
 *   2. GROUP_PRIORITY DESC — secondary: breaks equal-score ties by group weight
 *   3. original index ASC  — tertiary: first-defined rule wins on complete ties
 *
 * Rules:
 *   - Does not change score values — only filters which insights survive
 *   - Applied only to correlation outputs — no effect on anomaly/trend
 *
 * @internal
 */
function _deduplicateByGroup(
  pairs: Array<{ insight: Insight; groupId: string; index: number }>,
): Insight[] {
  const best = new Map<string, { insight: Insight; score: number; priority: number; index: number }>();

  for (const { insight, groupId, index } of pairs) {
    const existing = best.get(groupId);
    const priority = GROUP_PRIORITY[groupId as KnownGroup] ?? 0;

    const isBetter = !existing
      || insight.score > existing.score
      || (insight.score === existing.score && priority > existing.priority)
      || (insight.score === existing.score && priority === existing.priority && index < existing.index);

    if (isBetter) {
      best.set(groupId, { insight, score: insight.score, priority, index });
    }
  }

  return Array.from(best.values()).map(e => e.insight);
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluate all correlation rules against a metrics snapshot.
 *
 * Rules are independent — multiple correlation insights can fire in one cycle.
 * Output type is always 'correlation', metric is always 'composite'.
 *
 * @returns Array of correlation Insights (empty if no patterns matched or on error).
 */
export function detectCorrelations(metrics: InsightMetricsInput): Insight[] {
  try {
    const now     = metrics.nowMs ?? Date.now();
    const history = metrics.history ?? {};
    const pairs: Array<{ insight: Insight; groupId: string; index: number }> = [];

    for (let ruleIndex = 0; ruleIndex < CORRELATION_RULES.length; ruleIndex++) {
      const rule = CORRELATION_RULES[ruleIndex];
      try {
        if (!rule.condition(metrics, history)) continue;

        pairs.push({
          groupId: rule.groupId,
          index:   ruleIndex,
          insight: {
            type:           'correlation',
            metric:         'composite',
            message:        rule.message,
            score:          rule.score,
            firedAt:        now,
            // Correlation insights intentionally omit severity — they synthesize
            // across multiple metrics that may have differing severity levels.
            reasonType:     'correlation',
            confidence:     rule.confidence,
            drivers:        rule.drivers,
            recommendation: rule.recommendation,
          },
        });
      } catch {
        // Per-rule errors must never abort the engine
        continue;
      }
    }

    // Keep only the highest-scored insight per group to prevent same-root
    // duplicate signals from reaching downstream stages.
    return _deduplicateByGroup(pairs);
  } catch {
    return [];
  }
}