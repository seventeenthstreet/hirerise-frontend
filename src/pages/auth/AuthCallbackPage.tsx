/**
 * src/pages/auth/AuthCallbackPage.tsx
 *
 * OAuth callback landing page.
 *
 * FIX-03 (HIGH): Removed the duplicate `supabase.auth.onAuthStateChange(...)`
 * subscription that previously lived in this page. AppContext is the single
 * source of truth for auth state — no component, guard, page, hook, or
 * service should create independent auth subscriptions.
 *
 * How it works now:
 *  - The Supabase browser client has `detectSessionInUrl: true`. When this
 *    page mounts, the client automatically detects `?code=` in the URL,
 *    exchanges it for a session via PKCE, and persists it to localStorage.
 *  - That exchange fires SIGNED_IN (or INITIAL_SESSION) on Supabase's auth
 *    listener. AppContext's single `onAuthStateChange` subscription picks
 *    this up, calls hydrate('login'), fetches /app-entry + /users/me, and
 *    sets `user` + `isHydrated`.
 *  - This page simply WAITS for AppContext to report `isHydrated === true`,
 *    then redirects:
 *      - `isError` or no `user`        → /auth/login?error=auth_timeout
 *      - `user` present                → /  (AppEntryPage routes onward)
 *  - A safety timeout still exists in case hydration never completes
 *    (e.g. the PKCE code was invalid/already used and no auth event ever
 *    fires). It checks `isHydrated` via a ref so it never races a second
 *    redirect against the AppContext-driven one.
 */

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/context/AppContext';

const CALLBACK_TIMEOUT_MS = 8_000;

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { isHydrated, isError, user } = useAppContext();

  // Single-redirect guard — prevents a competing redirect from the safety
  // timeout after AppContext-driven hydration has already navigated away.
  const redirectedRef = useRef(false);

  // Mirror isHydrated/isError/user into refs so the timeout callback (set up
  // once on mount) can read the latest values without re-registering.
  const stateRef = useRef({ isHydrated, isError, user });
  stateRef.current = { isHydrated, isError, user };

  // Redirect once AppContext finishes hydrating.
  useEffect(() => {
    if (!isHydrated || redirectedRef.current) return;

    redirectedRef.current = true;

    if (isError || !user) {
      navigate('/auth/login?error=auth_timeout', { replace: true });
      return;
    }

    navigate('/', { replace: true });
  }, [isHydrated, isError, user, navigate]);

  // Safety timeout — if AppContext never reaches isHydrated (e.g. the PKCE
  // code was invalid/already used and no auth event fires at all), send the
  // user back to login rather than leaving them on this page forever.
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (redirectedRef.current) return;
      if (stateRef.current.isHydrated) return; // already handled by the effect above

      redirectedRef.current = true;
      navigate('/auth/login?error=auth_timeout', { replace: true });
    }, CALLBACK_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <div className="text-sm text-muted-foreground">Signing you in…</div>
        <div className="h-1 w-32 rounded bg-border overflow-hidden mx-auto">
          <div className="h-full bg-primary animate-pulse rounded" />
        </div>
      </div>
    </div>
  );
}