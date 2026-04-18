// src/lib/auth.ts
//
// Browser-side Supabase auth utilities.
// Client-safe only. Server token verification must live in a server-only module.

import { createBrowserClient } from '@supabase/ssr';
import type {
  Session,
  SupabaseClient,
  User,
} from '@supabase/supabase-js';

let authClient: SupabaseClient | null = null;

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  return { url, key };
}

export function getAuthClient(): SupabaseClient {
  if (authClient) return authClient;

  const { url, key } = getEnv();
  authClient = createBrowserClient(url, key);

  return authClient;
}

export interface AuthResult {
  user: User | null;
  session: Session | null;
  error: string | null;
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  const { data, error } =
    await getAuthClient().auth.signInWithPassword({
      email,
      password,
    });

  return {
    user: data.user ?? null,
    session: data.session ?? null,
    error: error?.message ?? null,
  };
}

export async function signUpWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  const { data, error } =
    await getAuthClient().auth.signUp({
      email,
      password,
    });

  return {
    user: data.user ?? null,
    session: data.session ?? null,
    error: error?.message ?? null,
  };
}

export async function signInWithGoogle(): Promise<{
  error: string | null;
}> {
  const redirectTo = `${window.location.origin}/api/auth/callback`;

  const { data, error } =
    await getAuthClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });

  if (error) {
    return { error: error.message };
  }

  if (data?.url) {
    window.location.assign(data.url);
  }

  return { error: null };
}

export async function signOut(): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem('hirerise-user');
      localStorage.removeItem('hirerise-user');
      localStorage.removeItem(
        'hirerise_user_direction'
      );
    } catch {
      // ignore storage-restricted browsers
    }
  }

  await getAuthClient().auth.signOut();
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data } =
    await getAuthClient().auth.getSession();

  return data.session ?? null;
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getCurrentSession();
  return session?.user ?? null;
}

export async function getIdToken(): Promise<string | null> {
  const session = await getCurrentSession();

  if (session?.access_token) {
    return session.access_token;
  }

  const { data } =
    await getAuthClient().auth.getUser();

  if (!data.user) {
    return null;
  }

  const { data: restored } =
    await getAuthClient().auth.getSession();

  return restored.session?.access_token ?? null;
}

export function onAuthStateChange(
  callback: (
    user: User | null,
    session: Session | null,
    event: string
  ) => void
): () => void {
  const {
    data: { subscription },
  } = getAuthClient().auth.onAuthStateChange(
    (event, session) => {
      callback(
        session?.user ?? null,
        session,
        event
      );
    }
  );

  return () => subscription.unsubscribe();
}