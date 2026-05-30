/**
 * @file lib/api/core/api-error-types.ts
 *
 * Shared primitive types required by both api-error.ts and api-types.ts.
 *
 * WHY THIS FILE EXISTS:
 *   api-error.ts needed ErrorCategory and ApiSuccess from api-types.ts.
 *   api-types.ts needed ApiClientError from api-error.ts (for ApiFailure).
 *   That produced a type-only circular dependency detected by madge.
 *
 *   Resolution: extract the two types api-error.ts depends on into this
 *   neutral file. api-error.ts imports from here; api-types.ts imports
 *   from here. Neither file imports the other. Cycle eliminated.
 *
 * CONSUMERS:
 *   - lib/api/core/api-error.ts  (ErrorCategory, ApiSuccess)
 *   - lib/api/core/api-types.ts  (ErrorCategory, ApiSuccess — re-exported for
 *     backward compatibility so all existing @/lib/api/core imports are unchanged)
 *
 * DO NOT add runtime code here. This file is types only.
 */

// ─────────────────────────────────────────────────────────────────────────────
// ERROR CATEGORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stable UI-facing error category discriminant.
 *
 * Maps backend error codes and HTTP status ranges to nine stable buckets.
 * UI components switch on this value — never on raw status codes or error codes.
 *
 * | Category     | Trigger                                      | UI action               |
 * |--------------|----------------------------------------------|-------------------------|
 * | auth         | 401 / token expired                          | Redirect to /login      |
 * | validation   | 400 / 422 — bad input                        | Show field errors       |
 * | not_found    | 404 — resource missing                       | Show 404 state          |
 * | conflict     | 409 — duplicate / optimistic lock failure    | Show conflict message   |
 * | rate_limit   | 429 — too many requests                      | Back off + retry        |
 * | tier_gate    | 402 / plan 403 — feature locked              | Show upgrade modal      |
 * | server       | 5xx — backend fault                          | Generic toast + retry   |
 * | network      | No response / timeout / DNS failure          | Check connection toast  |
 * | cancelled    | Intentional RQ / AbortController cancel      | Silent (not an error)   |
 * | system       | Parser / contract / internal failure         | Generic toast + log     |
 *
 * @contract These nine values are STABLE. UI switch statements must handle all of them.
 */
export type ErrorCategory =
  | 'auth'
  | 'validation'
  | 'not_found'
  | 'conflict'
  | 'rate_limit'
  | 'tier_gate'
  | 'server'
  | 'network'
  | 'cancelled'
  | 'system';

// ─────────────────────────────────────────────────────────────────────────────
// API SUCCESS ENVELOPE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Client-safe success envelope.
 * `meta` is flattened at the parse boundary — no raw backend shape leaks through.
 */
export type ApiSuccess<T> = {
  readonly success: true;
  readonly data: T;
  readonly requestId?: string;
};