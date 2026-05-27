/**
 * src/hooks/types/rpcEnvelope.types.ts
 *
 * TYPED RPC ENVELOPE SYSTEM — HireRise Academic Intelligence Platform
 * ────────────────────────────────────────────────────────────────────
 * All Supabase RPC calls return JSONB envelopes. This module provides:
 *  - The canonical envelope shape for success and error responses
 *  - A runtime validator that normalises Supabase's error/data split
 *    into a single typed result before it reaches the hooks layer
 *  - Correlation-ID infrastructure for telemetry
 *
 * GOVERNANCE:
 *  ❌ No business logic here.
 *  ❌ No direct Supabase imports here.
 *  ✅ Only shapes + runtime guards + normalisation helpers.
 */

// ─────────────────────────────────────────────────────────────────────────────
// CORRELATION + TELEMETRY CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

/** Opaque correlation ID — v4 UUID string at runtime. */
export type CorrelationId = string & { readonly __brand: 'CorrelationId' };

export interface RpcCallContext {
  /** Unique ID for this invocation — attached to every telemetry event. */
  correlationId: CorrelationId;
  /** Unix ms timestamp when the call was initiated. */
  startedAt: number;
  /** Which RPC function was called. */
  rpcName: string;
  /** Sanitised params (no PII) — safe to log. */
  sanitisedParams?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL RPC ENVELOPE — raw from Supabase JSONB
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every HireRise RPC returns a JSONB object with at minimum a `success` boolean.
 * On success the data fields are present at the top level of the envelope.
 * On failure `success: false` and `error: string` (+ optional `code`).
 */
export interface RpcEnvelopeBase {
  success: boolean;
  error?: string;
  code?: string;
}

/** A successfully resolved RPC envelope — `success` is narrowed to `true`. */
export type RpcSuccessEnvelope<T extends object> = RpcEnvelopeBase & { success: true } & T;

/** A failed RPC envelope — `success` narrowed to `false`, `error` is required. */
export interface RpcErrorEnvelope extends RpcEnvelopeBase {
  success: false;
  error: string;
  code?: string;
}

/** Union of success and failure envelopes — discriminated on `success`. */
export type RpcEnvelope<T extends object> = RpcSuccessEnvelope<T> | RpcErrorEnvelope;

// ─────────────────────────────────────────────────────────────────────────────
// PARSED RESULT — what the API layer returns to hooks
// ─────────────────────────────────────────────────────────────────────────────

/** Discriminated union returned by every API repository function. */
export type RpcResult<T> =
  | { ok: true; data: T; correlationId: CorrelationId; latencyMs: number }
  | { ok: false; error: RpcError; correlationId: CorrelationId; latencyMs: number };

/** Normalised error type — replaces raw Supabase PostgrestError. */
export interface RpcError {
  message: string;
  code?: string;
  /** Original Supabase error code e.g. PGRST116, 42501. */
  pgCode?: string;
  /** Whether this error is retryable. */
  isRetryable: boolean;
  /** Whether this is an auth failure (401/403). */
  isAuthError: boolean;
  /** Raw cause — never surfaced to UI. */
  cause?: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// RUNTIME TYPE GUARDS
// ─────────────────────────────────────────────────────────────────────────────

export function isRpcSuccessEnvelope<T extends object>(
  value: unknown,
): value is RpcSuccessEnvelope<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    (value as RpcEnvelopeBase).success === true
  );
}

export function isRpcErrorEnvelope(value: unknown): value is RpcErrorEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    (value as RpcEnvelopeBase).success === false
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CORRELATION ID GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a v4-style correlation ID.
 * Uses crypto.randomUUID when available (modern browsers / Node ≥ 19),
 * falls back to Math.random for older environments.
 */
export function generateCorrelationId(): CorrelationId {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID() as CorrelationId;
  }
  // Fallback — not cryptographically random but sufficient for log correlation
  return (
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    }) as CorrelationId
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RETRYABILITY CLASSIFIER
// ─────────────────────────────────────────────────────────────────────────────

const NON_RETRYABLE_PG_CODES = new Set([
  '42501', // insufficient_privilege
  '23505', // unique_violation
  '23503', // foreign_key_violation
  'invalid_parameter_value',
  'VALIDATION_ERROR',
]);

const NON_RETRYABLE_HTTP_STATUS = new Set([400, 401, 403, 404, 422]);

export function classifyRpcError(opts: {
  message: string;
  code?: string;
  httpStatus?: number;
}): Pick<RpcError, 'isRetryable' | 'isAuthError'> {
  const isAuthError = opts.httpStatus === 401 || opts.httpStatus === 403;
  const isNonRetryableCode =
    (opts.code !== undefined && NON_RETRYABLE_PG_CODES.has(opts.code)) ||
    (opts.httpStatus !== undefined && NON_RETRYABLE_HTTP_STATUS.has(opts.httpStatus));

  return {
    isRetryable: !isAuthError && !isNonRetryableCode,
    isAuthError,
  };
}
