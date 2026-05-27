/**
 * @file hooks/useAnalytics.ts
 * @description Hooks-layer wrapper for the analytics lib.
 *
 * ARCHITECTURE:
 *  - Consumes AppContext (user) to auto-enrich events with user metadata.
 *  - Returns stable, memoized action-level tracking functions.
 *  - Pages call trackPageView directly from useAnalytics on mount.
 *  - Hooks (useResume, useOnboarding, etc.) import and call these for
 *    action tracking inside their async flows.
 *  - UI layer: ZERO direct analytics calls — always goes through a hook.
 *
 * USER ENRICHMENT:
 *  All events are automatically enriched with:
 *    user_type, onboarding_complete, resume_uploaded, tier
 *  so you never have to pass these manually at call-sites.
 *
 * STABILITY CONTRACT:
 *  All returned functions are wrapped in useCallback with stable deps,
 *  guaranteeing referential stability across renders.
 *
 * TYPED CONTRACT:
 *  trackEvent is generic over EventName — TypeScript will reject any call
 *  with an unknown event name or mismatched prop shape.
 *
 * IDEMPOTENCY HELPERS:
 *  Exposes clearKey / clearFunnelReset for flows that need to re-fire events
 *  across retries (e.g. re-uploading a resume).
 */

import { useCallback } from 'react';
import { useAppContext } from '@/context/AppContext';
import {
  trackEvent as _trackEvent,
  trackPageView as _trackPageView,
  trackFunnelStep as _trackFunnelStep,
  clearIdempotencyKey,
  resetFunnel,
  type EventName,
  type EventMap,
  type FunnelStatus,
  type UserEnrichment,
} from '@/lib/analytics';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface UseAnalyticsReturn {
  /**
   * Track a named user action.
   * User context is automatically appended to props.
   * Pass idempotencyKey to deduplicate events fired inside polling loops
   * or effects that may execute multiple times.
   */
  trackEvent: <K extends EventName>(
    name: K,
    props: EventMap[K],
    options?: { idempotencyKey?: string },
  ) => void;

  /**
   * Track a page view. Call this on the initial mount of each Page component,
   * after hydration guard passes.
   */
  trackPageView: (page: string) => void;

  /**
   * Track a step inside a named funnel.
   * Funnel integrity is enforced by the lib (started → complete|drop).
   */
  trackFunnelStep: (
    funnel: string,
    step: string,
    status: FunnelStatus,
    metadata?: Record<string, unknown>,
  ) => void;

  /**
   * Clear an idempotency key so a previously-fired event can fire again.
   * Use at the start of a retry flow (e.g. re-uploading a resume).
   */
  clearIdempotencyKey: (key: string) => void;

  /**
   * Reset funnel state, allowing 'started' to be fired again.
   * Use when the user retries a flow from the beginning.
   */
  resetFunnel: (funnel: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useAnalytics(): UseAnalyticsReturn {
  const { user } = useAppContext();

  /**
   * Builds user context enrichment from AppContext user.
   * Returns empty object if user is not yet hydrated — no PII ever included.
   * Stable: recreated only when `user` reference changes.
   */
  const buildEnrichment = useCallback((): UserEnrichment => {
    if (!user) return {};
    return {
      user_type:           user.user_type ?? null,
      onboarding_complete: user.onboarding_completed ?? false,
      resume_uploaded:     user.resume_uploaded ?? false,
      // tier: user.tier ?? 'free',  // uncomment when tier is added to User
    };
  }, [user]);

  // ── trackEvent ─────────────────────────────────────────────────────────────
  const trackEvent = useCallback(
    <K extends EventName>(
      name: K,
      props: EventMap[K],
      options?: { idempotencyKey?: string },
    ): void => {
      // Merge enrichment into props.
      // Type cast is safe: enrichment fields are all optional on EventMap entries,
      // and the lib dispatch does not validate them structurally.
      const enrichedProps = {
        ...buildEnrichment(),
        ...props,
      } as EventMap[K];

      _trackEvent(name, enrichedProps, options);
    },
    [buildEnrichment],
  );

  // ── trackPageView ──────────────────────────────────────────────────────────
  const trackPageView = useCallback(
    (page: string): void => {
      _trackPageView(page);
      // Also fire a typed page_viewed event for funnel tooling that
      // normalises on event streams rather than page calls.
      _trackEvent(
        'page_viewed',
        { page, ...buildEnrichment() },
        { idempotencyKey: `page_viewed:${page}` },
      );
    },
    [buildEnrichment],
  );

  // ── trackFunnelStep ────────────────────────────────────────────────────────
  const trackFunnelStep = useCallback(
    (
      funnel: string,
      step: string,
      status: FunnelStatus,
      metadata?: Record<string, unknown>,
    ): void => {
      _trackFunnelStep(funnel, step, status, {
        ...buildEnrichment(),
        ...metadata,
      });
    },
    [buildEnrichment],
  );

  return {
    trackEvent,
    trackPageView,
    trackFunnelStep,
    clearIdempotencyKey,
    resetFunnel,
  };
}