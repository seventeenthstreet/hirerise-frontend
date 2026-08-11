/**
 * src/pages/AppEntryPage.tsx — App Entry Gate
 *
 * ROUTE FIX: Corrected three navigate() targets that pointed to non-existent paths,
 * causing the catch-all (* → /404) to fire on every app load:
 *
 *   '/login'              → '/auth/login'         (router defines auth group at /auth/*)
 *   '/education/onboarding' → '/onboarding'       (no /education/* route exists)
 *   '/market-insights'    → '/dashboard'           (no /market-insights route exists)
 *
 * Routing decision tree:
 *   isError                                      → /auth/login
 *   no user + session exists                     → /direction
 *   no user + no session                         → /auth/login
 *   user is an admin (isAdminUser)                → /admin  (evaluated before user_type — WP-ADMIN-02B Phase 2)
 *   user_type = null                             → /direction
 *   user_type = 'student'                        → /onboarding  (student sub-flow)
 *   user_type = 'professional'
 *     onboarding incomplete                      → /onboarding/profile (Entry Experience)
 *     resume not uploaded                        → /resume
 *     else                                       → /dashboard
 *   user_type = 'market'                         → /dashboard   (fallback until dedicated page exists)
 *   fallback                                     → /dashboard
 *
 * WP-ADMIN-02B Phase 2 — ROUTING RECONCILIATION:
 *   Root cause (Phase 1 audit): this decision tree branched exclusively on
 *   user_type and never checked user.role, so authenticated admins (whose
 *   accounts also carry user_type: 'professional') fell through the
 *   Professional branch and landed on /dashboard instead of /admin. Manual
 *   navigation to /admin worked because it bypasses this component entirely
 *   and hits AdminGuard directly, which already checked role correctly.
 *
 *   Fix: added an admin check ahead of the user_type branches, reusing the
 *   same isAdminUser() guard AdminGuard.tsx uses (both now import it from
 *   lib/guards.ts — no second admin-role definition was introduced). Admins
 *   are routed to ROUTES.ADMIN_ROOT ('/admin'), not '/admin/cms' directly —
 *   the Admin router's own index route decides its landing page, so this
 *   stays compatible with WP-ADMIN-03 replacing that landing page later.
 *
 *   Authentication, session hydration, AdminGuard, and requireAdmin were not
 *   modified — this is a single additive branch in this file only.
 */

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/context/AppContext';
import { getSupabaseClient } from '@/lib/supabase/client';
import { requireOnboardingComplete, isAdminUser } from '@/lib/guards';
import { ROUTES } from '@/routes/routes.constants';
import { PageLoading } from '@/components/ui';

export default function AppEntryPage() {
  const navigate = useNavigate();
  const { user, isHydrated, isError } = useAppContext();

  // A-05: Track mount state to guard async callback against post-unmount execution.
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    // WP-AV-02E — Log: beginning of guard. This is the exact `user` object
    // (from AppContext) that AppEntryPage's routing decision is based on.
    console.log("[Guard] AppEntryPage", {
      user_type: user?.user_type,
      onboarding_completed: user?.onboarding_completed,
      professional_onboarding_complete: user?.professional_onboarding_complete,
      student_onboarding_complete: user?.student_onboarding_complete,
    });

    // Hard hydration failure — send to login.
    if (isError) {
      // WP-AV-02E — Log: immediately before redirecting / navigation.
      console.log("[Guard Redirect]", '/auth/login');
      console.log("[Navigation]", '/auth/login');
      navigate('/auth/login', { replace: true }); // FIX: was '/login'
      return;
    }

    // No backend profile yet (new OAuth user, or /users/me returned 404).
    // Check if a Supabase session exists to decide between direction-setup vs login.
    if (!user) {
      getSupabaseClient().auth.getSession().then(({ data: { session } }) => {
        if (!isMounted.current) return;
        const destination = session ? '/direction' : '/auth/login'; // FIX: was '/login'
        // WP-AV-02E — Log: immediately before redirecting / navigation.
        console.log("[Guard Redirect]", destination);
        console.log("[Navigation]", destination);
        navigate(
          destination,
          { replace: true }
        );
      });
      return;
    }

    // ── Admin branch ─────────────────────────────────────────────────────────
    // WP-ADMIN-02B Phase 2: evaluated before user_type so an admin account
    // (which also normally carries user_type: 'professional') is routed to
    // the Admin platform instead of falling through to the Professional
    // branch below. Reuses AdminGuard's own isAdminUser() check — no
    // duplicate role logic. Routes to ROUTES.ADMIN_ROOT ('/admin'), not
    // '/admin/cms' directly, so the Admin router's own index route stays in
    // control of its landing page.
    if (isAdminUser(user)) {
      // WP-AV-02E — Log: immediately before redirecting / navigation.
      console.log("[Guard Redirect]", ROUTES.ADMIN_ROOT);
      console.log("[Navigation]", ROUTES.ADMIN_ROOT);
      navigate(ROUTES.ADMIN_ROOT, { replace: true });
      return;
    }

    const {
      user_type,
      resume_uploaded,
    } = user;

    // ── Direction gate ───────────────────────────────────────────────────────
    if (!user_type) {
      // WP-AV-02E — Log: immediately before redirecting / navigation.
      console.log("[Guard Redirect]", '/direction');
      console.log("[Navigation]", '/direction');
      navigate('/direction', { replace: true });
      return;
    }

    // ── Student branch ───────────────────────────────────────────────────────
    // FIX: was '/education/onboarding' — no such route exists.
    // Students use the same /onboarding shell; the student sub-steps live at
    // /onboarding/student/* and are gated by OnboardingGuard.
    if (user_type === 'student') {
      // WP-AV-02E — Log: immediately before redirecting / navigation.
      console.log("[Guard Redirect]", '/onboarding');
      console.log("[Navigation]", '/onboarding');
      navigate('/onboarding', { replace: true });
      return;
    }

    // ── Professional branch ──────────────────────────────────────────────────
    // WP-PRO-09I: previously hardcoded navigate('/onboarding') here, which is
    // this file's own copy of the same completion check duplicated in
    // AuthGuard.tsx and lib/guards.ts's requireOnboardingComplete — all three
    // independently hardcoded the legacy '/onboarding' (WelcomePage) target
    // for professionals, so the Entry Experience at '/onboarding/profile' was
    // never reached from the app's actual entry point. Delegating to the
    // canonical guard fixes this and removes the duplicate copy.
    if (user_type === 'professional') {
      const onboardingGuard = requireOnboardingComplete(user);
      if (!onboardingGuard.allowed) {
        // WP-AV-02E — Log: immediately before redirecting / navigation.
        console.log("[Guard Redirect]", onboardingGuard.redirectTo);
        console.log("[Navigation]", onboardingGuard.redirectTo);
        navigate(onboardingGuard.redirectTo, { replace: true });
        return;
      }
      if (!resume_uploaded) {
        // WP-AV-02E — Log: immediately before redirecting / navigation.
        console.log("[Guard Redirect]", '/resume');
        console.log("[Navigation]", '/resume');
        navigate('/resume', { replace: true });
        return;
      }
      // WP-AV-02E — Log: immediately before redirecting / navigation.
      console.log("[Guard Redirect]", '/dashboard');
      console.log("[Navigation]", '/dashboard');
      navigate('/dashboard', { replace: true });
      return;
    }

    // ── Market branch ────────────────────────────────────────────────────────
    // FIX: was '/market-insights' — no such route exists yet.
    // Route to dashboard as fallback until the market page is built.
    if (user_type === 'market') {
      // WP-AV-02E — Log: immediately before redirecting / navigation.
      console.log("[Guard Redirect]", '/dashboard');
      console.log("[Navigation]", '/dashboard');
      navigate('/dashboard', { replace: true });
      return;
    }

    // ── Safe fallback ────────────────────────────────────────────────────────
    // WP-AV-02E — Log: immediately before redirecting / navigation.
    console.log("[Guard Redirect]", '/dashboard');
    console.log("[Navigation]", '/dashboard');
    navigate('/dashboard', { replace: true });
  }, [isHydrated, isError, user, navigate]);

  // Pre-render guard: once hydration settles we know a redirect is imminent.
  // Return null to prevent a spinner flash between route resolution.
  if (isHydrated && (isError || user)) {
    return null;
  }

  return <PageLoading label="Loading HireRise…" />;
}