'use client';

/**
 * @file src/features/onboarding/orchestration/usePostSubmitNavigation.ts
 * @description Deterministic, StrictMode-safe post-submit navigation hook.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The main onboarding page (/onboarding/page.tsx) currently uses a
 * `pendingPostSubmitNav` flag + a multi-effect chain to navigate after submit:
 *
 *   Step 1 (in handleSubmit):
 *     await submitOnboarding(finalData)
 *     clearFlowId()
 *     await refreshUser()        ← enqueues setUser() update in React
 *     setPendingPostSubmitNav(true)  ← triggers re-render
 *
 *   Step 2 (in useEffect([user, pendingPostSubmitNav])):
 *     if (pendingPostSubmitNav) {
 *       router.replace(destination)  ← fires AFTER React commits setUser()
 *     }
 *
 * This pattern exists to avoid the race where router.push fires before React
 * commits the refreshUser() state update, causing the destination page to see
 * stale user flags and redirect back to /onboarding (the "blank page bug").
 *
 * The pattern works but has two fragility risks:
 *   1. No idempotency guard — in StrictMode, the navigation effect could fire
 *      twice. router.replace is idempotent, but reading user.resume_uploaded
 *      between the two fires is a theoretical stale-closure window.
 *   2. The two-step chain is non-obvious to future maintainers — it's easy to
 *      miss the pendingPostSubmitNav flag when reading handleSubmit in isolation.
 *
 * THIS HOOK
 * ─────────
 * Replaces the two-step chain with a single, self-contained function:
 *
 *   const { navigateAfterSubmit } = usePostSubmitNavigation();
 *   // In handleSubmit:
 *   await submitOnboarding(finalData)
 *   clearFlowId()
 *   await navigateAfterSubmit(refreshUser)
 *
 * `navigateAfterSubmit` calls refreshUser() internally to get the fresh user,
 * resolves the destination using the pure resolvePostOnboardingDestination
 * function, and navigates — all in one sequential call. The idempotency guard
 * (navigatedRef) prevents double navigation in StrictMode.
 *
 * IMPORTANT: The career/onboarding/page.tsx already uses the simpler inline
 * pattern (await refreshUser(); router.push(destination)) and does NOT use this
 * hook. That page is not migrated here to avoid scope creep. Both patterns are
 * correct; this hook is the preferred pattern for new or refactored pages.
 *
 * PRESERVATION
 * ────────────
 * Navigation destinations are identical to the existing page logic.
 * refreshUser() semantics are preserved — same call, same AppContext update.
 * router.replace is used (not router.push) to match the main page's pattern.
 */

import { useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@/hooks/useUser';
import {
  resolvePostOnboardingDestination,
} from './resolvePostOnboardingDestination';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface UsePostSubmitNavigationReturn {
  /**
   * Call after submitOnboarding + clearFlowId complete.
   * Internally calls refreshUser(), resolves destination, navigates.
   *
   * Idempotent — safe to call in StrictMode double-effect contexts.
   *
   * @param refreshUser - The AppContext refreshUser function
   */
  navigateAfterSubmit: (
    refreshUser: () => Promise<User | null>,
  ) => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function usePostSubmitNavigation(): UsePostSubmitNavigationReturn {
  const router = useRouter();

  // ── Idempotency guard ─────────────────────────────────────────────────────
  // WHY a ref instead of state: navigation should happen exactly once, and the
  // guard must survive React re-renders without resetting. State resets on
  // unmount/remount in StrictMode; a ref persists across the StrictMode
  // mount → unmount → remount cycle within the same component instance.
  const navigatedRef = useRef(false);

  const navigateAfterSubmit = useCallback(
    async (refreshUser: () => Promise<User | null>): Promise<void> => {
      // Guard: prevent double-navigation in StrictMode or any other
      // scenario where this function is called more than once.
      if (navigatedRef.current) return;
      navigatedRef.current = true;

      // Fetch the post-submission user state.
      // refreshUser() writes to AppContext.user via setUser() — this is the
      // same call that the existing pendingPostSubmitNav pattern relied on.
      // We use the returned value directly (not AppContext.user) to avoid
      // any residual timing dependency on React state commits.
      const updatedUser = await refreshUser();

      // Resolve destination from the fresh user object.
      const destination = resolvePostOnboardingDestination(updatedUser);

      // Navigate. router.replace avoids leaving /onboarding in the history
      // stack — matching the existing behavior in the main onboarding page.
      router.replace(destination);
    },
    [router],
  );

  return { navigateAfterSubmit };
}