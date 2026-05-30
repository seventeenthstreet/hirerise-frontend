

/**
 * @file features/onboarding/state/useOnboardingAnalytics.ts
 * @description React hook: onboarding analytics lifecycle ownership.
 *
 * PURPOSE:
 *  Owns the React lifecycle bridge between the onboarding analytics registry
 *  (onboardingAnalytics.ts) and the pages/components that need to trigger
 *  onboarding analytics exactly once per real user session.
 *
 * WHAT IT DOES:
 *  1. On mount: attempts to register this flow session via the registry.
 *     If registration succeeds (first mount for this key), dispatches:
 *       - trackPageView(PAGES.ONBOARDING)
 *       - trackEvent(EVENTS.ONBOARDING_STARTED, { variant })
 *       - funnelContract.start(FUNNELS.ONBOARDING, ...)
 *       - setFlowId(...)
 *       - setVariant(variant) on the useOnboarding hook
 *  2. On unmount (cleanup): unregisters the flow key.
 *     This ensures the next mount (e.g. after direction switch) is treated as
 *     a fresh session.
 *
 * WHAT IT DOES NOT DO:
 *  - Step tracking (that stays in useOnboarding / mutation callbacks)
 *  - Quota management (that is useQuota's job)
 *  - Routing (that is the page's job)
 *  - Progress restoration (that is the page's boot effect's job — isolated below)
 *
 * STRICTMODE SAFETY:
 *  StrictMode mounts components twice in development:
 *    mount → cleanup → mount
 *  Without the registry, both mounts would fire analytics.
 *  With the registry:
 *    mount 1 → register (fires analytics) → cleanup → unregister
 *    mount 2 → register (fires analytics — this is correct, simulates real lifecycle)
 *  The registry makes the behavior deterministic: exactly one fire per stable
 *  mount. In production (no StrictMode), only one mount occurs, so one fire.
 *
 * DEPENDENCY ARRAY RATIONALE:
 *  The effect depends on [variant, userId, ...stable fns].
 *  - variant: if the user switches direction, the variant changes → a new
 *    flow key is generated → analytics fire for the new variant correctly.
 *  - userId: included in the flow key for cross-user safety (see registry docs).
 *  - All function deps (trackEvent, trackPageView, etc.) are stable useCallback
 *    references from their respective hooks — safe to include.
 *
 *  This effect has NO eslint-disable exhaustive-deps suppression.
 *  Dependencies are explicit and correct.
 *
 * PRESERVED SEMANTICS:
 *  - ONBOARDING_STARTED fires with { variant } — unchanged
 *  - funnelContract.start fires with FUNNELS.ONBOARDING + 'page_loaded' — unchanged
 *  - FLOW_IDS are set correctly per variant — unchanged
 *  - setVariant is called on useOnboarding for hook-level variant tracking — unchanged
 *  - trackPageView(PAGES.ONBOARDING) fires on mount — unchanged
 */

import { useEffect } from 'react';
import { useAppContext, FLOW_IDS } from '@/context/AppContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { funnelContract, EVENTS, FUNNELS, PAGES } from '@/lib/analytics';
import {
  buildOnboardingFlowKey,
  registerOnboardingFlow,
  unregisterOnboardingFlow,
  type OnboardingVariant,
} from './onboardingAnalytics';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface UseOnboardingAnalyticsOptions {
  /**
   * The onboarding variant for this session.
   * Must be non-null before this hook is mounted — the hook will no-op
   * if variant is null (guards in the page ensure this never happens).
   */
  variant: OnboardingVariant;

  /**
   * Called once when analytics are successfully registered.
   * Pages use this to call setVariant() on useOnboarding, wiring the
   * variant into hook-level tracking.
   *
   * Kept as a callback (rather than calling setVariant directly) to preserve
   * the boundary: this hook owns analytics lifecycle; pages own hook wiring.
   */
  onVariantConfirmed: (variant: OnboardingVariant) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mount this hook inside a component that is only rendered when:
 *  1. The user is hydrated
 *  2. The user's variant (user_type) is confirmed
 *
 * This matches the existing pattern in both onboarding/page.tsx and
 * career/onboarding/page.tsx — the inner content component is only rendered
 * after guard checks pass.
 */
export function useOnboardingAnalytics({
  variant,
  onVariantConfirmed,
}: UseOnboardingAnalyticsOptions): void {
  const { user, setFlowId } = useAppContext();
  const { trackEvent, trackPageView } = useAnalytics();

  // userId is used as part of the flow key — falls back to a stable string
  // if the user object is somehow not available (shouldn't happen post-guard,
  // but defensive coding avoids silent key collisions).
  const userId = user?.id ?? 'anonymous';

  useEffect(() => {
    const flowKey = buildOnboardingFlowKey(variant, userId);

    // ── IDEMPOTENCY GATE ──────────────────────────────────────────────────────
    // registerOnboardingFlow returns true only if this is the first registration
    // for this flow key. If it returns false, analytics have already been fired
    // for this session — do nothing.
    const registered = registerOnboardingFlow(flowKey);
    if (!registered) return;

    // ── ANALYTICS DISPATCH ────────────────────────────────────────────────────
    // All four calls below are the exact semantics previously in the boot
    // useEffect in each page. They are now owned here, fired once, deterministically.

    // Page view — idempotent in useAnalytics (keyed on page path)
    trackPageView(PAGES.ONBOARDING);

    // Onboarding start event
    trackEvent(EVENTS.ONBOARDING_STARTED, { variant });

    // Funnel lifecycle — start fires exactly once per flow key registration
    funnelContract.start(FUNNELS.ONBOARDING, 'page_loaded', { variant });

    // Flow context — wires variant into the analytics envelope
    setFlowId(
      variant === 'student'
        ? FLOW_IDS.ONBOARDING_STUDENT
        : FLOW_IDS.ONBOARDING_PROFESSIONAL,
    );

    // ── HOOK WIRING ───────────────────────────────────────────────────────────
    // Notify the page so it can call setVariant() on useOnboarding.
    // This is NOT analytics — it is hook-level variant tracking.
    // Kept separate so this hook remains purely analytics-lifecycle-focused.
    onVariantConfirmed(variant);

    // ── CLEANUP ───────────────────────────────────────────────────────────────
    // Unregister on unmount. This ensures:
    //  - Direction switch → new mount → new flow key → fresh analytics
    //  - StrictMode: cleanup fires between double-mount, allowing second mount
    //    to re-register correctly (simulating real lifecycle)
    //  - Abandoned sessions don't leave stale keys in the registry forever
    return () => {
      unregisterOnboardingFlow(flowKey);
    };
  }, [variant, userId, trackEvent, trackPageView, setFlowId, onVariantConfirmed]);
  //   ^^^^^^^ explicit, complete, no suppression needed
  //
  // variant + userId → flow key identity (changes on direction switch)
  // trackEvent, trackPageView, setFlowId → stable useCallback refs
  // onVariantConfirmed → stable useCallback ref (caller must memoize)
}
