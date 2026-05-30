

/**
 * src/app/signup/page.tsx
 *
 * Email + password signup page for HireRise.
 *
 * Flow:
 *  1. User fills email + password → handleSubmit fires.
 *  2. useSignUp calls signUp() → supabase.auth.signUp().
 *  3a. Email confirmation ON (default): session is null, show a "check email"
 *      confirmation screen. User verifies → /auth/callback → /onboarding.
 *  3b. Email confirmation OFF: SIGNED_IN fires → AppContext hydrates →
 *      page.tsx routes to /onboarding automatically. No manual redirect.
 *  3c. Account already exists: friendly yellow notice, no error thrown.
 *
 * Guards:
 *  - If already hydrated AND a user exists, redirect away immediately.
 *    (Prevents logged-in users from seeing the signup form.)
 *
 * Styling: matches login/page.tsx exactly — same card/input/button classes.
 */

import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/context/AppContext';
import { useSignUp } from '@/hooks/useSignUp';

const MIN_PASSWORD_LENGTH = 8;

export default function SignupPage() {
  const navigate = useNavigate();
  const { user, isHydrated } = useAppContext();
  const { status, error, emailConfirmationPending, alreadyExists, signup } = useSignUp();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const isLoading = status === 'loading';
  const isSuccess = status === 'success';

  // Guard: redirect logged-in users away from signup
  useEffect(() => {
    if (isHydrated && user) {
      navigate('/', { replace: true });
    }
  }, [isHydrated, user, navigate]);

  // Don't flash the form to authenticated users while hydrating
  if (isHydrated && user) return null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setLocalError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setLocalError('Passwords do not match.');
      return;
    }

    await signup(email, password);
  }

  // ── Success: email confirmation pending ─────────────────────────────────
  if (isSuccess && emailConfirmationPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-sm space-y-6 rounded-xl border border-border bg-card p-8 shadow-sm text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            {/* Envelope icon */}
            <svg
              className="h-6 w-6 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
              />
            </svg>
          </div>

          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Check your email
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a confirmation link to{' '}
              <span className="font-medium text-foreground">{email}</span>.
              Click it to activate your account and continue to HireRise.
            </p>
          </div>

          {/* ── Refinement 2: already-exists soft notice ─────────────────── */}
          {alreadyExists && (
            <p className="rounded-md bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
              An account with this email already exists. Please check your
              email to verify, or{' '}
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="underline underline-offset-2 hover:opacity-80"
              >
                sign in
              </button>
              .
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Didn&apos;t receive it? Check your spam folder or{' '}
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="underline underline-offset-2 hover:text-foreground"
            >
              sign in
            </button>{' '}
            once you&apos;ve verified.
          </p>
        </div>
      </div>
    );
  }

  // ── Main form ────────────────────────────────────────────────────────────
  const displayError = localError ?? error;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">HireRise</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create your account</p>
        </div>

        {displayError && (
          <div role="alert" className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {displayError}
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
              autoComplete="new-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={isLoading}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              placeholder="Min. 8 characters"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="confirm" className="block text-sm font-medium text-foreground">
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
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
            {isLoading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <a href="/login" className="font-medium text-foreground underline underline-offset-2 hover:opacity-80">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}