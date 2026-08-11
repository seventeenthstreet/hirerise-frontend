/**
 * src/lib/supabase/client.ts
 *
 * Browser-side Supabase client — singleton.
 *
 * FIX-01 (CRITICAL): Removed the "placeholder.supabase.co" fallback.
 *
 * ROOT CAUSE OF THE PLACEHOLDER REDIRECT:
 *   `.env.local` previously contained a UTF-8 BOM before the first key
 *   (`VITE_SUPABASE_URL`). Vite's env loader read the key as
 *   "\uFEFFVITE_SUPABASE_URL" instead of "VITE_SUPABASE_URL", so
 *   `import.meta.env.VITE_SUPABASE_URL` was `undefined`. The old
 *   implementation silently fell back to a fake client pointed at
 *   `https://placeholder.supabase.co`, which is why OAuth and all
 *   Supabase calls were redirecting to a non-existent project.
 *
 * NEW BEHAVIOUR:
 *   - Reads ONLY `import.meta.env.VITE_SUPABASE_URL` and
 *     `import.meta.env.VITE_SUPABASE_ANON_KEY` (Vite-only — no
 *     NEXT_PUBLIC_* fallback, no placeholder fallback).
 *   - If either is missing, THROWS immediately at module evaluation time
 *     with an actionable error message. This is intentional: a missing
 *     Supabase config is a fatal misconfiguration, not a recoverable
 *     runtime state. Failing loudly here surfaces the problem at the
 *     `.env.local` level instead of producing confusing downstream
 *     "Invalid login credentials" / "placeholder.supabase.co" symptoms.
 *   - AppErrorBoundary (mounted at the root of AppProviders) catches this
 *     throw during the initial render and shows a clear error screen with
 *     a "Refresh" button, rather than crashing to a blank page.
 *
 * Singleton: getSupabaseClient() always returns the same client instance
 * after the first successful call.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

/**
 * Reads a required Vite env var.
 * Throws a descriptive error if missing or empty.
 */
function requireEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  const env = import.meta.env as Record<string, string | undefined>;
  const value = env[name];

  if (!value) {
    throw new Error(
      `[Supabase] Missing required environment variable: ${name}.\n` +
      `Add it to front/.env.local (Vite requires the VITE_ prefix):\n` +
      `  VITE_SUPABASE_URL=https://your-project.supabase.co\n` +
      `  VITE_SUPABASE_ANON_KEY=your-anon-key\n` +
      `\n` +
      `If the variable is already present in .env.local but this error ` +
      `still appears, check the file for a leading UTF-8 BOM (invisible ` +
      `byte-order-mark character) on the first line — it corrupts the ` +
      `first variable name. Re-save the file as UTF-8 without BOM, then ` +
      `restart "npm run dev".`,
    );
  }

  return value;
}

/**
 * Returns the singleton Supabase browser client.
 *
 * Throws synchronously on first call if VITE_SUPABASE_URL or
 * VITE_SUPABASE_ANON_KEY are missing/empty — see requireEnv() above.
 */
export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const url     = requireEnv('VITE_SUPABASE_URL');
  const anonKey = requireEnv('VITE_SUPABASE_ANON_KEY');

  _client = createClient(url, anonKey, {
    auth: {
      persistSession:     true,
      autoRefreshToken:   true,
      detectSessionInUrl: true,
    },
  });

  return _client;
}

/**
 * Returns the current session's access_token, or null if not signed in.
 *
 * Note: this still returns null gracefully on auth errors (e.g. no
 * session) — only missing *configuration* (handled by getSupabaseClient)
 * throws. A signed-out user is a normal, expected state.
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