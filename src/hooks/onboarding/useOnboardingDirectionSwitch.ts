/**
 * hooks/onboarding/useOnboardingDirectionSwitch.ts
 *
 * PHASE B.5 — Onboarding Direction Recovery
 *
 * RESPONSIBILITY:
 *   Owns the "switch direction" action for users who are mid-onboarding
 *   (BEFORE completion) and want to change their path.
 *
 * WHAT IT DOES:
 *   1. Calls DELETE /api/v1/users/me/direction to clear the current direction
 *      and user_type in the backend.
 *   2. Removes the React Query onboarding cache (stale progress for old direction).
 *   3. Patches the user/me cache to clear user_type synchronously so the
 *      direction page guard sees a clean state immediately on navigation.
 *   4. Calls refreshUser() so AppContext.user reflects the cleared state.
 *   5. Navigates to /direction via router.push — preserving AppShell.
 *
 * WHAT IT DOES NOT DO:
 *   - Does not touch auth session.
 *   - Does not reset the entire React Query cache.
 *   - Does not mutate completed backend onboarding records.
 *   - Does not call any onboarding submit API.
 *   - Does not redesign routing or identity architecture.
 *
 * GUARD:
 *   The hook refuses to operate if onboarding is already complete.
 *   Completion is checked from the live user object. Post-completion
 *   role migration is out of scope and intentionally blocked.
 *
 * PLACEMENT:
 *   Lives in the onboarding hook layer alongside useOnboardingFlow,
 *   useOnboardingNavigation, etc. Pages call it via a single
 *   { switchDirection, isSwitching } return value.
 *
 * REVERSIBILITY:
 *   This is a thin wrapper over an existing DELETE endpoint. The entire
 *   "switch" is one API call + a few cache operations. Removing this hook
 *   removes the feature entirely — no architectural entanglement.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '@/context/AppContext';
import { apiClient } from '@/lib/api/client';
import { queryKeys } from '@/lib/query';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface UseOnboardingDirectionSwitchReturn {
  /**
   * Initiate a direction switch. Safe to call only before onboarding completion.
   * Rejects (no-op) if the user has already completed onboarding.
   */
  switchDirection: () => Promise<void>;
  /** True while the DELETE request + cache reset is in flight. */
  isSwitching: boolean;
  /** Non-null if the switch failed (e.g. network error). */
  switchError: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useOnboardingDirectionSwitch(): UseOnboardingDirectionSwitchReturn {
  const navigate     = useNavigate();
  const queryClient  = useQueryClient();
  const { user, refreshUser } = useAppContext();

  const [isSwitching, setIsSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  // AS-01: Mounted ref — guards post-async state writes inside switchDirection.
  // If the component unmounts while the DELETE request or refreshUser() is in
  // flight (e.g. user navigates away during the switch), the async continuations
  // must not call setIsSwitching / setSwitchError / router.push on a dead tree.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── In-flight guard ref ───────────────────────────────────────────────────
  // WHY a ref instead of reading the `isSwitching` state inside the callback:
  //   Including `isSwitching` in the useCallback dependency array causes
  //   `switchDirection` to be recreated every time the loading state toggles
  //   (false → true → false). Any component that receives `switchDirection`
  //   as a prop re-renders because its reference changed — even though the
  //   function's behavior is identical. The ref holds the same in-flight
  //   guard semantics without triggering callback recreation.
  const isSwitchingRef = useRef(false);

  const switchDirection = useCallback(async (): Promise<void> => {
    // ── COMPLETION GUARD ────────────────────────────────────────────────────
    // Post-completion role migration is explicitly out of scope.
    // Guard against accidental calls from already-complete sessions.
    if (
      user?.onboarding_completed ||
      user?.student_onboarding_complete ||
      user?.professional_onboarding_complete
    ) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          '[useOnboardingDirectionSwitch] Blocked: onboarding already complete. ' +
          'Direction switching is only available before completion.',
        );
      }
      return;
    }

    // Use ref for in-flight guard — avoids adding isSwitching to deps.
    if (isSwitchingRef.current) return;
    isSwitchingRef.current = true;

    setIsSwitching(true);
    setSwitchError(null);

    try {
      // ── STEP 1: Clear direction in backend ────────────────────────────────
      // DELETE /api/v1/users/me/direction resets user_direction and user_type
      // in the DB, and calls freshnessCache.del() via the direction route.
      await apiClient({
        url:    '/api/v1/users/me/direction',
        method: 'DELETE',
      });

      // AS-01: Guard all subsequent state and navigation operations against unmount.
      // The DELETE request above is async — the component may have unmounted
      // while it was in flight. Without this guard, Steps 2-5 would fire on an
      // unmounted component, producing React warnings and phantom navigation.
      if (!mountedRef.current) return;

      // ── STEP 2: Clear stale onboarding progress cache ─────────────────────
      // The in-progress steps for the old direction are irrelevant to the new
      // one. Remove (not invalidate) so the new direction starts clean.
      queryClient.removeQueries({ queryKey: queryKeys.onboarding.all() });

      // ── STEP 3: Patch user/me cache synchronously ─────────────────────────
      // AppContext.user is React state updated by fetchUser(). The direction
      // page's alreadyHasDirection guard checks user?.user_type. If we navigate
      // before the cache is patched, the guard sees the old user_type and
      // immediately bounces back. Patch synchronously to avoid the race.
      //
      // NOTE: This cache patch eliminates the race for React Query consumers of
      // useUser(). The AppContext.user race (React state, not React Query state)
      // is handled separately by the guardReady latch in direction/page.tsx,
      // which defers the alreadyHasDirection guard until after the first commit
      // cycle — giving React time to flush the setUser(null) update enqueued by
      // refreshUser() below before the guard evaluates.
      const current = queryClient.getQueryData<{ user?: Record<string, unknown> }>(
        queryKeys.user.me(),
      );
      if (current?.user) {
        queryClient.setQueryData(queryKeys.user.me(), {
          ...current,
          user: {
            ...current.user,
            user_type:  null,
            user_direction: null,
          },
        });
      }

      // ── STEP 4: Refresh AppContext user ───────────────────────────────────
      // refreshUser() calls fetchUser() → setUser() in AppContext. React
      // enqueues — but does not synchronously commit — the setUser(null) call.
      // The direction page's guardReady latch ensures it doesn't evaluate
      // alreadyHasDirection until after that state update has been committed.
      await refreshUser();

      // ── STEP 5: Navigate to /direction ────────────────────────────────────
      // Safe to navigate immediately after refreshUser() resolves:
      //   - React Query cache is already patched (Step 3) — useUser() consumers
      //     see user_type: null synchronously.
      //   - AppContext.user will have user_type: null committed by the time
      //     direction/page.tsx's guardReady useEffect fires (one render after mount).
      //   - The guardReady latch in direction/page.tsx ensures the guard waits
      //     for that commit before evaluating — no bounce loop.
      // router.push preserves the AppShell (no full reload, no remount).
      navigate('/direction');

    } catch (err: unknown) {
      // AS-01: Guard catch-branch state writes against unmount.
      if (!mountedRef.current) return;
      const msg =
        (err as { message?: string })?.message ||
        'Unable to switch direction. Please try again.';
      setSwitchError(msg);
    } finally {
      isSwitchingRef.current = false;
      // AS-01: Guard finally-branch state write. isSwitchingRef (a ref) is
      // always safe to write; setIsSwitching (React state) must be guarded.
      if (mountedRef.current) setIsSwitching(false);
    }
  // isSwitching intentionally excluded — guarded via isSwitchingRef to avoid
  // recreating this callback on every loading-state toggle.
  }, [user, queryClient, refreshUser, navigate]);

  return { switchDirection, isSwitching, switchError };
}