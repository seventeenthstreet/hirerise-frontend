/**
 * @file lib/actions/actionRateLimiter.ts
 * @description Per-channel rate limiter for action delivery.
 *
 * MIRRORS: lib/alertRateLimiter.ts — same fixed-window pattern, isolated scope.
 *
 * PURPOSE:
 *   Prevents a burst of insights from firing dozens of Slack messages,
 *   webhook POSTs, or internal job signals within a single polling window.
 *   This is the last line of defence before any outbound handler call.
 *
 * APPROACH — Fixed Window Counter:
 *   One counter per ActionChannel per 60-second window.
 *   When the limit is reached, the action is dropped for that window.
 *   Dropped actions are tracked via analytics.
 *
 * LIMITS:
 *   slack    — 5 / min  (Slack webhook; conservative self-limit)
 *   webhook  — 10 / min (generic; adjust per integration)
 *   internal — 20 / min (in-process signals; very cheap)
 *
 * SCOPE:
 *   Internal — consumed only by actionDispatcher.ts.
 *   Must NOT be imported by hooks, UI, or pages.
 */

import type { ActionChannel } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const WINDOW_MS = 60_000; // 1 minute

export const ACTION_CHANNEL_LIMITS: Record<ActionChannel, number> = {
  slack:    5,
  webhook:  10,
  internal: 20,
};

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW STATE
// ─────────────────────────────────────────────────────────────────────────────

interface WindowState {
  count:       number;
  windowStart: number;
}

const _windows = new Map<ActionChannel, WindowState>();

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true when the channel has exhausted its per-window limit.
 * Side-effect: increments the counter on each allowed call.
 */
export function isActionRateLimited(
  channel: ActionChannel,
  nowMs:   number = Date.now(),
): boolean {
  const limit = ACTION_CHANNEL_LIMITS[channel];
  let state   = _windows.get(channel);

  if (!state || nowMs - state.windowStart >= WINDOW_MS) {
    state = { count: 0, windowStart: nowMs };
    _windows.set(channel, state);
  }

  if (state.count >= limit) return true;

  state.count += 1;
  return false;
}

/** Flush all window state. For tests only. */
export function flushActionRateLimiter(): void {
  _windows.clear();
}