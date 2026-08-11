/**
 * src/lib/env.ts
 *
 * Environment variable validation — called once at app startup
 * (src/main.tsx, before the app is mounted — see FIX-08).
 *
 * FIX-07 (MEDIUM): Previously this file used `process.env.NEXT_PUBLIC_*`,
 * a Next.js convention that does not exist in a Vite browser bundle —
 * `process.env.NEXT_PUBLIC_SUPABASE_URL` is always `undefined` under Vite.
 * The function was never called anywhere in the codebase, so this was
 * dormant — but if anyone had wired `validateEnv()` into bootstrap as a
 * "fix" without updating the variable names, the app would have thrown on
 * every single startup, since the required vars could never be found.
 *
 * NOW:
 *  - Reads exclusively from `import.meta.env.VITE_*` (Vite-only — no
 *    NEXT_PUBLIC_* fallback, matching the architecture rule that all env
 *    access must use `import.meta.env.VITE_*`).
 *  - Validates the same variables that src/lib/supabase/client.ts requires
 *    (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY), so a misconfiguration is
 *    caught at bootstrap with a single, actionable console error rather
 *    than surfacing later as a confusing Supabase auth failure.
 *  - Throws a single Error listing every missing variable, with guidance
 *    about the historical UTF-8 BOM issue that previously caused
 *    VITE_SUPABASE_URL to appear "missing" even when present in
 *    .env.local.
 *
 * Usage (src/main.tsx):
 *
 *   import { validateEnv } from './lib/env';
 *   try {
 *     validateEnv();
 *   } catch (err) {
 *     console.error(err instanceof Error ? err.message : err);
 *   }
 */

const REQUIRED_ENV_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
] as const;

type RequiredEnvVar = (typeof REQUIRED_ENV_VARS)[number];

/**
 * Validates that all required Vite environment variables are present and
 * non-empty.
 *
 * Throws a descriptive Error listing every missing variable at once,
 * rather than failing on the first one.
 *
 * Safe to call from browser code only — `import.meta.env` is a Vite
 * browser/SSR-client construct, not available under plain Node without
 * Vite's runtime.
 */
export function validateEnv(): void {
  const env = import.meta.env as Record<string, string | undefined>;

  const missing: RequiredEnvVar[] = REQUIRED_ENV_VARS.filter(
    (key) => !env[key],
  );

  if (missing.length > 0) {
    throw new Error(
      `[env] Missing required environment variable(s):\n` +
        missing.map((key) => `  • ${key}`).join('\n') +
        `\n\n` +
        `Check front/.env.local and ensure these are set, then restart ` +
        `"npm run dev".\n\n` +
        `If VITE_SUPABASE_URL is set in .env.local but still reported as ` +
        `missing, check the file for a leading UTF-8 byte-order-mark (BOM) ` +
        `on the first line — it corrupts the first variable name so Vite ` +
        `never sees it. Re-save the file as UTF-8 without BOM.`,
    );
  }
}

/**
 * Type-safe accessor for a validated Vite env var.
 * Use after validateEnv() has confirmed the value is present.
 */
export function getEnv(key: RequiredEnvVar): string {
  const env = import.meta.env as Record<string, string | undefined>;
  const value = env[key];
  if (!value) {
    throw new Error(`[env] ${key} is not set. Did you call validateEnv()?`);
  }
  return value;
}