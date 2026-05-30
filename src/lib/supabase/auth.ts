/**
 * src/lib/supabase/auth.ts
 *
 * Thin auth helper wrappers around the Supabase browser client.
 * Business logic lives in hooks — these are pure data functions.
 *
 * Why not call supabase.auth directly from hooks?
 *  - Single import surface: swap auth strategy here, nowhere else.
 *  - Easier to unit-test: mock this module, not the Supabase client.
 *  - Error normalisation: all Supabase AuthErrors surface as plain Error.
 */

import { getSupabaseClient } from './client';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface SignUpResult {
  /** True when Supabase has sent a confirmation email (email confirm enabled). */
  emailConfirmationPending: boolean;
  /** True when the email is already registered — treated as a soft success. */
  alreadyExists: boolean;
  /** The raw user id returned from Supabase, if immediately available. */
  userId: string | null;
}

export interface SignInResult {
  /** The authenticated user's id. */
  userId: string;
  /** True when a session was returned immediately (email confirm disabled). */
  hasSession: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// SIGN UP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new Supabase user with email + password.
 *
 * Behaviour:
 *  - If email confirmation is enabled (default), data.session will be null
 *    and the user must verify their email first.
 *  - If email confirmation is disabled, data.session is returned immediately
 *    and AppContext's onAuthStateChange fires SIGNED_IN automatically.
 *  - If the email is already registered, returns { alreadyExists: true }
 *    instead of throwing, so the UI can surface a friendly message.
 *
 * Throws on any other AuthError (weak password, rate-limit, etc.).
 */
export async function signUp(
  email: string,
  password: string,
): Promise<SignUpResult> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    if (error.message?.includes('already registered')) {
      return {
        emailConfirmationPending: true,
        alreadyExists: true,
        userId: null,
      };
    }
    throw error;
  }

  return {
    emailConfirmationPending: data.session === null,
    alreadyExists: false,
    userId: data.user?.id ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SIGN IN (email + password)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Signs in an existing user with email + password.
 *
 * On success, Supabase persists the session automatically.
 * AppContext's onAuthStateChange fires SIGNED_IN, which triggers
 * hydrate() → /users/me → routing. No manual redirect needed.
 *
 * Error messages are normalised — raw Supabase strings are never
 * exposed to the UI.
 */
export async function signIn(
  email: string,
  password: string,
): Promise<SignInResult> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const msg = error.message ?? '';

    // ── Normalised error messages ────────────────────────────────────────
    if (msg.includes('Invalid login credentials')) {
      throw new Error('Invalid email or password.');
    }
    if (msg.includes('Email not confirmed')) {
      throw new Error('Please verify your email before logging in.');
    }
    // Fallback — never leak raw Supabase error strings to the UI
    throw new Error('Login failed. Please try again.');
  }

  return {
    userId: data.user.id,
    hasSession: Boolean(data.session),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SIGN IN (Google OAuth)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initiates Google OAuth sign-in via Supabase.
 *
 * Supabase redirects the browser to Google, then back to /auth/callback
 * where the session is exchanged. AuthListenerMount picks up SIGNED_IN
 * and calls router.refresh() automatically — no manual handling needed.
 *
 * Prerequisites (Supabase dashboard):
 *  1. Authentication → Providers → Google → Enable
 *  2. Add Google Cloud Console OAuth credentials
 *  3. Add redirect URLs:
 *       http://localhost:3000/auth/callback
 *       https://yourdomain.com/auth/callback
 */
export async function signInWithGoogle(): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    throw new Error('Google login failed. Please try again.');
  }
  // No return value — browser is redirected by Supabase immediately
}