/**
 * src/hooks/utils/rpcExecutor.ts
 *
 * RPC EXECUTOR UTILITY
 * ─────────────────────
 * The single place where a Supabase RPC call is wrapped into a typed
 * RpcResult<T>. Provides:
 *  - Correlation ID injection
 *  - Latency measurement
 *  - Error normalisation (PostgrestError → RpcError)
 *  - Telemetry emission (start / success / error)
 *  - Envelope validation (success: false check)
 *
 * GOVERNANCE:
 *  ✅ Only the API repository files import this.
 *  ❌ Hooks never import this directly.
 *  ❌ Components never import this.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  generateCorrelationId,
  classifyRpcError,
  isRpcErrorEnvelope,
  type RpcResult,
  type RpcError,
  type CorrelationId,
} from '../types/rpcEnvelope.types';
import { academicTelemetry } from '../../telemetry/academicTelemetry';

// ─────────────────────────────────────────────────────────────────────────────
// CORE EXECUTOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Executes a Supabase RPC and returns a typed RpcResult<T>.
 *
 * @param client       Supabase browser client singleton
 * @param rpcName      The Postgres function name (e.g. 'fn_get_countries')
 * @param params       RPC parameters — must match the Postgres function signature
 * @param validator    Optional runtime validator for the data payload
 */
export async function executeRpc<T>(
  client: SupabaseClient,
  rpcName: string,
  params?: Record<string, unknown>,
  validator?: (raw: unknown) => T,
): Promise<RpcResult<T>> {
  const correlationId = generateCorrelationId();
  const startedAt    = Date.now();

  academicTelemetry.rpcStart(rpcName, correlationId, params);

  try {
    const { data, error } = await client.rpc(rpcName, params ?? {});
    const latencyMs = Date.now() - startedAt;

    // ── Supabase client-level error (network, auth, PGRST)
    if (error) {
      const classification = classifyRpcError({
        message:    error.message,
        code:       error.code,
        httpStatus: error.code ? parseInt(error.code, 10) : undefined,
      });

      const rpcError: RpcError = {
        message:     error.message,
        code:        error.code,
        pgCode:      error.code,
        isRetryable: classification.isRetryable,
        isAuthError: classification.isAuthError,
        cause:       error,
      };

      academicTelemetry.rpcError(rpcName, correlationId, latencyMs, {
        errorCode:   error.code,
        isRetryable: classification.isRetryable,
      });

      return { ok: false, error: rpcError, correlationId, latencyMs };
    }

    // ── RPC returned `success: false` envelope
    if (isRpcErrorEnvelope(data)) {
      const classification = classifyRpcError({
        message: data.error,
        code:    data.code,
      });

      const rpcError: RpcError = {
        message:     data.error,
        code:        data.code,
        isRetryable: classification.isRetryable,
        isAuthError: classification.isAuthError,
      };

      academicTelemetry.rpcError(rpcName, correlationId, latencyMs, {
        errorCode:   data.code,
        isRetryable: classification.isRetryable,
      });

      return { ok: false, error: rpcError, correlationId, latencyMs };
    }

    // ── Success path
    const payload: T = validator ? validator(data) : (data as T);

    academicTelemetry.rpcSuccess(rpcName, correlationId, latencyMs);

    return { ok: true, data: payload, correlationId, latencyMs };

  } catch (caught: unknown) {
    const latencyMs = Date.now() - startedAt;
    const message   = caught instanceof Error ? caught.message : 'Unknown RPC error';

    const rpcError: RpcError = {
      message,
      isRetryable: true,  // unknown failures are presumed retryable
      isAuthError: false,
      cause: caught,
    };

    academicTelemetry.rpcError(rpcName, correlationId, latencyMs, {
      isRetryable: true,
    });

    return { ok: false, error: rpcError, correlationId, latencyMs };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// THROW HELPER — used by API repos to convert RpcResult to throw-on-error
// React Query's queryFn must throw on failure; this bridges the two worlds.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Unwraps an RpcResult<T>, throwing an Error if `ok === false`.
 * React Query's queryFn must throw — this bridges RpcResult to that contract.
 */
export function unwrapOrThrow<T>(result: RpcResult<T>): T {
  if (!result.ok) {
    const err = new Error(result.error.message);
    // Attach metadata so retry predicates can inspect without re-parsing
    (err as Error & { rpcError: RpcError; correlationId: CorrelationId }).rpcError =
      result.error;
    (err as Error & { correlationId: CorrelationId }).correlationId = result.correlationId;
    throw err;
  }
  return result.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// RETRY PREDICATE — used by React Query `retry` option
// ─────────────────────────────────────────────────────────────────────────────

/**
 * React Query retry predicate.
 * Returns false for auth errors and non-retryable business errors.
 * Returns true (up to maxAttempts) for transient failures.
 */
export function academicRpcRetryPredicate(
  failureCount: number,
  error: unknown,
): boolean {
  const MAX_RETRIES = 3;
  if (failureCount >= MAX_RETRIES) return false;

  if (error instanceof Error) {
    const typed = error as Error & { rpcError?: RpcError };
    if (typed.rpcError) {
      return typed.rpcError.isRetryable;
    }
  }
  // Unknown error shape — allow retry
  return true;
}
