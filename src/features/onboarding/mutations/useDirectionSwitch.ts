/**
 * @file src/features/onboarding/mutations/useDirectionSwitch.ts
 *
 * PHASE 2 — MUTATION OWNERSHIP CONSOLIDATION
 *
 * Canonical location for the onboarding direction-switch orchestration.
 *
 * OWNERSHIP MOVE:
 *   Previously at: hooks/onboarding/useOnboardingDirectionSwitch.ts
 *   Now owned by:  features/onboarding/mutations/useDirectionSwitch.ts
 *
 * WHY THIS IS IN mutations/:
 *   Despite its orchestration surface (cache patching, navigation), the core
 *   operation is a write mutation — DELETE /api/v1/users/me/direction.
 *   The surrounding orchestration (cache remove, setQueryData, refreshUser,
 *   router.push) is the mutation's onSuccess logic, which is the standard
 *   pattern for write-then-navigate flows.
 *
 * COMPATIBILITY:
 *   hooks/onboarding/useOnboardingDirectionSwitch.ts is kept as a re-export
 *   bridge — it re-exports { useOnboardingDirectionSwitch } from here.
 *   All existing consumers continue to import from '@/hooks/onboarding'
 *   unchanged.
 *
 * PRESERVED:
 *   ✅ Same API call: DELETE /api/v1/users/me/direction
 *   ✅ Same completion guard (blocks if onboarding already complete)
 *   ✅ Same 5-step sequence: clear backend → remove cache → patch cache →
 *      refreshUser → navigate
 *   ✅ Same isSwitching / switchError state shape
 *   ✅ Same router.push('/direction') navigation
 *   ✅ Same in-flight guard
 *   ✅ UseOnboardingDirectionSwitchReturn type from features/onboarding/types
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '@/context/AppContext';
import { apiClient } from '@/lib/api/client';
import { queryKeys } from '@/lib/query';
import type { User } from '@/hooks/useUser';
import type { UseOnboardingDirectionSwitchReturn } from '@/features/onboarding/types';

export type { UseOnboardingDirectionSwitchReturn };

export function useDirectionSwitch(): UseOnboardingDirectionSwitchReturn {
  const router      = useRouter();
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAppContext();

  const [isSwitching, setIsSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  // ── In-flight guard ref ─────────────────────────────────────────────────
  // WHY a ref instead of reading `isSwitching` state inside the callback:
  //   Including `isSwitching` in the useCallback dependency array causes
  //   `switchDirection` to be recreated every time the loading state toggles
  //   (false → true → false). Any component receiving `switchDirection` as a
  //   prop re-renders unnecessarily. The ref holds the same guard semantics
  //   without triggering callback recreation on every loading-state change.
  const isSwitchingRef = useRef(false);

  // ── Mounted guard ────────────────────────────────────────────────────────
  // Prevents state writes and navigation after the component unmounts while
  // the DELETE request or refreshUser() is in flight.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const switchDirection = useCallback(async (): Promise<void> => {
    // ── COMPLETION GUARD ───────────────────────────────────────────────────
    // Post-completion role migration is explicitly out of scope.
    if (
      user?.onboarding_completed ||
      user?.student_onboarding_complete ||
      user?.professional_onboarding_complete
    ) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          '[useDirectionSwitch] Blocked: onboarding already complete. ' +
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
      // ── STEP 1: Clear direction in backend ──────────────────────────────
      await apiClient({
        url:    '/api/v1/users/me/direction',
        method: 'DELETE',
      });

      // AS-01: Guard all subsequent state and navigation operations against unmount.
      // The DELETE request above is async — the component may have unmounted
      // while it was in flight. Without this guard, Steps 2-5 would fire on an
      // unmounted component, producing React warnings and phantom navigation.
      if (!mountedRef.current) return;

      // ── STEP 2: Clear stale onboarding progress cache ───────────────────
      // Remove (not invalidate) — the in-progress steps for the old direction
      // are irrelevant to the new one. Start clean.
      queryClient.removeQueries({ queryKey: queryKeys.onboarding.all() });

      // ── STEP 3: Patch user/me cache synchronously ───────────────────────
      // The direction page's alreadyHasDirection guard checks user?.user_type.
      // Patch synchronously to avoid the race where navigation fires before
      // the async refreshUser() state update is committed.
      const current = queryClient.getQueryData<{ user?: Record<string, unknown> }>(
        queryKeys.user.me(),
      );
      if (current?.user) {
        queryClient.setQueryData(queryKeys.user.me(), {
          ...current,
          user: {
            ...current.user,
            user_type:      null,
            user_direction: null,
          },
        });
      }

      // ── STEP 4: Refresh AppContext user ─────────────────────────────────
      // refreshUser() calls fetchUser() → setUser() in AppContext. The
      // direction page's guardReady latch ensures alreadyHasDirection is not
      // evaluated until after this state update is committed.
      await refreshUser();

      // AS-01: Guard navigation against unmount after the await.
      if (!mountedRef.current) return;

      // ── STEP 5: Navigate to /direction ──────────────────────────────────
      // Safe after refreshUser() resolves. The React Query cache patch (Step 3)
      // ensures useUser() consumers see user_type: null synchronously. The
      // guardReady latch in direction/page.tsx handles the AppContext.user commit.
      router.push('/direction');

    } catch (err: unknown) {
      // AS-01: Guard catch-branch state writes against unmount.
      if (!mountedRef.current) return;
      const msg =
        (err as { message?: string })?.message ||
        'Unable to switch direction. Please try again.';
      setSwitchError(msg);
    } finally {
      isSwitchingRef.current = false;
      // AS-01: Guard finally-branch state write.
      if (mountedRef.current) setIsSwitching(false);
    }
  // isSwitching intentionally excluded — guarded via isSwitchingRef to avoid
  // recreating this callback on every loading-state toggle.
  }, [user, queryClient, refreshUser, router]);

  return { switchDirection, isSwitching, switchError };
}

// Canonical alias used by hooks/onboarding/useOnboardingDirectionSwitch.ts
// re-export bridge.
export { useDirectionSwitch as useOnboardingDirectionSwitch };