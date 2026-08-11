/**
 * @file features/onboarding/state/onboardingAnalytics.ts
 * @description Onboarding analytics registry — pure utilities, no React.
 *
 * Exports:
 *  - OnboardingVariant       — union type for onboarding user variants
 *  - buildOnboardingFlowKey  — deterministic key builder for flow sessions
 *  - registerOnboardingFlow  — idempotency gate: registers a flow key once
 *  - unregisterOnboardingFlow — removes a flow key from the registry
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type OnboardingVariant = 'student' | 'professional';

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Module-level set acting as the onboarding flow registry.
 * Keys are unique per (variant, userId) pair for the lifetime of the session.
 */
const activeFlowKeys = new Set<string>();

/**
 * Builds a deterministic registry key for a given variant + userId pair.
 * Used to prevent duplicate analytics fires across mounts.
 */
export function buildOnboardingFlowKey(
  variant: OnboardingVariant,
  userId: string,
): string {
  return `onboarding:${variant}:${userId}`;
}

/**
 * Attempts to register a flow key in the registry.
 * Returns true if this is the first registration (caller should fire analytics).
 * Returns false if the key was already registered (caller should no-op).
 */
export function registerOnboardingFlow(flowKey: string): boolean {
  if (activeFlowKeys.has(flowKey)) return false;
  activeFlowKeys.add(flowKey);
  return true;
}

/**
 * Removes a flow key from the registry.
 * Called on component unmount so that a future remount (e.g. direction switch)
 * is treated as a fresh session.
 */
export function unregisterOnboardingFlow(flowKey: string): void {
  activeFlowKeys.delete(flowKey);
}