/**
 * @file lib/actions/actionRules.ts
 * @description Deterministic rule-based mapping: Insight → Action[].
 *
 * PURPOSE:
 *   Converts a scored, typed insight into zero or more concrete actions.
 *   Each rule is a pure function of insight fields — no side effects,
 *   no randomness, no external calls.
 *
 * RULE STRUCTURE:
 *   Each ActionRule has:
 *     - matches():  predicate — does this rule apply to the insight?
 *     - toActions(): factory — what actions should fire if it matches?
 *
 *   Rules are evaluated in order. Multiple rules can match one insight.
 *   This is intentional: a high-score anomaly can simultaneously trigger
 *   a Slack notify AND a scaling webhook.
 *
 * CURRENT RULES:
 *   1. High-score anomaly / risk  → Slack notify (ops channel)
 *   2. Latency anomaly            → Scaling webhook (infrastructure)
 *   3. Failure spike (high score) → Restart internal job
 *   4. Any critical-score insight → Webhook escalation
 *
 * SCORE THRESHOLDS:
 *   ≥ 80  → high severity (escalate)
 *   ≥ 60  → medium severity
 *   < 60  → low severity
 *
 * RULES:
 *   - Pure function — no imports from network, UI, or hooks
 *   - Deterministic: same insight → same actions, every time
 *   - Additive: new rules are appended — existing rules never modified
 *   - Never throws — errors caught by caller
 */

import type { Insight } from '@/lib/insights/types';
import type { Action, ActionSeverity } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derive ActionSeverity from insight score.
 * Mirrors the alert severity bands for operator familiarity.
 */
function _severityFromScore(score: number): ActionSeverity {
  if (score >= 80) return 'high';
  if (score >= 60) return 'medium';
  return 'low';
}

/**
 * Build a stable, deterministic Action ID.
 * Format: `${type}:${target}:${insightId}`
 */
function _actionId(type: string, target: string, insightId: string): string {
  return `${type}:${target}:${insightId}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE TYPE
// ─────────────────────────────────────────────────────────────────────────────

interface ActionRule {
  /** Human-readable label — used in dev logs only. */
  label: string;

  /**
   * Predicate: should this rule fire for the given insight?
   * Must never throw — errors are caught by mapInsightToActions().
   */
  matches: (insight: Insight) => boolean;

  /**
   * Factory: build the Action(s) this rule contributes.
   * Called only when matches() returns true.
   * Must never throw.
   */
  toActions: (insight: Insight) => Action[];
}

// ─────────────────────────────────────────────────────────────────────────────
// RULES
// ─────────────────────────────────────────────────────────────────────────────

const ACTION_RULES: ActionRule[] = [

  // ── Rule 1: High-score anomaly/risk → Slack notify ───────────────────────
  //
  // Any anomaly or risk insight scoring ≥ 70 warrants an immediate ops
  // notification. Threshold is deliberately lower than 80 (the 'high' severity
  // band) to catch medium-score anomalies early.
  {
    label: 'high-score-anomaly-risk-notify',
    matches: (i) =>
      (i.type === 'anomaly' || i.type === 'risk') && i.score >= 70,
    toActions: (i) => [{
      id:       _actionId('notify', 'ops-slack-channel', i.id),
      type:     'notify',
      severity: _severityFromScore(i.score),
      target:   'ops-slack-channel',
      payload:  {
        insightId:      i.id,
        insightType:    i.type,
        metric:         i.metric,
        message:        i.message,
        score:          i.score,
        recommendation: i.recommendation,
        currentValue:   i.context.currentValue,
        deviation:      i.context.deviation,
      },
    }],
  },

  // ── Rule 2: Latency anomaly → Scaling webhook ─────────────────────────────
  //
  // Processing latency anomalies indicate infrastructure saturation.
  // Trigger an external scaling webhook so infra systems can react
  // before the issue cascades to failure rates.
  {
    label: 'latency-anomaly-scale',
    matches: (i) =>
      i.type === 'anomaly' &&
      (i.metric === 'processing_p95_ms' || i.metric === 'processing_p99_ms'),
    toActions: (i) => [{
      id:       _actionId('scale', 'scaling-webhook', i.id),
      type:     'scale',
      severity: _severityFromScore(i.score),
      target:   'scaling-webhook',
      payload:  {
        insightId:    i.id,
        metric:       i.metric,
        currentValue: i.context.currentValue,
        zScore:       i.context.zScore,
        direction:    'up',
        reason:       'latency_anomaly',
      },
    }],
  },

  // ── Rule 3: Failure spike → Restart internal job ─────────────────────────
  //
  // A high-scoring failure-rate anomaly indicates the resume processor
  // job may be wedged. Signal an internal restart action so orchestration
  // layers (BullMQ, k8s) can act on it.
  {
    label: 'failure-spike-restart',
    matches: (i) =>
      i.type === 'anomaly' &&
      i.metric === 'resume_failure_rate' &&
      i.score >= 75,
    toActions: (i) => [{
      id:       _actionId('restart', 'resume-processor-job', i.id),
      type:     'restart',
      severity: _severityFromScore(i.score),
      target:   'resume-processor-job',
      payload:  {
        insightId:    i.id,
        metric:       i.metric,
        currentValue: i.context.currentValue,
        baselineValue: i.context.baselineValue,
        reason:       'failure_spike',
      },
    }],
  },

  // ── Rule 4: Any very high-score insight → Webhook escalation ─────────────
  //
  // Score ≥ 85 across any insight type is treated as critical-path signal.
  // Fire a generic webhook so external escalation systems (PagerDuty,
  // OpsGenie) can page an on-call responder.
  {
    label: 'critical-score-webhook-escalation',
    matches: (i) => i.score >= 85,
    toActions: (i) => [{
      id:       _actionId('webhook', 'escalation-webhook', i.id),
      type:     'webhook',
      severity: 'high',
      target:   'escalation-webhook',
      payload:  {
        insightId:   i.id,
        insightType: i.type,
        metric:      i.metric,
        message:     i.message,
        score:       i.score,
        severity:    i.severity,
        context:     i.context,
      },
    }],
  },

  // ── Rule 5: Sustained downward trend + medium-high score → Notify ─────────
  //
  // Trends are lower urgency than anomalies but persistent downward trends
  // on key funnel metrics deserve awareness before they become anomalies.
  {
    label: 'downward-trend-notify',
    matches: (i) =>
      i.type === 'trend' &&
      i.score >= 65 &&
      i.message.toLowerCase().includes('declining'),
    toActions: (i) => [{
      id:       _actionId('notify', 'ops-slack-channel', i.id),
      type:     'notify',
      severity: _severityFromScore(i.score),
      target:   'ops-slack-channel',
      payload:  {
        insightId:          i.id,
        insightType:        i.type,
        metric:             i.metric,
        message:            i.message,
        score:              i.score,
        consecutivePeriods: i.context.consecutivePeriods,
        recommendation:     i.recommendation,
      },
    }],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map a single insight to zero or more actions by evaluating all rules.
 *
 * Multiple rules can match — all matching actions are returned.
 * Rule evaluation is independent; one rule's output never gates another.
 *
 * @param insight - A scored insight from the insight pipeline.
 * @returns       Array of actions (may be empty if no rules match).
 */
export function mapInsightToActions(insight: Insight): Action[] {
  const actions: Action[] = [];

  for (const rule of ACTION_RULES) {
    try {
      if (!rule.matches(insight)) continue;
      const ruleActions = rule.toActions(insight);
      actions.push(...ruleActions);
    } catch {
      // Per-rule errors must never abort the mapping loop
      continue;
    }
  }

  return actions;
}

/**
 * Map an array of insights to a flat list of actions.
 *
 * Applies mapInsightToActions() to every insight and merges the results.
 * Order: actions are emitted in insight order, then rule order within each insight.
 *
 * @param insights - Scored insights from the insight pipeline.
 * @returns        Flat array of actions across all insights and rules.
 */
export function mapInsightsToActions(insights: Insight[]): Action[] {
  const all: Action[] = [];

  for (const insight of insights) {
    try {
      all.push(...mapInsightToActions(insight));
    } catch {
      continue;
    }
  }

  return all;
}