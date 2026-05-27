'use client';

/**
 * (auth)/(onboarding)/layout.tsx — Onboarding Domain Layout
 *
 * PHASE 1 ROUTE RESTRUCTURING:
 *  Owns the layout boundary for all pre-app-entry / onboarding routes:
 *    /direction
 *    /onboarding
 *    /career/onboarding
 *    /education/onboarding
 *
 * WHY NO AppShell HERE:
 *  Onboarding users are pre-app-entry. They may not have a user_type set yet
 *  (direction selection), or are mid-setup (onboarding flows). Mounting the
 *  full sidebar + header chrome:
 *    1. Creates incorrect product framing (app chrome before the user is "in" the app)
 *    2. Wastes AppNavigation render cycles (renders with user_type=null → minimal nav)
 *    3. Couples onboarding UX to protected-app shell changes
 *    4. Creates unnecessary useState surface area (AppShell's mobileNavOpen)
 *
 * WHAT THIS LAYOUT PROVIDES:
 *  - A full-viewport container (min-h-screen) that fills the browser window.
 *  - bg-background: matches the design system's base background color so there
 *    is no visual flash between the root html background and the page content.
 *  - overflow-y-auto: allows individual onboarding pages to scroll if their
 *    content grows beyond the viewport (e.g. long step forms on mobile).
 *  - No padding/margin: pages own their own centering via flex utilities
 *    (existing pattern — each onboarding page has its own centering wrapper).
 *
 * AUTH REDIRECT GUARD (added):
 *  Per-page guards already comment "layout handles redirect to /login" but the
 *  layout previously did nothing. This guard fulfils that contract:
 *
 *  RULE: Once hydration has settled (isHydrated = true) and there is no
 *  authenticated user, redirect to /login immediately.
 *
 *  WHY useEffect and not a render-time redirect:
 *    - AppContext sets isHydrated asynchronously (after /app-entry + /users/me
 *      settle). Redirecting synchronously on first render would fire before
 *      hydration completes — sending unauthenticated-but-loading users to /login.
 *    - useEffect fires after paint, once React has committed the current state.
 *      By the time it fires with isHydrated=true, the auth decision is final.
 *
 *  WHY this layout and not per-page:
 *    - Four onboarding pages all have `if (!user) return null; // layout handles redirect`
 *      comments. Centralising here means one fix, zero per-page duplication.
 *    - The (auth)/(app)/layout.tsx pattern is the same approach for the app shell.
 *
 *  STALE REFRESH TOKEN SCENARIO (the fix this addresses):
 *    When Supabase cannot refresh an expired/revoked token, it emits SIGNED_OUT.
 *    AppContext handles SIGNED_OUT by setting user=null and isHydrated=true.
 *    Without this guard, the onboarding page renders null (its own per-page check)
 *    but never redirects — leaving the user on a blank screen. This useEffect
 *    catches that state and sends them to /login with a clean URL.
 *
 * DOES NOT:
 *  - Mount any additional providers (all providers are at root level)
 *  - Perform any data fetching
 *  - Add any navigation chrome (no sidebar, no header)
 *
 * PRESERVED:
 *  ✅ All page-level auth guard logic (unchanged — pages still read
 *     useAppContext() for their own type/completion guards)
 *  ✅ All onboarding flow logic (hooks, mutations, analytics — unchanged)
 *  ✅ AppContext hydration lifecycle (unchanged)
 *  ✅ React Query behavior (unchanged)
 *  ✅ StrictMode compatibility (useEffect dep array is stable)
 */

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';

interface OnboardingLayoutProps {
  children: ReactNode;
}

export default function OnboardingLayout({ children }: OnboardingLayoutProps) {
  const { isHydrated, user } = useAppContext();
  const router = useRouter();

  // ── Auth redirect guard ───────────────────────────────────────────────────
  // Wait for hydration to settle before making any auth decision.
  // Once settled: no user → /login. Covers the stale refresh token scenario
  // where Supabase emits SIGNED_OUT and user becomes null mid-session.
  useEffect(() => {
    if (isHydrated && !user) {
      router.replace('/login');
    }
  }, [isHydrated, user, router]);

  return (
    <div className="min-h-screen overflow-y-auto bg-background">
      {children}
    </div>
  );
}