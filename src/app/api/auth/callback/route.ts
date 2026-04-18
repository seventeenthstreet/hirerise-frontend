import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/auth/callback
 *
 * Server-side Route Handler for Supabase OAuth PKCE exchange.
 * Runs on the server — has full cookie access for the code_verifier.
 *
 * Next.js 15: cookies() is async and must be awaited.
 *
 * FIX: Redirect target changed from /dashboard to /onboarding.
 *
 * WHY:
 *   Redirecting to /dashboard after OAuth caused an unnecessary bounce:
 *     /dashboard → AuthGuard → onboarding incomplete → /onboarding
 *
 *   The AuthProvider hasn't hydrated the backend user yet when the redirect
 *   lands on /dashboard, so AuthGuard sees isLoading=true briefly, then sees
 *   an incomplete onboarding state and fires another redirect.
 *
 *   By redirecting to /onboarding directly, AuthGuard applies the correct
 *   rule in a single step:
 *     • Onboarding complete   → /career-dashboard or /student-dashboard
 *     • Onboarding incomplete → renders /onboarding (no extra hop)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code  = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    console.error('[AuthCallback] OAuth provider returned error', { error });
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    console.error('[AuthCallback] No code present in callback URL', { url: request.url });
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  // Next.js 15: cookies() returns a Promise — must be awaited
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error('[AuthCallback] PKCE code exchange failed', {
      message: exchangeError.message,
      status:  exchangeError.status,
    });
    return NextResponse.redirect(
      `${origin}/login?error=callback_failed&reason=${encodeURIComponent(exchangeError.message)}`
    );
  }

  console.info('[AuthCallback] Session established via OAuth', {
    userId:   sessionData?.user?.id ?? 'unknown',
    provider: sessionData?.user?.app_metadata?.provider ?? 'unknown',
  });

  // Redirect to /onboarding — AuthGuard will route from there:
  //   • Onboarding complete   → /career-dashboard or /student-dashboard
  //   • Onboarding incomplete → renders /onboarding directly
  return NextResponse.redirect(`${origin}/onboarding`);
}