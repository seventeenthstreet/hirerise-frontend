/**
 * /app/page.tsx — App Entry Gate
 *
 * HARDENING CHANGES:
 *  1. Uses useAppContext() instead of calling useAppEntry() + useUser()
 *     independently — single /users/me fetch across the app (no duplicate calls).
 *  2. Guard fires BEFORE any UI renders: returns null immediately on redirect
 *     so there is zero flicker of the loading spinner between routing decisions.
 *
 * Routing decision tree (unchanged from original):
 *   user_type = null              → /direction
 *   user_type = 'student'
 *     → /education/onboarding (new registry-driven student flow)
 *     (completion guard inside /education/onboarding redirects to /dashboard when done)
 *   user_type = 'professional'
 *     professional_onboarding_complete = false → /onboarding
 *     resume_uploaded = false              → /resume
 *     else                                 → /dashboard
 *   user_type = 'market'          → /market-insights
 *   fallback                      → /dashboard
 *
 * This page NEVER renders UI — it is a pure routing gate.
 *
 * A-05 — Unmounted async routing fix:
 *   The `!user` branch calls getSession().then(router.replace) asynchronously.
 *   If the component unmounts before getSession() resolves (e.g. the user
 *   navigates away, or AppContext completes hydration and triggers a re-render),
 *   router.replace() fires post-unmount. This can produce a conflicting redirect
 *   that overwrites the correct destination route chosen by the new page.
 *
 *   Fix: an `isMounted` ref (set to false in effect cleanup) is checked inside
 *   the async callback before calling router.replace(). If the component has
 *   unmounted, the redirect is silently dropped — the navigation that caused
 *   the unmount is already in progress and owns the route.
 */

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/context/AppContext';
import { getSupabaseClient } from '@/lib/supabase/client';
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
    // Wait until hydration has fully settled before making any routing decision.
    if (!isHydrated) return;

    // Hard failure — send to login.
    if (isError) {
      navigate('/login', { replace: true });
      return;
    }

    // Authenticated but no backend profile yet (e.g. brand-new Google OAuth user).
    // The Supabase session exists but /users/me returned 404.
    // Route to /direction so the user can set up their profile.
    if (!user) {
      getSupabaseClient().auth.getSession().then(({ data: { session } }) => {
        // A-05: Component may have unmounted while getSession() was in-flight.
        // If so, drop the redirect — the navigation that caused unmount already
        // owns the route. Calling router.replace() post-unmount would overwrite
        // the correct destination with a stale routing decision.
        if (!isMounted.current) return;
        navigate(session ? '/direction' : '/login', { replace: true });
      });
      return;
    }

    const {
      user_type,
      student_onboarding_complete: _student_onboarding_complete,
      professional_onboarding_complete,
      onboarding_completed,
      resume_uploaded,
    } = user;

    // ── Direction gate ──────────────────────────────────────────────────────
    if (!user_type) {
      navigate('/direction', { replace: true });
      return;
    }

    // ── Student branch ──────────────────────────────────────────────────────
    // FIX: Students always route to /education/onboarding (new registry-driven flow).
    // /onboarding is the legacy professional flow — calling /api/v1/onboarding
    // which returns 0 steps for student accounts → "0 of 0 steps" / "No onboarding
    // steps found." The completion guard inside /education/onboarding/page.tsx
    // handles the already-complete case → redirects to /dashboard.
    if (user_type === 'student') {
      navigate('/education/onboarding', { replace: true });
      return;
    }

    // ── Professional branch ─────────────────────────────────────────────────
    if (user_type === 'professional') {
      if (!professional_onboarding_complete && !onboarding_completed) {
        navigate('/onboarding', { replace: true });
        return;
      }
      if (!resume_uploaded) {
        navigate('/resume', { replace: true });
        return;
      }
      navigate('/dashboard', { replace: true });
      return;
    }

    // ── Market branch ───────────────────────────────────────────────────────
    if (user_type === 'market') {
      navigate('/market-insights', { replace: true });
      return;
    }

    // ── Safe fallback ───────────────────────────────────────────────────────
    navigate('/dashboard', { replace: true });
  }, [isHydrated, isError, user, navigate]);

  // ── PRE-RENDER GUARD: return null immediately if redirect is needed ────────
  // Once hydration is done and user exists, we know a redirect is imminent.
  // Returning null prevents any flash of the spinner between route resolution.
  if (isHydrated && (isError || user)) {
    return null;
  }

  // Loading screen — shown only while hydration is in-flight.
  return <PageLoading label="Loading HireRise…" />;
}