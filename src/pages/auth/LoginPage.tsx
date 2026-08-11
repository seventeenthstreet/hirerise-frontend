/**
 * src/app/login/page.tsx
 *
 * Email + password login page for HireRise.
 *
 * Flow:
 *  1. User fills email + password → handleSubmit fires.
 *  2. useLogin calls signIn() → supabase.auth.signInWithPassword().
 *  3. On success: AppContext's onAuthStateChange fires SIGNED_IN →
 *     hydrate('login') fetches /app-entry + /users/me → user state is set →
 *     AppEntryPage (/) reads the user and calls router.replace() to the
 *     correct destination. No manual navigation is needed here.
 *
 * Guards:
 *  - If already hydrated AND a user exists, redirect away immediately.
 *    (Prevents logged-in users from seeing the login form.)
 *
 * Styling: matches signup/page.tsx exactly — same card/input/button classes.
 */

import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/context/AppContext';
import { useLogin } from '@/hooks/useLogin';

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, isHydrated } = useAppContext();
  const { status, error, login, loginWithGoogle } = useLogin();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');

  const isLoading = status === 'loading';

  // Guard: redirect logged-in users away from login
  useEffect(() => {
    if (isHydrated && user) {
      navigate('/', { replace: true });
    }
  }, [isHydrated, user, navigate]);

  // Don't flash the form to authenticated users while hydrating
  if (isHydrated && user) return null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) return;

    await login(cleanEmail, cleanPassword);
    // Note: routing is handled by AppContext's onAuthStateChange → hydrate() →
    // AppEntryPage reads the hydrated user and calls router.replace(). No manual
    // push needed here.
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">HireRise</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your account</p>
        </div>

        {error && (
          <div role="alert" className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={isLoading}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={isLoading}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <button
          type="button"
          onClick={loginWithGoogle}
          disabled={isLoading}
          className="w-full rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:opacity-90 disabled:opacity-50"
        >
          {isLoading ? 'Redirecting…' : 'Continue with Google'}
        </button>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <a
            href="/auth/register"
            className="font-medium text-foreground underline underline-offset-2 hover:opacity-80"
          >
            Create one
          </a>
        </p>
      </div>
    </div>
  );
}