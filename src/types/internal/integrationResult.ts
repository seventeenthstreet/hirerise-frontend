/**
 * @file types/internal/integrationResult.ts
 * @description Soft error channel for integration clients.
 *
 * RULES (NON-NEGOTIABLE):
 *  - Integration clients NEVER throw — they return IntegrationResult<T>
 *  - data is null when the fetch fails; error describes why
 *  - data is non-null on success; error is absent
 *  - This type is consumed ONLY by metricsAdapter — never by hooks or UI
 *
 * WHY SOFT ERRORS:
 *  Hard throws from integration clients would propagate up through the mapper
 *  and adapter, potentially crashing the hook even when a fallback exists.
 *  IntegrationResult forces the adapter to handle errors explicitly, making
 *  partial failure (one source down, other up) a first-class case.
 */

// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION RESULT
// ─────────────────────────────────────────────────────────────────────────────

export type IntegrationSource = 'posthog' | 'backend';

export interface IntegrationError {
  source:  IntegrationSource;
  message: string;
  /** Optional machine-readable error code (e.g. 'TIMEOUT', 'AUTH_FAILED') */
  code?:   string;
}

/**
 * Result wrapper returned by all integration clients.
 *
 * Success:  { data: T,    error: undefined }
 * Failure:  { data: null, error: IntegrationError }
 *
 * @template T - The raw payload type (PostHogRawPayload | BackendRawPayload)
 */
export type IntegrationResult<T> =
  | { data: T;    error?: never }
  | { data: null; error: IntegrationError };

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Construct a successful IntegrationResult */
export function integrationOk<T>(data: T): IntegrationResult<T> {
  return { data };
}

/** Construct a failed IntegrationResult without throwing */
export function integrationErr<T>(
  source:  IntegrationSource,
  message: string,
  code?:   string,
): IntegrationResult<T> {
  return { data: null, error: { source, message, code } };
}