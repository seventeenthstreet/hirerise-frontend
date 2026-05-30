/**
 * src/layouts/OnboardingLayout.tsx
 *
 * Onboarding Domain Layout — Vite-native
 *
 * Provides the layout boundary for all pre-app-entry / onboarding routes:
 *   /onboarding/*
 *   /onboarding/career
 *
 * WHY NO AppShell HERE:
 *  Onboarding users are pre-app-entry. They may not have a user_type set yet
 *  (direction selection), or are mid-setup (onboarding flows). Mounting the
 *  full sidebar + header chrome:
 *    1. Creates incorrect product framing (app chrome before the user is "in" the app)
 *    2. Wastes AppNavigation render cycles (renders with user_type=null → minimal nav)
 *    3. Couples onboarding UX to protected-app shell changes
 *
 * WHAT THIS LAYOUT PROVIDES:
 *  - Full-viewport container (min-h-screen) filling the browser window.
 *  - bg-background: matches the design system base background token.
 *  - overflow-y-auto: allows individual onboarding pages to scroll.
 *  - No padding/margin: pages own their own centering via flex utilities.
 *
 * AUTH REDIRECT GUARD:
 *  Once hydration has settled (isHydrated = true) and there is no authenticated
 *  user, redirects to /auth/login immediately. Covers the stale refresh token
 *  scenario where Supabase emits SIGNED_OUT and user becomes null mid-session,
 *  leaving pages that return null (their own per-page check) on a blank screen.
 *
 *  WHY useEffect and not a render-time redirect:
 *    AppContext sets isHydrated asynchronously. Redirecting synchronously on
 *    first render would fire before hydration completes — sending
 *    unauthenticated-but-loading users to /auth/login. useEffect fires after
 *    paint, once React has committed the current state.
 */

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/context/AppContext';

interface OnboardingLayoutProps {
  children: ReactNode;
}

export default function OnboardingLayout({ children }: OnboardingLayoutProps) {
  const { isHydrated, user } = useAppContext();
  const navigate = useNavigate();

  // Auth redirect guard — fires after hydration settles.
  // Covers stale refresh token scenario (Supabase SIGNED_OUT event).
  useEffect(() => {
    if (isHydrated && !user) {
      navigate('/auth/login', { replace: true });
    }
  }, [isHydrated, user, navigate]);

  return (
    <div className="min-h-screen overflow-y-auto bg-background">
      {children}
    </div>
  );
}
