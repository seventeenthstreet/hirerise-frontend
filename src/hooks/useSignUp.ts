/**
 * src/hooks/useSignUp.ts
 *
 * Encapsulates signup state and coordinates with Supabase auth.
 *
 * Architecture notes:
 *  - Calls signUp() from lib/supabase/auth.ts (not Supabase client directly).
 *  - Does NOT manually set tokens or session — Supabase handles this.
 *  - Does NOT redirect — caller (SignupPage) owns routing decisions.
 *  - On SIGNED_IN (email confirm disabled), AppContext's onAuthStateChange
 *    fires automatically and triggers hydrate() → /users/me → routing.
 *
 * React Query is NOT used here because signup is a one-shot mutation
 * with local loading/error state, not a cache entry. If you need
 * optimistic UI or cache invalidation post-signup, use useMutation.
 */

import { useState } from 'react';
import { signUp, type SignUpResult } from '@/lib/supabase/auth';

export type SignUpStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseSignUpReturn {
  status: SignUpStatus;
  error: string | null;
  emailConfirmationPending: boolean;
  alreadyExists: boolean;
  signup: (email: string, password: string) => Promise<void>;
  reset: () => void;
}

export function useSignUp(): UseSignUpReturn {
  const [status, setStatus] = useState<SignUpStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [emailConfirmationPending, setEmailConfirmationPending] = useState(false);
  const [alreadyExists, setAlreadyExists] = useState(false);

  const signup = async (email: string, password: string): Promise<void> => {
    // ── Refinement 1: prevent duplicate submissions ──────────────────────
    if (status === 'loading') return;

    setStatus('loading');
    setError(null);
    setAlreadyExists(false);

    try {
      const result: SignUpResult = await signUp(email, password);
      setEmailConfirmationPending(result.emailConfirmationPending);
      setAlreadyExists(result.alreadyExists);
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed. Please try again.');
      setStatus('error');
    }
  };

  const reset = () => {
    setStatus('idle');
    setError(null);
    setEmailConfirmationPending(false);
    setAlreadyExists(false);
  };

  return { status, error, emailConfirmationPending, alreadyExists, signup, reset };
}