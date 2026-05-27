/**
 * @file lib/actions/types.ts
 * @description Shared type definitions for the Action Engine.
 *
 * DESIGN:
 *   Action is the output of the action rules engine — a structured instruction
 *   for what automation should occur in response to an insight.
 *
 *   ActionType maps to a handler:
 *     'notify'  → slackAction.ts  (human notification)
 *     'webhook' → webhookAction.ts (external system trigger)
 *     'scale'   → internalAction.ts (infra scaling hint)
 *     'restart' → internalAction.ts (job restart hint)
 *
 *   ActionChannel mirrors AlertChannel — used for rate limiting.
 *
 * RULES:
 *   - No imports from React, hooks, UI, or pages
 *   - Pure type definitions — zero runtime cost
 *   - Additive only — no existing types modified
 */

// ─────────────────────────────────────────────────────────────────────────────
// CORE ACTION TYPE
// ─────────────────────────────────────────────────────────────────────────────

/** Discriminant for what the action does and which handler receives it. */
export type ActionType = 'notify' | 'scale' | 'restart' | 'webhook';

/**
 * Severity of the action — derived from the triggering insight.
 * Drives dedup cooldown windows (mirrors alert severity pattern).
 */
export type ActionSeverity = 'low' | 'medium' | 'high';

/**
 * Channel label used by the rate limiter.
 * One channel per handler so limits are isolated per delivery path.
 */
export type ActionChannel = 'slack' | 'webhook' | 'internal';

/**
 * A single action produced by the action rules engine.
 *
 * Required fields are frozen — never rename or remove them.
 * Optional fields (payload) are additive.
 */
export interface Action {
  /**
   * Stable dedup key: `${type}:${target}:${insightId}`.
   * Constructed by actionRules.ts — deterministic given same inputs.
   */
  id: string;

  /** What kind of automation this action triggers. */
  type: ActionType;

  /** Severity of the originating insight — controls cooldown window. */
  severity: ActionSeverity;

  /**
   * Named destination for the action.
   * Examples: 'ops-slack-channel', 'scaling-webhook', 'resume-processor-job'
   */
  target: string;

  /**
   * Structured context payload forwarded to the handler.
   * Handlers must treat this as read-only — no mutation.
   */
  payload?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION RESULT (internal — not exported from the layer)
// ─────────────────────────────────────────────────────────────────────────────

/** Internal outcome from the dispatcher — used for analytics only. */
export interface ActionResult {
  action:   Action;
  success:  boolean;
  attempts: number;
  error?:   unknown;
}