/**
 * @file features/onboarding/state/onboardingAnalytics.ts
 * @description Onboarding analytics lifecycle ownership module.
 *
 * PURPOSE:
 *  This module is the single owner of onboarding analytics idempotency.
 *  It does NOT dispatch events itself — it tracks whether they have been
 *  dispatched for a given flow session, and provides a clean register/
 *  unregister API for useOnboardingAnalytics to call.
 *
 * WHY A MODULE-LEVEL REGISTRY:
 *  React effects can re-fire for reasons unrelated to user intent:
 *    - StrictMode double-invocation (mount → unmount → mount)
 *    - Fast Refresh in development
 *    - Concurrent Mode speculative renders
 *
 *  An in-component ref or state flag is reset on every remount, so it
 *  cannot guard against StrictMode double-fire. A module-level Set persists
 *  across remounts within the same page session, making idempotency truly
 *  mount-count-independent.
 *
 * FLOW KEY DESIGN:
 *  Each flow session is identified by:
 *    `${variant}:${userId}`
 *  This ensures:
 *    - Different users on the same device don't share flow state
 *    - The same user restarting after clearing direction gets a fresh key
 *      (user_type is reset → variant changes → key changes)
 *    - Legitimate re-onboarding (after a direction switch) fires correctly
 *
 * CLEANUP CONTRACT:
 *  unregisterOnboardingFlow() removes the key from the registry.
 *  This is called by the effect cleanup in useOnboardingAnalytics.
 *  On a real navigation away, cleanup fires once — the flow is deregistered
 *  and the next mount (e.g. after direction switch) fires fresh analytics.
 *
 *  In StrictMode, the sequence is:
 *    mount → register (fires analytics) → cleanup → unregister → mount → register
 *  Because cleanup fires between the two mounts, the second mount sees no
 *  existing registration and fires again — this is CORRECT for StrictMode,
 *  which simulates real component lifecycles. The key property is that
 *  within a single stable mount (real user session), the event fires once.
 *
 * IMPORTANT:
 *  This module contains NO React, NO hooks, NO JSX.
 *  It is pure lifecycle infrastructure — a stable registry.
 *  All React integration is in useOnboardingAnalytics.ts.
 *
 * NOT RESPONSIBLE FOR:
 *  - Dispatching events (that is the analytics lib's job)
 *  - Routing (that is the page's job)
 *  - Quota management (that is useQuota's job)
 *  - Onboarding step logic (that is useOnboarding's job)
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type OnboardingVariant = 'student' | 'professional';

/**
 * Uniquely identifies one user's onboarding analytics session.
 * Format: `${variant}:${userId}`
 *
 * WHY include userId: prevents cross-user collisions if the same browser
 * session is used by two different accounts (rare but possible on shared devices).
 *
 * WHY include variant: if a user switches direction mid-onboarding,
 * their variant changes (student → professional or vice versa), and the
 * analytics start event for the new flow should fire fresh.
 */
export type OnboardingFlowKey = `${OnboardingVariant}:${string}`;

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Module-level set of currently active onboarding analytics sessions.
 *
 * A key is present in this set if and only if:
 *  1. The onboarding analytics start events have been dispatched for this session
 *  2. The component that dispatched them is still mounted
 *
 * Cleanup removes the key — ensuring the next mount (post-navigation or
 * post-direction-switch) fires fresh analytics.
 *
 * This is intentionally NOT exported — all access is through the public API
 * below. Direct mutation from outside this module would break idempotency.
 */
const activeOnboardingFlows = new Set<OnboardingFlowKey>();

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the canonical flow key for a given variant + userId combination.
 *
 * Exported so useOnboardingAnalytics can construct the key from React context
 * values and pass it to register/unregister consistently.
 */
export function buildOnboardingFlowKey(
  variant: OnboardingVariant,
  userId: string,
): OnboardingFlowKey {
  return `${variant}:${userId}`;
}

/**
 * Attempt to register an onboarding analytics session.
 *
 * Returns true  → this is the first registration for this key; caller
 *                 SHOULD dispatch start analytics.
 * Returns false → a session is already active for this key; caller
 *                 MUST NOT dispatch start analytics (idempotency guard).
 *
 * This is the core idempotency primitive. It is safe to call multiple times
 * with the same key — only the first call returns true.
 */
export function registerOnboardingFlow(key: OnboardingFlowKey): boolean {
  if (activeOnboardingFlows.has(key)) {
    return false; // already registered — idempotency guard
  }
  activeOnboardingFlows.add(key);
  return true;
}

/**
 * Unregister an onboarding analytics session.
 *
 * Called by the effect cleanup in useOnboardingAnalytics (i.e. on unmount).
 * After unregistering, the next mount with the same key will be treated as
 * a fresh session and will fire analytics again.
 *
 * WHY this is correct:
 *  Real unmount = user navigated away. If they return to onboarding (e.g.
 *  after a direction switch), that is a new session and should fire fresh.
 *  StrictMode double-mount is handled correctly because cleanup fires between
 *  the two mounts, resetting the key for the second mount.
 */
export function unregisterOnboardingFlow(key: OnboardingFlowKey): void {
  activeOnboardingFlows.delete(key);
}

/**
 * Check whether a flow key is currently registered.
 * Exposed for testing and debugging only — not used in production paths.
 */
export function isOnboardingFlowActive(key: OnboardingFlowKey): boolean {
  return activeOnboardingFlows.has(key);
}

/**
 * Clear all active flow registrations.
 * FOR TESTING ONLY — never call in production code.
 * Exposed so test suites can reset state between test cases.
 */
export function _resetOnboardingFlowRegistry_TEST_ONLY(): void {
  activeOnboardingFlows.clear();
}
