/**
 * @file lib/actions/actionDedupStore.ts
 * @description In-memory deduplication store for the Action Engine.
 *
 * MIRRORS: lib/alertDedupStore.ts — same pattern, isolated scope.
 *
 * PURPOSE:
 *   Prevents the same action from being dispatched repeatedly within its
 *   cooldown window. An action fired from a latency anomaly should not
 *   re-fire every polling cycle while the anomaly persists.
 *
 * SEVERITY-BASED COOLDOWNS:
 *   high   — 10 min  (high-severity conditions need fast re-action loops)
 *   medium — 20 min
 *   low    — 30 min
 *
 * SCOPE:
 *   Internal — consumed only by actionDispatcher.ts.
 *   Must NOT be imported by hooks, UI, or pages.
 */

import type { Action, ActionSeverity } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// COOLDOWN CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

export const ACTION_COOLDOWN_MS: Record<ActionSeverity, number> = {
  high:   10 * 60_000,  // 10 min
  medium: 20 * 60_000,  // 20 min
  low:    30 * 60_000,  // 30 min
};

// ─────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────

/** key → timestamp of last dispatch */
const _store = new Map<string, number>();

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true when this action was already dispatched within its cooldown.
 * Side-effect: on first occurrence, records the timestamp.
 */
export function isActionDuplicate(action: Action, nowMs: number = Date.now()): boolean {
  const cooldown = ACTION_COOLDOWN_MS[action.severity];
  const lastSeen = _store.get(action.id);

  if (lastSeen !== undefined && nowMs - lastSeen < cooldown) {
    return true;
  }

  _store.set(action.id, nowMs);
  return false;
}

/** Force-clear the store. For tests and explicit operator resets only. */
export function flushActionDedupStore(): void {
  _store.clear();
}

/** Diagnostic: number of tracked keys. */
export function actionDedupStoreSize(): number {
  return _store.size;
}