/**
 * src/hooks/utils/rpcExecutor.ts
 *
 * RPC EXECUTOR UTILITY — HARDENED (Phase 3 Verification Pass)
 * ─────────────────────────────────────────────────────────────
 * The single place where a Supabase RPC call is wrapped into a typed
 * RpcResult<T>. Provides:
 *  - Correlation ID injection
 *  - Latency measurement
 *  - Error normalisation (PostgrestError → RpcError)
 *  - Telemetry emission (start / success / error)
 *  - Envelope validation (success: false check)
 *  - AbortSignal support via Promise.race timeout wrapper (EX-01)
 *  - Correct httpStatus extraction from error.status not error.code (EX-02)
 *
 * CHANGES FROM ORIGINAL:
 *  EX-01: executeRpc now accepts an optional `signal?: AbortSignal` parameter.
 *         When provided, the RPC call races against an abort promise. React
 *         Query passes `signal` through the queryFn context — forward it here.
 *  EX-02: httpStatus is now sourced from `(error as PostgrestError).status`
 *         (the numeric HTTP status field) rather than `error.code` (which is a
 *         PGRST string code like "PGRST116" that parseInt would mangle to NaN).
 *
 * GOVERNANCE:
 *  ✅ Only the API repository files import this.
 *  ❌ Hooks never import this directly.
 *  ❌ Components never import this.
 */

import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
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
// ABORT HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a promise that rejects with an AbortError when the given signal fires.
 * Used to race against the Supabase RPC promise so cancellation is honoured
 * even though Supabase JS v2 does not natively accept AbortSignal on `.rpc()`.
 */
function abortRejector(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) {
      reject(new DOMException('RPC aborted', 'AbortError'));
      return;
    }
    signal.addEventListener(
      'abort',
      () => reject(new DOMException('RPC aborted', 'AbortError')),
      { once: true },
    );
  });
}

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
 * @param signal       Optional AbortSignal from React Query's queryFn context.
 *                     When provided, the call races against the signal — if the
 *                     signal fires first, executeRpc returns a non-retryable error.
 */
export async function executeRpc<T>(
  client: SupabaseClient,
  rpcName: string,
  params?: Record<string, unknown>,
  validator?: (raw: unknown) => T,
  signal?: AbortSignal,
): Promise<RpcResult<T>> {
  const correlationId = generateCorrelationId();
  const startedAt    = Date.now();

  academicTelemetry.rpcStart(rpcName, correlationId, params);

  try {
    // ── Build the RPC promise
    const rpcPromise = client.rpc(rpcName, params ?? {});

    // ── Race against abort signal when provided (EX-01)
    const { data, error } = signal
      ? await Promise.race([rpcPromise, abortRejector(signal)])
      : await rpcPromise;

    const latencyMs = Date.now() - startedAt;

    // ── Supabase client-level error (network, auth, PGRST)
    if (error) {
      // EX-02: Use `error.status` (numeric HTTP status) not `error.code`
      // (PGRST string code). `error.code` is "PGRST116" / "42501" etc.;
      // parseInt("PGRST116") === NaN which breaks the HTTP status classifier.
      const pgrestError = error as PostgrestError & { status?: number };
      const classification = classifyRpcError({
        message:    error.message,
        code:       error.code,
        httpStatus: pgrestError.status,        // ← corrected from error.code
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

    // ── AbortError — non-retryable, not an auth error, not a real failure
    if (caught instanceof DOMException && caught.name === 'AbortError') {
      const rpcError: RpcError = {
        message:     'RPC cancelled',
        isRetryable: false,
        isAuthError: false,
        cause:       caught,
      };
      // No telemetry for intentional cancellations — they are not errors.
      return { ok: false, error: rpcError, correlationId, latencyMs };
    }

    const message = caught instanceof Error ? caught.message : 'Unknown RPC error';

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
 *
 * NOTE: AbortError propagated from executeRpc will also throw here.
 * React Query detects AbortError and treats it as a cancelled query (no retry,
 * no error state update) — this is the correct behaviour.
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
 * Returns false for auth errors, non-retryable business errors, and abort errors.
 * Returns true (up to MAX_RETRIES) for transient failures.
 */
export function academicRpcRetryPredicate(
  failureCount: number,
  error: unknown,
): boolean {
  const MAX_RETRIES = 3;
  if (failureCount >= MAX_RETRIES) return false;

  // Never retry an intentional cancellation
  if (error instanceof DOMException && error.name === 'AbortError') return false;

  if (error instanceof Error) {
    const typed = error as Error & { rpcError?: RpcError };
    if (typed.rpcError) {
      return typed.rpcError.isRetryable;
    }
  }
  // Unknown error shape — allow retry
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// RETRY TELEMETRY HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Produces an onError callback wrapper that emits retry telemetry.
 *
 * Usage in a query's onError option:
 *   onError: buildRetryTelemetryCallback('fn_get_countries', correlationId)
 *
 * NOTE: React Query does not expose which attempt number fired the onError
 * callback in the options-level API. The failureCount from the predicate is
 * not available here. Phase 4 UI can wire this by reading `result.failureCount`
 * from the `useQuery` return value and emitting the event in a useEffect.
 *
 * TL-01: This helper documents the gap and provides the emit call for when
 * the wiring is available. The `rpcRetry` event type is correct and ready.
 */
export function emitRetryTelemetry(
  rpcName: string,
  correlationId: CorrelationId,
  attemptNumber: number,
): void {
  academicTelemetry.rpcRetry(rpcName, correlationId, attemptNumber);
}
