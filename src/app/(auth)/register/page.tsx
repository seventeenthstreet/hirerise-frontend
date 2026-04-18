'use client';

/**
 * app/(auth)/register/page.tsx — MIGRATED TO SUPABASE AUTH
 *
 * Replaces:
 *   import { createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth'
 *   import { firebaseAuth } from '@/lib/firebase'
 *
 * With:
 *   import { signUpWithEmail, signInWithGoogle } from '@/lib/auth'
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signUpWithEmail, signInWithGoogle } from '@/lib/auth';

export default function RegisterPage() {
  const router  = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 8)  { setError('Password must be at least 8 characters'); return; }

    setLoading(true);
    setError(null);

    try {
      const { error: authError } = await signUpWithEmail(email, password);
      if (authError) {
        console.error('[Auth] Registration failed', { reason: authError });
        setError(authError);
        return;
      }
      // Supabase may send a confirmation email depending on your project settings.
      // If email confirmation is OFF, session is set immediately → redirect.
      console.info('[Auth] Registration success — navigating to /onboarding');
      router.replace('/onboarding');
    } catch (err) {
      console.error('[Auth] Registration threw unexpectedly', { error: err instanceof Error ? err.message : String(err) });
      setError('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleRegister() {
    setLoading(true);
    setError(null);
    try {
      const { error: authError } = await signInWithGoogle();
      if (authError) {
        console.error('[Auth] Google registration failed', { reason: authError });
        setError(authError);
        setLoading(false);
      }
    } catch (err) {
      console.error('[Auth] Google registration threw unexpectedly', { error: err instanceof Error ? err.message : String(err) });
      setError('Google sign up failed.');
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
          <p className="text-sm text-[#5f6d87] mt-2">Create your account</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm text-[#dde4ef] mb-1">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full bg-[#161f2e] border border-white/8 rounded-lg px-4 py-3 text-[#dde4ef] text-sm focus:outline-none focus:border-[#3c72f8]"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm text-[#dde4ef] mb-1">Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full bg-[#161f2e] border border-white/8 rounded-lg px-4 py-3 text-[#dde4ef] text-sm focus:outline-none focus:border-[#3c72f8]"
              placeholder="Min. 8 characters"
            />
          </div>
          <div>
            <label className="block text-sm text-[#dde4ef] mb-1">Confirm password</label>
            <input
              type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
              className="w-full bg-[#161f2e] border border-white/8 rounded-lg px-4 py-3 text-[#dde4ef] text-sm focus:outline-none focus:border-[#3c72f8]"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full py-3 bg-[#3c72f8] text-white font-semibold rounded-lg text-sm disabled:opacity-60"
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="flex-1 h-px bg-white/8" />
          <span className="text-xs text-[#5f6d87]">or</span>
          <div className="flex-1 h-px bg-white/8" />
        </div>

        <button
          onClick={handleGoogleRegister} disabled={loading}
          className="w-full py-3 border border-white/10 text-[#dde4ef] font-medium rounded-lg text-sm hover:bg-white/5 disabled:opacity-60"
        >
          Continue with Google
        </button>

        <p className="text-center text-sm text-[#5f6d87] mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-[#3c72f8] hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}