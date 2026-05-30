/**
 * @file lib/actions/actionEngine.ts
 * @description Action engine orchestration — converts insights into dispatched actions.
 *
 * POSITION IN THE PIPELINE:
 *
 *   Insight Engine → Insight[]
 *           ↓
 *   Action Engine  ← YOU ARE HERE
 *           ↓
 *   actionRules  →  Action[]
 *           ↓
 *   actionDispatcher  →  Handlers (Slack / Webhook / Internal)
 *
 * RESPONSIBILITIES:
 *   1. Filter insights to only actionable ones (score threshold + type gate).
 *   2. Map actionable insights → Action[] via actionRules.
 *   3. Hand off to actionDispatcher (fire-and-forget, no await).
 *
 * ACTIONABILITY FILTER:
 *   An insight is actionable when:
 *     - score ≥ ACTION_SCORE_THRESHOLD (60)
 *     - type is in ACTIONABLE_TYPES ('anomaly', 'risk', 'trend', 'opportunity')
 *   This filter is intentionally permissive — the rules engine applies
 *   finer-grained predicates. The threshold prevents ultra-low-score
 *   informational insights from triggering automation.
 *
 * GUARANTEES:
 *   - executeActions() NEVER throws.
 *   - Returns void — fire-and-forget by design.
 *   - Zero impact on the insight pipeline (this is called after insights are returned).
 *   - System works correctly if this entire module is never called (actions are optional).
 *
 * RULES:
 *   - No imports from React, hooks, UI, or pages
 *   - No imports from alert system
 *   - Deterministic (same insights → same actions)
 *   - No randomness
 */

import type { Insight } from '@/lib/insights/types';
import type { MetricsMeta } from '@/types/internal/mappedMetrics';

import { mapInsightsToActions } from './actionRules';
import { dispatchActions }      from './actionDispatcher';
import { isDevelopment }        from '@/lib/utils/env';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimum insight score required for an insight to trigger action evaluation.
 *
 * Insights below this threshold are considered informational and not worthy
 * of automated action. The rules engine applies additional predicates on top
 * of this gate.
 *
 * Threshold rationale: 60 = bottom of the 'medium' severity band. Insights
 * below 60 are low-priority observations — surface them in the UI but don't
 * trigger automation.
 */
const ACTION_SCORE_THRESHOLD = 60;

/**
 * Insight types that are eligible for action evaluation.
 *
 * 'anomaly' and 'risk' are primary — they represent deviations from expected
 * state and warrant immediate attention.
 *
 * 'trend' is included so sustained directional movements trigger notifications
 * before they escalate to anomalies.
 *
 * 'opportunity' is included for forward-looking automation (e.g. scale-up
 * before anticipated load). Rules engine filters to specific opportunity types.
 */
const ACTIONABLE_TYPES = new Set<Insight['type']>(['anomaly', 'risk', 'trend', 'opportunity']);

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true when an insight should be evaluated for action.
 * @internal
 */
function _isActionable(insight: Insight): boolean {
  return (
    ACTIONABLE_TYPES.has(insight.type) &&
    insight.score >= ACTION_SCORE_THRESHOLD
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Execute the action pipeline for a set of insights.
 *
 * Pipeline:
 *   1. Filter insights to actionable subset.
 *   2. Map actionable insights → Action[] via rules engine.
 *   3. Fire-and-forget: void dispatchActions(actions, meta).
 *
 * This function is SYNCHRONOUS and returns immediately — dispatch is async
 * and fire-and-forget. The caller never awaits this.
 *
 * @param insights - Scored, prioritised insights from the insight pipeline.
 * @param meta     - Pipeline metadata for suppression gate.
 */
export function executeActions(
  insights: Insight[],
  meta:     MetricsMeta,
): void {
  try {
    if (insights.length === 0) return;

    // ── Step 1: Filter to actionable insights ─────────────────────────────
    const actionable = insights.filter(_isActionable);

    if (actionable.length === 0) {
      if (isDevelopment) {
        console.debug(
          `[actionEngine] ${insights.length} insight(s) evaluated — none met actionability threshold (score ≥ ${ACTION_SCORE_THRESHOLD}).`,
        );
      }
      return;
    }

    if (isDevelopment) {
      console.debug(
        `[actionEngine] ${actionable.length}/${insights.length} insight(s) are actionable.`,
      );
    }

    // ── Step 2: Map insights → actions ────────────────────────────────────
    const actions = mapInsightsToActions(actionable);

    if (actions.length === 0) {
      if (isDevelopment) {
        console.debug('[actionEngine] Rules engine produced 0 actions — no rules matched.');
      }
      return;
    }

    if (isDevelopment) {
      console.debug(
        `[actionEngine] ${actions.length} action(s) produced → dispatching.`,
        actions.map(a => `${a.type}:${a.target}`),
      );
    }

    // ── Step 3: Fire-and-forget dispatch ─────────────────────────────────
    // void = intentional fire-and-forget; dispatchActions never throws.
    void dispatchActions(actions, meta);

  } catch {
    // Absolute safety net — the engine never propagates throws to the caller.
  }
}