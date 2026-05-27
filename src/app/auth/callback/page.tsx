'use client';

/**
 * src/app/auth/callback/page.tsx
 *
 * OAuth callback landing page.
 *
 * Why a client page instead of a server route.ts?
 *  The Supabase browser client has `detectSessionInUrl: true`.
 *  When this page mounts, the client automatically detects ?code= in the URL,
 *  exchanges it for a session via PKCE, persists it to localStorage, and fires
 *  the SIGNED_IN auth state change event.
 *
 *  AppContext's onAuthStateChange listener picks up SIGNED_IN → calls hydrate()
 *  → fetches /users/me → sets user → page.tsx routes to the right destination.
 *
 *  A server route.ts cannot do this because:
 *   1. It runs before the browser client exists — no detectSessionInUrl.
 *   2. exchangeCodeForSession server-side with persistSession:false discards
 *      the session immediately — the browser never receives it.
 *   3. The PKCE code is single-use — once the server consumes it, the browser
 *      client cannot exchange it again.
 *
 * This page intentionally does nothing except show a loading indicator.
 * All session logic is handled by the Supabase client automatically.
 *
 * A-04 / N-04 — Callback timeout race fix:
 *   Previously, the timeout handler and the SIGNED_IN handler both called
 *   router.replace() without coordinating. In a slow-network scenario:
 *     1. Supabase code exchange takes >8s → timeout fires → /login redirect
 *     2. Supabase exchange completes 200ms later → SIGNED_IN fires → / redirect
 *   Result: two competing router.replace() calls, partial auth state, stuck / page.
 *
 *   Fix: a `redirected` ref ensures exactly one redirect fires per mount.
 *   The first caller (either SIGNED_IN or the timeout) sets redirected=true
 *   synchronously before navigating. The second caller sees the flag and exits.
 *   This collapses two racing redirect paths into a single deterministic outcome.
 */

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';

export default function AuthCallbackPage() {
  const router = useRouter();
  // A-04: single-redirect guard — prevents competing router.replace() calls
  // between the SIGNED_IN handler and the safety timeout.
  const redirected = useRef(false);

  useEffect(() => {
    // The Supabase client exchanges the ?code= automatically on mount
    // due to detectSessionInUrl: true. We just need to wait for it and
    // then navigate — AppContext's onAuthStateChange handles user hydration.
    const supabase = getSupabaseClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        // A-04: guard against the timeout having already redirected.
        if (redirected.current) return;
        redirected.current = true;
        subscription.unsubscribe();
        router.replace('/');
      }
    });

    // Safety timeout — if no SIGNED_IN fires within 8 seconds, something went
    // wrong (e.g. code already used, network failure). Send to login.
    const timeout = setTimeout(() => {
      // A-04: guard against SIGNED_IN having already redirected.
      if (redirected.current) return;
      redirected.current = true;
      subscription.unsubscribe();
      router.replace('/login?error=auth_timeout');
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

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