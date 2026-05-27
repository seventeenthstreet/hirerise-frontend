/**
 * hooks/onboarding/useOnboardingNavigation.ts
 *
 * Onboarding guard + navigation hook.
 *
 * RESPONSIBILITY:
 *   Encapsulates the repeated guard-and-redirect logic from:
 *     - /onboarding/page.tsx  (requireDirection + variant routing)
 *     - career/onboarding/page.tsx (direction guard + professional check + already-complete redirect)
 *
 * Moves this boilerplate OUT of pages so pages are thinner.
 *
 * PROVIDES:
 *   - guardResult memoization
 *   - redirect side effect on guard failure
 *   - redirecting flag (suppresses render during redirect)
 *
 * DOES NOT OWN:
 *   - requireDirection logic (stays in lib/guards)
 *   - Business rules about when onboarding is "complete"
 *   - Auth context ownership
 *   - Quota logic
 *
 * PAGES STILL OWN:
 *   - The variant-specific already-complete redirect (varies per page)
 *   - Post-submit navigation
 */

import { useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { requireDirection } from '@/lib/guards';
import type { User } from '@/hooks/useUser';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface UseOnboardingNavigationOptions {
  user: User | null | undefined;
  isHydrated: boolean;
  /**
   * Additional redirect check after the direction guard passes.
   * Return a URL to redirect to, or null to allow render.
   */
  additionalRedirect?: (user: User) => string | null;
}

export interface UseOnboardingNavigationReturn {
  /** Guard result — null while hydrating. */
  guardResult: ReturnType<typeof requireDirection> | null;
  /** True while a redirect is in flight — render null. */
  isRedirecting: boolean;
  /** True if all guards pass and the page can render. */
  canRender: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useOnboardingNavigation({
  user,
  isHydrated,
  additionalRedirect,
}: UseOnboardingNavigationOptions): UseOnboardingNavigationReturn {
  const router = useRouter();
  const redirectingRef = useRef(false);

  // Memoize guard — only re-runs when user changes.
  //
  // CRITICAL FIX: Gate on user.user_type being non-null, not just user being non-null.
  //
  // WHY THIS WAS BROKEN:
  //   After direction selection, setDirection() fires router.push('/onboarding')
  //   immediately after the API call, before React Query's invalidateQueries()
  //   refetch has delivered the updated user (with user_type set).
  //   The onboarding page mounts with isHydrated=true and user non-null,
  //   but user.user_type is still null (stale cache). requireDirection(user)
  //   sees user_type=null → returns block('/direction') → redirect fires
  //   immediately → page appears to "refresh" back to direction page.
  //   Market Insights worked because it doesn't use useOnboardingNavigation.
  //
  // THE FIX:
  //   Treat user_type=null as "direction not yet resolved" — the same as
  //   not hydrated. Return null (no guard result) so the effect doesn't fire
  //   a redirect. Once React Query delivers the refetched user with user_type
  //   set, the memo re-runs and the guard evaluates correctly.
  //   If user genuinely has no user_type after refetch, the redirect fires then.
  const guardResult = useMemo(
    () => (isHydrated && user?.user_type ? requireDirection(user) : null),
    [user, isHydrated],
  );

  // Compute additional redirect only when base guard passes.
  const additionalRedirectTo = useMemo(() => {
    if (!guardResult?.allowed || !user || !additionalRedirect) return null;
    return additionalRedirect(user);
  }, [guardResult, user, additionalRedirect]);

  // Fire redirect side-effects after render (never during render).
  useEffect(() => {
    if (redirectingRef.current) return;

    if (guardResult && !guardResult.allowed) {
      redirectingRef.current = true;
      router.replace(guardResult.redirectTo);
      return;
    }

    if (additionalRedirectTo) {
      redirectingRef.current = true;
      router.replace(additionalRedirectTo);
    }
  }, [guardResult, additionalRedirectTo, router]);

  const isRedirecting =
    (guardResult !== null && !guardResult.allowed) ||
    !!additionalRedirectTo;

  const canRender =
    isHydrated &&
    !!user &&
    !!guardResult?.allowed &&
    !additionalRedirectTo;

  return {
    guardResult,
    isRedirecting,
    canRender,
  };
}