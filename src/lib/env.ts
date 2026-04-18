/**
 * lib/env.ts — Frontend Environment Validator (MIGRATED: Firebase removed)
 *
 * All FIREBASE_* variables removed.
 * Supabase Auth is now the authentication provider.
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   NEXT_PUBLIC_API_BASE_URL
 *
 * Server-only (API routes):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

function required(name: string): string {
  const val = process.env[name];
  if (!val || !val.trim()) {
    throw new Error(`[env] Missing required variable: ${name}\nAdd it to .env.local`);
  }
  return val.trim();
}

function optional(name: string, defaultValue = ''): string {
  return process.env[name]?.trim() || defaultValue;
}

// ── Client-side environment (safe for browser bundle) ─────────────────────────

function buildClientEnv() {
  return Object.freeze({
    API_BASE_URL:      required('NEXT_PUBLIC_API_BASE_URL'),
    APP_URL:           optional('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
    SUPABASE_URL:      required('NEXT_PUBLIC_SUPABASE_URL'),
    SUPABASE_ANON_KEY: required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  });
}

// ── Server-side environment (API routes only) ─────────────────────────────────

function buildServerEnv() {
  if (typeof window !== 'undefined') {
    throw new Error(
      '[env] serverEnv accessed in browser. Import only from Next.js API routes.'
    );
  }

  return Object.freeze({
    SUPABASE_URL:              optional('SUPABASE_URL'),
    SUPABASE_SERVICE_ROLE_KEY: optional('SUPABASE_SERVICE_ROLE_KEY'),
    GEMINI_API_KEY:            optional('GEMINI_API_KEY'),
    GROQ_API_KEY:              optional('GROQ_API_KEY'),
    MISTRAL_API_KEY:           optional('MISTRAL_API_KEY'),
    OPENROUTER_API_KEY:        optional('OPENROUTER_API_KEY'),
    ANTHROPIC_API_KEY:         optional('ANTHROPIC_API_KEY'),
    GROK_API_KEY:              optional('GROK_API_KEY'),
  });
}

// ── Validate and export ───────────────────────────────────────────────────────

let clientEnv: ReturnType<typeof buildClientEnv>;
let serverEnv: ReturnType<typeof buildServerEnv>;

try {
  clientEnv = buildClientEnv();
} catch (err: any) {
  if (process.env.NODE_ENV === 'production') throw err;
  console.warn(`[env] ${err.message}`);
  clientEnv = {
    API_BASE_URL:      process.env.NEXT_PUBLIC_API_BASE_URL      || 'http://localhost:8080',
    APP_URL:           process.env.NEXT_PUBLIC_APP_URL            || 'http://localhost:3000',
    SUPABASE_URL:      process.env.NEXT_PUBLIC_SUPABASE_URL       || '',
    SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY  || '',
  } as ReturnType<typeof buildClientEnv>;
}

if (typeof window === 'undefined') {
  serverEnv = buildServerEnv();
} else {
  serverEnv = new Proxy({} as ReturnType<typeof buildServerEnv>, {
    get(_t, prop) {
      throw new Error(`[env] serverEnv.${String(prop)} accessed in browser code.`);
    },
  });
}

export { clientEnv, serverEnv };
