'use client';

/**
 * src/lib/supabase/client.ts
 *
 * Browser-side Supabase client — singleton.
 * Uses @supabase/supabase-js (base package — no SSR wrapper needed for client components).
 *
 * Required env vars in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      '[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local',
    );
  }

  _client = createClient(url, anonKey, {
    auth: {
      persistSession:    true,
      autoRefreshToken:  true,
      detectSessionInUrl: true,
    },
  });

  return _client;
}

/**
 * Returns the current session's access_token, or null if not signed in.
 * Safe to call on every request — uses the cached session; only hits
 * Supabase network when the token needs refreshing.
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}