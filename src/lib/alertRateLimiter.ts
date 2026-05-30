/**
 * @file lib/alertRateLimiter.ts
 * @description Per-channel rate limiter for alert delivery.
 *
 * PURPOSE:
 *   External channels (Slack, email, webhook) have their own rate limits and
 *   cost functions. A single spike in metric violations should not be able
 *   to fire dozens of HTTP requests in a single minute. This layer provides
 *   a last line of defense before any outbound call is made.
 *
 * APPROACH — Fixed Window Counter:
 *   A simple, predictable counter per channel per 60-second window.
 *   Chosen over token bucket because:
 *     1. Alert volumes are low (< 20 rules) — bucket smoothing unnecessary.
 *     2. Fixed windows are easier to reason about in logs and tests.
 *     3. No fractional-token state to serialize or debug.
 *
 * LIMITS (configurable via CHANNEL_LIMITS):
 *   Slack   — 5 alerts/min  (Slack webhook limit is generous, but we self-limit)
 *   email   — 3 alerts/min  (email is expensive and disruptive at high volume)
 *   webhook — 10 alerts/min (generic — adjust per integration)
 *
 * BEHAVIOR ON LIMIT REACHED:
 *   The alert is DROPPED for this window, not queued. Dropped alerts are
 *   logged via analytics so operators can see if rate limiting is too aggressive.
 *   Future: replace drop with a delayed queue (Redis/BullMQ) when needed.
 *
 * SCOPE:
 *   Internal — consumed only by alertDispatcher.ts and channel implementations.
 *   Must NOT be imported by hooks, UI, or pages.
 */

// ─────────────────────────────────────────────────────────────────────────────
// CHANNEL TYPE
// ─────────────────────────────────────────────────────────────────────────────

export type AlertChannel = 'slack' | 'email' | 'webhook';

// ─────────────────────────────────────────────────────────────────────────────
// RATE LIMIT CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

/** Window duration in ms. All counters reset after one full window. */
const WINDOW_MS = 60_000; // 1 minute

/**
 * Maximum alerts allowed per channel per window.
 *
 * These are deliberately conservative. The dedup layer should prevent most
 * repeated alerts from reaching here; rate limiting is a final safety net
 * against dedup bypass (e.g. a bug producing subtly different alert.id values).
 */
export const CHANNEL_LIMITS: Record<AlertChannel, number> = {
  slack:   5,
  email:   3,
  webhook: 10,
};

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW STATE
// ─────────────────────────────────────────────────────────────────────────────

interface WindowState {
  /** Number of alerts dispatched in the current window. */
  count:       number;
  /** Start timestamp of the current window (ms). */
  windowStart: number;
}

/**
 * Per-channel counter state.
 * Module-scoped singleton — one counter per channel per page load.
 */
const _windows = new Map<AlertChannel, WindowState>();

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check whether a delivery attempt for the given channel is within rate limits.
 *
 * Side-effect: if the check passes (not limited), the channel counter is
 * incremented atomically within this call. The caller must NOT call this
 * multiple times per delivery — call once, act on the result.
 *
 * Window rollover: if the current time is outside the recorded window,
 * the counter resets automatically before the check. No timer is required.
 *
 * @param channel - The target delivery channel.
 * @param now     - Optional time override for deterministic tests.
 * @returns true  → rate limit exceeded; DROP the alert.
 *          false → within limit; proceed with delivery.
 */
export function isRateLimited(
  channel: AlertChannel,
  now: number = Date.now(),
): boolean {
  const limit = CHANNEL_LIMITS[channel];
  let state   = _windows.get(channel);

  // Initialize or roll over the window.
  if (!state || now - state.windowStart >= WINDOW_MS) {
    state = { count: 0, windowStart: now };
    _windows.set(channel, state);
  }

  if (state.count >= limit) {
    // Limit reached — do NOT increment (counter would overflow meaninglessly).
    return true;
  }

  // Within limit — consume one slot.
  state.count += 1;
  return false;
}

/**
 * Returns the current counter state for a channel.
 * Intended for diagnostics, logging, and tests only.
 *
 * @param channel - The channel to inspect.
 * @param now     - Optional time override.
 */
export function getRateLimitState(
  channel: AlertChannel,
  now: number = Date.now(),
): { count: number; remaining: number; windowStart: number } {
  const state   = _windows.get(channel);
  const limit   = CHANNEL_LIMITS[channel];

  if (!state || now - state.windowStart >= WINDOW_MS) {
    return { count: 0, remaining: limit, windowStart: now };
  }

  return {
    count:       state.count,
    remaining:   Math.max(0, limit - state.count),
    windowStart: state.windowStart,
  };
}

/**
 * Reset all channel counters.
 * For unit tests and manual operator resets only.
 * Must NOT be called automatically — that would defeat rate limiting.
 */
export function resetRateLimits(): void {
  _windows.clear();
}