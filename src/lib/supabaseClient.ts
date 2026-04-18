/**
 * lib/supabaseClient.ts — Browser Supabase client for database operations
 *
 * PURPOSE
 * ───────
 * This client is for querying Supabase TABLES (`.from('profiles')`, etc.).
 * It is intentionally separate from the auth client in `lib/auth.ts`, which
 * uses `@supabase/ssr`'s `createBrowserClient` and owns cookie-based session
 * management for Next.js App Router.
 *
 * WHY A SEPARATE FILE?
 * ────────────────────
 * `lib/auth.ts` → `createBrowserClient` (@supabase/ssr)
 *   Purpose : auth session, token refresh, SSR cookie sync
 *   Do NOT use .from() on this client — its session handling is tuned for
 *   auth flows and the @supabase/ssr package may wrap it differently.
 *
 * `lib/supabaseClient.ts` → `createClient` (@supabase/supabase-js)  ← YOU ARE HERE
 *   Purpose : database queries (.from, .rpc, .storage)
 *   Uses the same anon key + URL, so RLS still applies.
 *   Simple singleton — no cookie plumbing needed for browser DB calls.
 *
 * `lib/supabase.ts` → service-role client (server-only, API routes only)
 *   NEVER import this in client components — the service-role key must never
 *   reach the browser bundle.
 *
 * SECURITY CONTRACT
 * ─────────────────
 * • Uses NEXT_PUBLIC_SUPABASE_ANON_KEY — safe to ship in browser bundles.
 * • Row Level Security (RLS) is your enforcement layer. Every query runs as
 *   the authenticated user (auth.uid() resolves from the active session cookie).
 * • Never add SUPABASE_SERVICE_ROLE_KEY here.
 *
 * USAGE
 * ─────
 * import { supabase } from '@/lib/supabaseClient';
 *
 * const { data, error } = await supabase.from('profiles').select('*');
 */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

// ── Env validation ─────────────────────────────────────────────────────────────
// Validated at module load time so misconfiguration fails loudly in dev,
// rather than producing a silent null client that errors at query time.

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    '[supabaseClient] Missing environment variables.\n' +
    'Both NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be ' +
    'set in .env.local.\n' +
    'These are the same values already used by lib/auth.ts.'
  );
}

// ── Singleton client ───────────────────────────────────────────────────────────
// One instance for the lifetime of the browser tab.
// `createClient` from @supabase/supabase-js (not @supabase/ssr) — this is
// intentional. The SSR wrapper is only needed for the auth client that manages
// cookie-based sessions. For plain DB queries the standard client is correct
// and simpler.

let _dbClient: SupabaseClient | null = null;

function getDbClient(): SupabaseClient {
  if (_dbClient) return _dbClient;

  _dbClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: {
      // This client does NOT manage the auth session — that is lib/auth.ts's job.
      // Disable auto-refresh and session persistence here so the two clients
      // never race to refresh the same token.
      autoRefreshToken:  false,
      persistSession:    false,
      // detectSessionInUrl: false keeps this client from intercepting OAuth
      // callback URLs that are already handled by lib/auth.ts / the callback route.
      detectSessionInUrl: false,
    },
    global: {
      // Attach the active session's JWT to every request automatically.
      // By providing a custom fetch wrapper we read the access token from the
      // auth client's in-memory cache (already populated by lib/auth.ts) and
      // inject it as a Bearer header. This means DB queries run as the
      // authenticated user and RLS rules apply correctly — without this client
      // needing to manage any session state itself.
      fetch: async (url: RequestInfo | URL, options: RequestInit = {}) => {
        // Lazy import to avoid a circular-dependency at module load time.
        // getAuthClient() is a singleton function defined in lib/auth.ts;
        // calling it here does NOT initialise a second Supabase client —
        // it returns the already-created instance.
        const { getAuthClient } = await import('@/lib/auth');
        const { data } = await getAuthClient().auth.getSession();
        const token     = data.session?.access_token;

        const headers = new Headers(options.headers);
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }

        return fetch(url, { ...options, headers });
      },
    },
  });

  return _dbClient;
}

// ── Named export: proxy that forwards all property accesses to the singleton ──
//
// Exporting a Proxy instead of calling getDbClient() directly means:
//   1. The singleton is created lazily (on first property access), not at
//      module import time — safe during SSR / server component evaluation
//      where the DOM is not available.
//   2. Call sites can write `supabase.from(...)` without an extra function call.

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop: string | symbol) {
    const client = getDbClient();
    const value  = (client as unknown as Record<string | symbol, unknown>)[prop];
    // Preserve `this` binding for methods like .from(), .rpc(), .storage
    return typeof value === 'function' ? value.bind(client) : value;
  },
});