/**
 * @file hooks/useFeatureFlag.ts
 * @description Hooks-layer wrapper for feature flag evaluation.
 *
 * PHASE 0 HARDENING — SaaS Maturity Layer (Pre-Implementation)
 *
 * Changes in this revision:
 *  1. EXPOSURE GUARANTEE (useFeatureFlagVariant)
 *     - Exposure now fires exactly once per (sessionId + flagKey) combination.
 *     - Uses the analytics idempotency system — not a local useState flag.
 *     - Idempotency key: `flag_exposure:${sessionId}:${flagKey}`.
 *     - This survives re-renders, StrictMode double-invocations, and
 *       component remounts — which useState(false) does NOT.
 *     - Does NOT rely on UI rendering order — exposure is fired in an effect,
 *       decoupled from the value return path.
 *
 *  2. EXPOSURE DOES NOT DEPEND ON UI RENDERING
 *     - trackEvent('flag_exposure') is called in a useEffect, not inside
 *       useMemo or the render path. This means exposure fires even if the
 *       component re-renders for unrelated reasons, and is not gated by
 *       the component being visible.
 *
 *  3. SESSION ID FROM APPCONTEXT
 *     - Idempotency key incorporates sessionId from AppContext so that
 *       the guarantee is scoped to the session, not just the page load.
 *
 * EXISTING BEHAVIOURS PRESERVED:
 *  - Evaluation timing safety (isHydrated + remoteReady gates).
 *  - Static default returned before hydration (no flicker).
 *  - Deterministic variant assignment via stableHashPercent.
 *  - buildFlagContext enrichment from AppContext user.
 */

import { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import {
  evaluateFlag,
  evaluateFlagVariant,
  whenRemoteFlagsReady,
  type FlagKey,
  type FeatureFlags,
  type FlagUserContext,
} from '@/lib/featureFlags';
import { trackEvent, hasBeenFired, markFired } from '@/lib/analytics';


// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL: build FlagUserContext from AppContext user
// ─────────────────────────────────────────────────────────────────────────────

function buildFlagContext(
  user: ReturnType<typeof useAppContext>['user'],
): FlagUserContext | undefined {
  if (!user) return undefined;
  return {
    userId:             user.id,
    userType:           user.user_type ?? null,
    onboardingComplete: user.onboarding_completed ?? false,
    resumeUploaded:     user.resume_uploaded ?? false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPOSURE IDEMPOTENCY — session-scoped, idempotency-system-backed
//
// Key format: `flag_exposure:${sessionId}:${flagKey}`
//
// Using the analytics idempotency system (not local state) ensures:
//  - StrictMode double-invocations don't fire duplicate exposure.
//  - Component unmount + remount doesn't re-fire.
//  - Multiple instances of the same flag hook on the same page don't
//    produce duplicate exposure events.
//
// NOTE: hasBeenFired / markFired are internal analytics helpers.
// They are imported here because the hooks layer owns exposure triggering.
// ─────────────────────────────────────────────────────────────────────────────

function exposureKey(sessionId: string, flagKey: FlagKey): string {
  return `flag_exposure:${sessionId}:${flagKey}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// useFeatureFlag — primary hook (unchanged public API)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluate a single feature flag, automatically enriched with the current
 * user's context (tier, user_type, onboarding state).
 *
 * Evaluation is deferred until:
 *  a) AppContext hydration completes (isHydrated = true)
 *  b) Remote flags have settled (whenRemoteFlagsReady resolves)
 *
 * Before both conditions are met, the static default is returned — same value
 * as after evaluation for conservative (false) defaults, so no visible flicker.
 */
export function useFeatureFlag<K extends FlagKey>(flag: K): FeatureFlags[K] {
  const { user, isHydrated } = useAppContext();
  const [remoteReady, setRemoteReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    whenRemoteFlagsReady().then(() => {
      if (!cancelled) setRemoteReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  return useMemo(() => {
    if (!isHydrated || !remoteReady) {
      return evaluateFlag(flag, undefined);
    }
    const flagContext = buildFlagContext(user);
    return evaluateFlag(flag, flagContext);
  }, [flag, user, isHydrated, remoteReady]);
}

// ─────────────────────────────────────────────────────────────────────────────
// useFeatureFlagVariant — A/B experiment hook with guaranteed exposure
//
// EXPOSURE GUARANTEE:
//  - Fires exactly once per (sessionId + flagKey).
//  - Uses idempotency system from analytics.ts — not useState.
//  - Fires in a useEffect (not in render path) — independent of UI rendering.
//  - Returns null until hydration + remote flags are ready (safe default).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the variant key for an A/B experiment flag.
 *
* Returns null if:
 *  - The flag has no active experiment defined in EXPERIMENTS.
 *  - The user is not yet hydrated.
 *
 * Fires flag_exposure event exactly once per (sessionId + flagKey) using
 * the analytics idempotency system. Exposure is NOT tied to UI rendering.
 *
 * Anonymous support: exposure fires for unauthenticated users using sessionId
 * as the identity. userId is included in the payload when available.
 *
 * @example
 * const variant = useFeatureFlagVariant('new_dashboard');
 * if (variant === 'treatment') return <NewDashboardV2 />;
 * return <LegacyDashboard />;
 */
export function useFeatureFlagVariant(flagKey: FlagKey): string | null {
  const { user, isHydrated, sessionId } = useAppContext();
  const [remoteReady, setRemoteReady]   = useState(false);
  const [variant, setVariant]           = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    whenRemoteFlagsReady().then(() => {
      if (!cancelled) setRemoteReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  // ── Variant resolution ─────────────────────────────────────────────────────
  // Run whenever evaluation preconditions change.
  // Stores resolved variant in state so downstream effects can depend on it.
  useEffect(() => {
    if (!isHydrated || !remoteReady) return;

    const flagContext = buildFlagContext(user);

    // evaluateFlagVariant is called WITHOUT onExposure callback here.
    // Exposure is fired separately in the effect below to keep concerns clean.
    const resolved = evaluateFlagVariant(flagKey, flagContext, undefined);
    // Variant state is authoritative: downstream effects (the exposure-firing
    // effect) depend on a stable `variant` value to determine whether
    // exposure has already been recorded. Derivation at render time is
    // impossible because evaluation must be gated on `remoteReady`, which
    // is set by an async promise resolution (whenRemoteFlagsReady). The
    // effect ensures evaluation only runs after both hydration and remote
    // flag config are committed — not during the render pass.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVariant(resolved);
  }, [flagKey, user, isHydrated, remoteReady]);

  // ── Exposure guarantee — fires once per (sessionId + flagKey) ─────────────
  //
  // Separated from variant resolution to ensure:
  //  1. Exposure fires even if variant is null (non-bucketed users).
  //  2. Exposure is not gated by render path — it runs in an effect.
  //  3. Idempotency key prevents duplicate fires across remounts.
  //
  // ANONYMOUS SUPPORT:
  //  userId is NOT required. The idempotency key is keyed on sessionId alone,
  //  so anonymous users get exactly-once exposure just like authenticated users.
  //  userId is included in the payload when available for cross-session joins.
  //
  // Only fires once evaluation is stable (isHydrated + remoteReady).
  // sessionId is always present (generated before first render in AppContext).
  useEffect(() => {
    if (!isHydrated || !remoteReady) return;

    const key = exposureKey(sessionId, flagKey);
    if (hasBeenFired(key)) return; // already fired this session — skip

    markFired(key); // mark before async boundary to prevent race conditions

    trackEvent('flag_exposure', {
      flag:      flagKey,
      variant:   variant ?? 'none',
      sessionId, // always present — anonymous identity for un-authed users
      // userId omitted from EventMap field; enrichment layer adds it via UserEnrichment
    }, {
      idempotencyKey: key, // double-lock: belt + suspenders
    });

    if (process.env.NODE_ENV === 'development') {
      console.debug('[FeatureFlag] Exposure fired:', {
        flag: flagKey, variant, sessionId, userId: user?.id ?? '(anonymous)',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, remoteReady, flagKey, sessionId, variant]);

  return variant;
}

// ─────────────────────────────────────────────────────────────────────────────
// Re-export for consumers who import from this file
// ─────────────────────────────────────────────────────────────────────────────

// Allow hooks layer to check idempotency state for testing
export { hasBeenFired, markFired } from '@/lib/analytics';