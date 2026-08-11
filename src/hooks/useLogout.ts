/**
 * src/hooks/useLogout.ts
 *
 * FIX-05 (HIGH): Centralized logout hook.
 *
 * Single entry point for signing a user out. Replaces the ad-hoc
 * `getSupabaseClient().auth.signOut()` call that previously existed only in
 * src/pages/direction/DirectionPage.tsx — that page now uses this hook too
 * (see DirectionPage update note below), and DashboardLayout / AdminLayout
 * are wired to it as part of FIX-06.
 *
 * Flow:
 *  1. Call supabase.auth.signOut().
 *  2. Supabase fires SIGNED_OUT on the singleton auth listener.
 *  3. AppContext's onAuthStateChange handler (the ONLY subscription) picks
 *     up SIGNED_OUT, clears `user`, resets hydration latches, cancels
 *     in-flight queries, and removes the ['user','me'] / app-entry React
 *     Query cache entries. No additional cache-clearing is needed here.
 *  4. This hook navigates to /auth/login afterwards. GuestGuard would also
 *     redirect an authenticated user away from /auth/login, but since the
 *     session is now cleared, GuestGuard sees `user === null` and renders
 *     the login form normally.
 *
 * Failure handling:
 *  - If `signOut()` itself throws (rare — typically only on network errors),
 *    we still navigate to /auth/login. A failed signOut call does not mean
 *    the local session is still valid in any meaningful UI sense, and
 *    leaving the user stuck on a protected page with a broken sign-out
 *    button is worse than redirecting them to re-authenticate.
 *  - The error is logged via console.error for visibility; this hook does
 *    not surface a toast itself (ToastProvider is currently a placeholder —
 *    callers may layer their own UI feedback if desired).
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupabaseClient } from '@/lib/supabase/client';

export type UseLogoutReturn = () => Promise<void>;

export function useLogout(): UseLogoutReturn {
  const navigate = useNavigate();

  return useCallback(async () => {
    try {
      const { error } = await getSupabaseClient().auth.signOut();
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[useLogout] signOut returned an error:', error.message);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[useLogout] signOut threw:', err);
    } finally {
      // AppContext's SIGNED_OUT handler clears user/cache asynchronously via
      // the auth listener. Navigate regardless — GuestGuard will not block
      // this since the session is being torn down.
      navigate('/auth/login', { replace: true });
    }
  }, [navigate]);
}