/**
 * @file src/lib/observability/apiInstrumentation.ts
 * @description Observability helpers for the API layer.
 *
 * Provides three functions that bookend API calls with structured events:
 *
 *   emitApiRequest(endpoint, traceId?, context?)  → call before fetch
 *   emitApiSuccess(endpoint, traceId?, context?)  → call on success
 *   emitApiError(endpoint, error, traceId?, context?) → call on failure
 *
 * DESIGN RULES:
 *  - These are PURE SIDE-EFFECT helpers — they never modify the call they wrap.
 *  - They never throw — any internal failure is silently swallowed.
 *  - They are NOT interceptors. They are called explicitly at instrumentation
 *    points (see STEP 6 in the implementation guide).
 *  - `traceId` is optional everywhere — events are useful even without
 *    correlation (e.g., background polling queries with no user action origin).
 *
 * READING traceId FROM REACT QUERY META:
 *  React Query v5 allows arbitrary metadata on queries/mutations via `meta`.
 *  The convention in this codebase is:
 *    useMutation({ ..., meta: { traceId } })
 *    useQuery(   { ..., meta: { traceId } })
 *
 *  At the API layer, extract it like:
 *    const traceId = (options?.meta as { traceId?: string })?.traceId;
 *
 *  This file ships a `extractTraceId()` helper for that exact pattern.
 *
 * ARCHITECTURE POSITION: API layer observability surface
 *   API clients → [these helpers] → logger → buffer
 */

import { createEvent } from './observability';
import { logEvent } from './logger';
import { getActiveTraceId } from './context';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts `traceId` from a React Query `meta` object, with a fallback to
 * the module-level active trace set by the most recent trackUserAction() call.
 *
 * Resolution order:
 *  1. meta.traceId  — explicit, highest priority
 *  2. getActiveTraceId() — fallback for implicit API calls that fire after
 *     a user action without explicitly threading the traceId
 *
 * Returns `undefined` if neither source has a value.
 */
export function extractTraceId(meta?: Record<string, unknown>): string | undefined {
  const fromMeta = meta?.traceId;
  if (typeof fromMeta === 'string') return fromMeta;
  return getActiveTraceId() ?? undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// DURATION TRACKING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-endpoint start times for duration measurement.
 * Key: endpoint string. Value: performance.now() at request start.
 * Entries are deleted after success/error to prevent unbounded growth.
 */
const _requestStartTimes = new Map<string, number>();

// ─────────────────────────────────────────────────────────────────────────────
// EVENT EMITTERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Emits an `api:API_REQUEST` event.
 * Call this immediately before an API request is dispatched.
 *
 * @param endpoint - The URL path or logical endpoint name (e.g. "/api/v1/career-health").
 * @param traceId  - Optional trace correlation ID from the initiating user action.
 * @param context  - Optional additional context (method, params, etc.).
 */
export function emitApiRequest(
  endpoint: string,
  traceId?: string,
  context?: Record<string, unknown>,
): void {
  try {
    // Record start time for duration calculation on success/error.
    _requestStartTimes.set(endpoint, performance.now());
    // Memory safety: remove entry after 60s regardless of outcome.
    // Guards against requests that are abandoned (navigated away, tab hidden)
    // and never trigger emitApiSuccess or emitApiError.
    setTimeout(() => { _requestStartTimes.delete(endpoint); }, 60_000);
    logEvent(createEvent({
      type:    'api',
      name:    'API_REQUEST',
      level:   'info',
      traceId,
      context: { endpoint, ...context },
    }));
  } catch { /* never surface */ }
}

/**
 * Emits an `api:API_SUCCESS` event.
 * Call this when an API request resolves successfully.
 *
 * @param endpoint   - The URL path or logical endpoint name.
 * @param traceId    - Optional trace correlation ID.
 * @param context    - Optional additional context (status, requestId, etc.).
 */
export function emitApiSuccess(
  endpoint: string,
  traceId?: string,
  context?: Record<string, unknown>,
): void {
  try {
    const startTime = _requestStartTimes.get(endpoint);
    const duration  = startTime !== undefined ? Math.round(performance.now() - startTime) : undefined;
    _requestStartTimes.delete(endpoint);
    logEvent(createEvent({
      type:    'api',
      name:    'API_SUCCESS',
      level:   'info',
      traceId,
      context: {
        endpoint,
        ...(duration !== undefined && { duration }),
        ...context,
      },
    }));
  } catch { /* never surface */ }
}

/**
 * Emits an `api:API_ERROR` event.
 * Call this when an API request fails (network error, 4xx, 5xx, timeout).
 *
 * @param endpoint   - The URL path or logical endpoint name.
 * @param error      - The caught error. Serialised to a safe shape internally.
 * @param traceId    - Optional trace correlation ID.
 * @param context    - Optional additional context.
 */
export function emitApiError(
  endpoint: string,
  error: unknown,
  traceId?: string,
  context?: Record<string, unknown>,
): void {
  try {
    const startTime    = _requestStartTimes.get(endpoint);
    const duration     = startTime !== undefined ? Math.round(performance.now() - startTime) : undefined;
    _requestStartTimes.delete(endpoint);
    const errorContext = serializeError(error);
    logEvent(createEvent({
      type:    'api',
      name:    'API_ERROR',
      level:   'error',
      traceId,
      context: {
        endpoint,
        ...(duration !== undefined && { duration }),
        ...errorContext,
        ...context,
      },
    }));
  } catch { /* never surface */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serialises an unknown caught value into a plain, JSON-safe context object.
 * Does not include stack traces (too verbose for the event buffer).
 */
function serializeError(error: unknown): Record<string, unknown> {
  if (error === null || error === undefined) {
    return { errorType: 'null' };
  }
  if (error instanceof Error) {
    // Check for ApiClientError-specific fields without importing ApiClientError
    // (to avoid coupling this observability module to the API layer).
    const asRecord = error as unknown as Record<string, unknown>;
    return {
      errorType:    error.name ?? 'Error',
      errorMessage: error.message,
      ...(typeof asRecord.category === 'string' && { category: asRecord.category }),
      ...(typeof asRecord.status   === 'number' && { status:   asRecord.status   }),
    };
  }
  if (typeof error === 'string') {
    return { errorType: 'string', errorMessage: error };
  }
  return { errorType: typeof error };
}
