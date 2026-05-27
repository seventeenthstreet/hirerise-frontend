/**
 * @file src/lib/api/client.ts
 * @description Centralized API client wrapper for React Query compatibility.
 *
 * This is the ONLY file that endpoint modules should call.
 * It wraps `apiRequest` (from core) and enforces three guarantees:
 *
 *  ✅  Always returns typed data `T` on success — never a response envelope.
 *  ✅  Always throws `ApiClientError` on failure — nothing else escapes.
 *  ✅  No parsing logic lives here — all parsing is delegated to `core`.
 *
 * ARCHITECTURE POSITION:
 *   core (apiRequest) → client (apiClient) → endpoints → hooks → UI
 *
 * WHY THIS EXISTS (vs. calling apiRequest directly in endpoints):
 *  - Provides a single, stable function signature for all endpoint modules.
 *  - Makes the React Query `queryFn` contract explicit: `() => apiClient(...)`.
 *  - Isolates the config shape from Axios internals — endpoints never import Axios.
 *  - Future cross-cutting concerns (auth headers, telemetry, feature flags) have
 *    one insertion point instead of being scattered across every endpoint file.
 *
 * RULES:
 *  - DO NOT add try/catch here — let ApiClientError propagate to React Query.
 *  - DO NOT duplicate parsing logic from core/api-parser.ts.
 *  - DO NOT import axios or fetch directly.
 *  - DO NOT return { success, data } envelopes — return T or throw.
 */

import { apiRequest } from '@/lib/api/core';
import type { ApiRequestConfig } from '@/lib/api/core';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG TYPE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Config accepted by `apiClient`.
 *
 * A purposefully narrow subset of `ApiRequestConfig` — endpoints should not
 * need to set headers, signals, or retry flags directly. If those are needed,
 * use `apiRequest` from core instead.
 *
 * `params` values are typed as `unknown` to stay compatible with
 * `ApiRequestConfig` while allowing any serializable filter shape.
 */
export type ApiClientConfig = {
  /** Relative URL path. Example: "/analytics/overview" */
  url: string;
  /** HTTP verb. Defaults to "GET". */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Request body for POST / PUT. */
  data?: unknown;
  /** Query-string params appended to the URL. */
  params?: Record<string, unknown>;
  /**
   * Optional request headers. Use sparingly — prefer the axios interceptor for
   * cross-cutting concerns. Pass Authorization here only when you have a known
   * token and need to bypass getSession() (e.g. right after login before
   * the session is persisted to localStorage).
   */
  headers?: Record<string, string>;
  /**
   * Optional AbortSignal for request cancellation.
   * Used by useAppHydration to cancel in-flight /users/me requests on
   * SIGNED_OUT or component unmount. Forwarded directly to the Axios layer.
   */
  signal?: AbortSignal;
};

// ─────────────────────────────────────────────────────────────────────────────
// CORE WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Centralized API client wrapper for all endpoint modules.
 *
 * Calls `apiRequest` from the core layer, which:
 *  1. Sends the request via the shared Axios instance.
 *  2. Parses the response through `parseApiResponse` (success + error shapes).
 *  3. Returns `T` on success or throws `ApiClientError` on any failure.
 *
 * `apiClient` adds nothing on top of this pipeline — it is a stable,
 * thin interface that decouples endpoint modules from Axios internals
 * and provides a consistent function signature for React Query `queryFn` usage.
 *
 * @example
 * // Direct usage (returns T or throws ApiClientError)
 * const data = await apiClient<OverviewMetrics>({ url: '/analytics/overview' });
 *
 * @example
 * // As a React Query queryFn (error propagates to React Query error state)
 * useQuery({
 *   queryKey: QUERY_KEYS.metrics.overview(),
 *   queryFn:  () => apiClient<OverviewMetrics>({ url: '/analytics/overview' }),
 * });
 *
 * @throws {ApiClientError} Always — on network failures, HTTP errors, and
 *   backend error bodies. React Query will catch this and populate `error`.
 */
export async function apiClient<T>(config: ApiClientConfig): Promise<T> {
  // Delegate entirely to apiRequest — it owns the full request/parse/throw pipeline.
  // No try/catch: ApiClientError must propagate upward to React Query or the caller.
  const requestConfig: ApiRequestConfig = {
    url:     config.url,
    method:  config.method ?? 'GET',
    data:    config.data,
    params:  config.params,
    headers: config.headers,
    signal:  config.signal,
  };

  return apiRequest<T>(requestConfig);
}