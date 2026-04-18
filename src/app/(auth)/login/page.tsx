'use client';

/**
 * app/(auth)/login/page.tsx
 *
 * FIX: Post-login navigation now goes to /onboarding instead of /dashboard.
 *
 * WHY THIS MATTERS:
 *   The previous code called router.replace('/dashboard') immediately after
 *   signInWithEmail(). This hardcoded destination bypassed the routing rules:
 *
 *     /dashboard → AuthGuard fires → onboarding incomplete → /onboarding
 *     → AuthGuard fires again → ... (unnecessary round-trip + flash)
 *
 *   The fix: navigate to /onboarding after login. AuthGuard then applies the
 *   correct rule in a single step:
 *     - Onboarding complete   → redirects to /career-dashboard or /student-dashboard
 *     - Onboarding incomplete → renders /onboarding directly (no extra hop)
 *
 *   This eliminates the intermediate /dashboard bounce and the associated
 *   double-render of AuthGuard.
 *
 * FIX: waitForSession() subscription leak (retained from previous version)
 *   The subscription is ALWAYS unsubscribed before this promise resolves,
 *   regardless of which path fires — no listener leaks.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signInWithEmail, signInWithGoogle, getAuthClient } from '@/lib/auth';

/**
 * waitForSession(maxMs)
 *
 * Resolves once Supabase confirms a live session via onAuthStateChange,
 * or after maxMs milliseconds (whichever comes first).
 *
 * The subscription is ALWAYS unsubscribed before this promise resolves,
 * regardless of which path fires — no listener leaks.
 */
function waitForSession(maxMs = 5_000): Promise<void> {
  return new Promise((resolve) => {
    let subscription: { unsubscribe: () => void } | null = null;

    const done = () => {
      subscription?.unsubscribe();
      subscription = null;
      resolve();
    };

    const timer = setTimeout(done, maxMs);

    const { data } = getAuthClient().auth.onAuthStateChange((_event, session) => {
      if (session) {
        clearTimeout(timer);
        done();
      }
    });

    subscription = data.subscription;
  });
}

export default function LoginPage() {
  const router  = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: authError } = await signInWithEmail(email, password);
      if (authError) {
        console.error('[Auth] Email login failed', { reason: authError });
        setError(authError);
        return;
      }

      // Wait for the session cookie to be written before navigating.
      // AuthProvider's mount probe + onAuthStateChange will handle backend hydration.
      await waitForSession();

      console.info('[Auth] Email login success — navigating to /onboarding');
      // Navigate to /onboarding — AuthGuard will apply the correct rule:
      //   • Onboarding complete   → /career-dashboard or /student-dashboard
      //   • Onboarding incomplete → renders /onboarding directly
      // This avoids the /dashboard → AuthGuard → /onboarding bounce.
      router.replace('/onboarding');
    } catch (err) {
      console.error('[Auth] Email login threw unexpectedly', { error: err instanceof Error ? err.message : String(err) });
      setError('Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setLoading(true);
    setError(null);
    try {
      const { error: authError } = await signInWithGoogle();
      if (authError) {
        console.error('[Auth] Google login failed', { reason: authError });
        setError(authError);
      }
      // Google OAuth redirects via /api/auth/callback — no router.replace needed here
    } catch (err) {
      console.error('[Auth] Google login threw unexpectedly', { error: err instanceof Error ? err.message : String(err) });
      setError('Google sign in failed. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#07090f] px-4">
      <div className="w-full max-w-md bg-[#0d1117] border border-white/8 rounded-2xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-white">
            Hire<span className="text-[#3c72f8]">Rise</span>
          </h1>
          <p className="text-sm text-[#5f6d87] mt-2">Sign in to your account</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label className="block text-sm text-[#dde4ef] mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-[#161f2e] border border-white/8 rounded-lg px-4 py-3 text-[#dde4ef] text-sm focus:outline-none focus:border-[#3c72f8]"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm text-[#dde4ef] mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-[#161f2e] border border-white/8 rounded-lg px-4 py-3 text-[#dde4ef] text-sm focus:outline-none focus:border-[#3c72f8]"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#3c72f8] text-white font-semibold rounded-lg text-sm disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="flex-1 h-px bg-white/8" />
          <span className="text-xs text-[#5f6d87]">or</span>
          <div className="flex-1 h-px bg-white/8" />
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full py-3 border border-white/10 text-[#dde4ef] font-medium rounded-lg text-sm hover:bg-white/5 disabled:opacity-60"
        >
          Continue with Google
        </button>

        <p className="text-center text-sm text-[#5f6d87] mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-[#3c72f8] hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}