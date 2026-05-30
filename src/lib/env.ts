/**
 * src/lib/env.ts
 *
 * Environment variable validation — called once at app startup.
 *
 * Fails fast with a clear error message if any required variable is
 * missing, preventing cryptic runtime failures deep in the call stack.
 *
 * Call in the root layout (server side) or in a top-level initializer:
 *
 *   import { validateEnv } from '@/lib/env';
 *   validateEnv();
 *
 * This file intentionally has zero dependencies so it can be imported
 * anywhere without pulling in the Supabase client or other heavy modules.
 */

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  // NEXT_PUBLIC_API_BASE_URL removed from required list.
  // Browser requests now use relative paths (Next.js proxy) — the env var
  // is only needed by server-side Route Handlers (API_BASE_URL in .env).
  // Keeping it optional here prevents startup failures in environments
  // where only API_BASE_URL is set (e.g. production server containers).
] as const;

type RequiredEnvVar = (typeof REQUIRED_ENV_VARS)[number];

/**
 * Validates that all required environment variables are present.
 * Throws a descriptive Error listing every missing variable at once,
 * rather than failing on the first one.
 *
 * Safe to call in both server and client contexts — all required vars
 * are NEXT_PUBLIC_ and available on both sides.
 */
export function validateEnv(): void {
  const missing: RequiredEnvVar[] = REQUIRED_ENV_VARS.filter(
    (key) => !process.env[key],
  );

  if (missing.length > 0) {
    throw new Error(
      `[env] Missing required environment variable(s):\n` +
        missing.map((key) => `  • ${key}`).join('\n') +
        `\n\nCheck your .env.local file and ensure these are set before starting.`,
    );
  }
}

/**
 * Type-safe accessor for a validated env var.
 * Use after validateEnv() has confirmed the value is present.
 */
export function getEnv(key: RequiredEnvVar): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`[env] ${key} is not set. Did you call validateEnv()?`);
  }
  return value;
}