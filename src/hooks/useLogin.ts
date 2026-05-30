/**
 * src/hooks/useLogin.ts
 *
 * Encapsulates login state and coordinates with Supabase auth.
 *
 * Architecture notes:
 *  - Calls signIn() / signInWithGoogle() from lib/supabase/auth.ts.
 *  - Does NOT manually set tokens or session — Supabase handles this.
 *  - Does NOT redirect — caller (LoginPage) owns routing decisions.
 *  - On SIGNED_IN, AppContext's onAuthStateChange fires automatically
 *    and triggers hydrate() → /users/me → routing.
 *
 * Mirrors the pattern established by useSignUp.ts.
 */

import { useState } from 'react';
import { signIn, signInWithGoogle } from '@/lib/supabase/auth';

export type LoginStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseLoginReturn {
  status: LoginStatus;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  reset: () => void;
}

export function useLogin(): UseLoginReturn {
  const [status, setStatus] = useState<LoginStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // ── Email + password login ──────────────────────────────────────────────
  const login = async (email: string, password: string): Promise<void> => {
    if (status === 'loading') return;

    setStatus('loading');
    setError(null);

    try {
      await signIn(email, password);
      setStatus('success');
      // AppContext's onAuthStateChange handles routing — no redirect here
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
      setStatus('error');
    }
  };

  // ── Google OAuth login ──────────────────────────────────────────────────
  const loginWithGoogle = async (): Promise<void> => {
    if (status === 'loading') return;

    setStatus('loading');
    setError(null);

    try {
      await signInWithGoogle();
      // Browser is redirected to Google by Supabase — no further action here.
      // On return, /auth/callback exchanges the PKCE code; Supabase fires SIGNED_IN,
      // AppContext's onAuthStateChange picks it up and calls hydrate('login').
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google login failed. Please try again.');
      setStatus('error');
    }
  };

  const reset = () => {
    setStatus('idle');
    setError(null);
  };

  return { status, error, login, loginWithGoogle, reset };
}