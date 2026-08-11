/**
 * src/routes/guards/AuthGuard.tsx
 *
 * AUTH GUARD — Supabase-backed session check.
 *
 * BEFORE: Stub that rendered children unconditionally.
 *   All protected routes (onboarding, dashboard, admin) were accessible
 *   to unauthenticated users, bypassing all auth enforcement.
 *
 * AFTER: Reads from AppContext (the single session source of truth).
 *   - While hydration is in flight → shows PageLoading (prevents flash).
 *   - Once hydrated, no session → redirects to /auth/login.
 *   - Once hydrated, session present → renders children.
 *
 * ONBOARDING GATE (requireOnboarding prop):
 *   When requireOnboarding={true} (used by /dashboard routes), additionally
 *   checks that the user has completed onboarding via lib/guards.ts's
 *   requireOnboardingComplete — students go to /education/onboarding,
 *   professionals go to /onboarding/profile (Entry Experience).
 *
 * WP-ENTRY-01 (P0): the onboarding-completion check below previously ran
 * regardless of whether the user had selected a direction at all. For a
 * brand-new user (user.user_type === null), the "not complete" fallback
 * (professional_onboarding_complete || onboarding_completed) is falsy, so
 * this guard sent them to /onboarding directly — bypassing Direction
 * Selection for anyone who reached /dashboard before choosing a direction.
 * Fix: check direction first; only fall through to the completion check
 * once a direction is confirmed set.
 *
 * CONTRACT:
 *   AuthGuard must live inside AppProvider (guaranteed — AppProvider wraps
 *   RouterProvider in AppProviders.tsx). It reads AppContext via useAppContext().
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/context/AppContext';
import { requireOnboardingComplete } from '@/lib/guards';
import { PageLoading } from '@/components/ui';

interface AuthGuardProps {
  children:           React.ReactNode;
  /** When true, also gate on onboarding completion (dashboard routes). */
  requireOnboarding?: boolean;
}

export default function AuthGuard({ children, requireOnboarding = false }: AuthGuardProps) {
  const navigate = useNavigate();
  const { isHydrated, isError, user } = useAppContext();

  useEffect(() => {
    if (!isHydrated) return;

    // WP-AV-02E — Log: beginning of guard.
    console.log("[Guard] AuthGuard", {
      user_type: user?.user_type,
      onboarding_completed: user?.onboarding_completed,
      professional_onboarding_complete: user?.professional_onboarding_complete,
      student_onboarding_complete: user?.student_onboarding_complete,
    });

    // Hard hydration failure → send to login
    if (isError) {
      // WP-AV-02E — Log: immediately before redirecting.
      console.log("[Guard Redirect]", '/auth/login');
      console.log("[Navigation]", '/auth/login');
      navigate('/auth/login', { replace: true });
      return;
    }

    // No authenticated user → send to login
    if (!user) {
      // WP-AV-02E — Log: immediately before redirecting.
      console.log("[Guard Redirect]", '/auth/login');
      console.log("[Navigation]", '/auth/login');
      navigate('/auth/login', { replace: true });
      return;
    }

    // Onboarding gate (dashboard routes only)
    if (requireOnboarding) {
      // WP-ENTRY-01: direction must be resolved before completion is even
      // meaningful — see file header.
      //
      // WP-PRO-09I: this used to re-derive the completion check inline with
      // its own hardcoded redirect (always '/onboarding', regardless of
      // user_type). That duplicate copy drifted from lib/guards.ts's
      // requireOnboardingComplete — it was never updated when professionals
      // got their own Entry Experience route, so professionals landing on
      // /dashboard before finishing onboarding were bounced to the legacy
      // /onboarding (WelcomePage) instead of /onboarding/profile. Delegating
      // to the single canonical guard removes the duplicate copy.
      const onboardingGuard = requireOnboardingComplete(user);
      if (!onboardingGuard.allowed) {
        // WP-AV-02E — Log: immediately before redirecting.
        console.log("[Guard Redirect]", onboardingGuard.redirectTo);
        console.log("[Navigation]", onboardingGuard.redirectTo);
        navigate(onboardingGuard.redirectTo, { replace: true });
        return;
      }
    }
  }, [isHydrated, isError, user, navigate, requireOnboarding]);

  // While hydrating — show spinner, never flash protected content
  if (!isHydrated) {
    return <PageLoading label="Loading HireRise…" />;
  }

  // Redirect is in progress — render nothing to prevent flash
  if (isError || !user) {
    return null;
  }

  if (requireOnboarding) {
    if (!requireOnboardingComplete(user).allowed) {
      return null;
    }
  }

  return <>{children}</>;
}