/**
 * @file lib/api/core/api-types.ts
 * @description All type definitions for the Hirerise API layer.
 *
 * Three tiers of types live here:
 *  1. RAW (wire) types   — backend shape only. Never used in UI.
 *  2. CLIENT-SAFE types  — what feature hooks and UI receive.
 *  3. DOMAIN types       — backend-agnostic value objects (JobStatus, etc.)
 *
 * CONTRACT VERSION: 3.0.0
 */

// ─────────────────────────────────────────────────────────────────────────────
// RAW META BLOCKS
// ─────────────────────────────────────────────────────────────────────────────

export type RawResponseMeta = {
  requestId?: string;
  timestamp?: string;
  [key: string]: unknown;
};

export type RawRateLimitMeta = RawResponseMeta & {
  retryAfter?: number;
  retryAfterSeconds?: number;
};

export type RawPaginatedMeta = RawResponseMeta & {
  total?: number;
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// RAW SUCCESS RESPONSES
// ─────────────────────────────────────────────────────────────────────────────

export type RawApiSuccess<T = unknown> = {
  success: true;
  data: T;
  error?: null;
  meta?: RawResponseMeta;
};

export type RawApiPaginatedSuccess<T = unknown> = {
  success: true;
  data: T[];
  error?: null;
  meta: RawPaginatedMeta;
};

// ─────────────────────────────────────────────────────────────────────────────
// RAW ERROR RESPONSES (all three backend shapes in production)
// ─────────────────────────────────────────────────────────────────────────────

/** Current v2 shape: { success: false, error: { code, message, details }, meta } */
export type RawApiErrorV2 = {
  success: false;
  error: {
    code?: string;
    message?: string;
    details?: unknown;
  };
  message?: string;
  meta?: RawRateLimitMeta;
};

/** Legacy v1 shape: { error: 'CODE_STRING', message, requestId } */
export type RawApiErrorLegacy = {
  error: string;
  message?: string;
  requestId?: string;
  timestamp?: string;
};

/**
 * Transitional shape: { code, message, requestId }
 *
 * @deprecated TRANSITIONAL — Phase 1 Migration (Contract Stabilization)
 *
 * This type captures two legacy backend patterns:
 *  1. `{ code, message }` — older route-level inline error format
 *  2. `{ errorCode, message }` — formerly emitted by auth.middleware.js
 *
 * MIGRATION STATUS:
 *  ✅ auth.middleware.js: migrated to V2 canonical shape in Phase 1
 *  ⚠️  Some route controllers may still emit `{ code, message }` inline
 *
 * TODO(phase3-cleanup): Remove this type once all backend routes are
 *   confirmed to emit the V2 shape exclusively.
 */
export type RawApiErrorTransitional = {
  code?: string;
  errorCode?: string;  // HireRise backend auth/error middleware — MIGRATED in Phase 1; kept as safety net
  message?: string;
  requestId?: string;
  timestamp?: string;
};

export type RawApiError = RawApiErrorV2 | RawApiErrorLegacy | RawApiErrorTransitional;

export type RawApiResponse<T = unknown> = RawApiSuccess<T> | RawApiError;

// ─────────────────────────────────────────────────────────────────────────────
// ERROR CATEGORY  (UI-facing — branch on this, never on raw code)
// ─────────────────────────────────────────────────────────────────────────────

// ErrorCategory is now owned by api-error-types.ts to break the circular
// dependency between api-error.ts and api-types.ts.
// Re-exported here so all existing imports from api-types remain unchanged.
export type { ErrorCategory } from './api-error-types';

// ─────────────────────────────────────────────────────────────────────────────
// PAGINATION META  (client-safe, extensible)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalised pagination shape. All fields optional — partial backends never crash.
 * Backend `pageSize` is remapped to `limit` at the parse boundary.
 * Index signature allows backend to add new pagination fields without contract change.
 */
export type PaginationMeta = {
  total?: number;
  page?: number;
  limit?: number;
  hasMore?: boolean;
  [key: string]: unknown;
};

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT-SAFE RESPONSE TYPES
// ─────────────────────────────────────────────────────────────────────────────

// ApiSuccess is now owned by api-error-types.ts (same reason as ErrorCategory).
// `import type` brings it into scope for use within this file (ApiResponse, PaginatedApiSuccess).
// `export type` re-exports it so all existing imports from api-types remain unchanged.
import type { ApiSuccess } from './api-error-types';
export type { ApiSuccess } from './api-error-types';

/** Client-safe failure envelope. UI always receives an `ApiClientError` instance. */
export type ApiFailure = {
  readonly success: false;
  readonly error: import('./api-error').ApiClientError;
};

/**
 * Discriminated union for all feature hooks.
 * Narrow with `if (response.success)` — TypeScript infers the correct branch.
 *
 * @example
 * const res: ApiResponse<User> = await fetchUser();
 * if (res.success) {
 *   setUser(res.data);
 * } else {
 *   handleError(res.error); // ApiClientError
 * }
 */
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/** Client-safe paginated list response. */
export type PaginatedApiSuccess<T> = ApiSuccess<T[]> & {
  readonly pagination: PaginationMeta;
};

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN TYPES  (backend-agnostic, safe for UI)
// ─────────────────────────────────────────────────────────────────────────────

/** Backend stores `complete` internally but API boundary emits `done`. Never use `complete`. */
export type JobStatus = 'pending' | 'processing' | 'done' | 'failed';

export type JobRef = {
  readonly jobId: string;
  readonly status: JobStatus;
  readonly createdAt: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// AXIOS REQUEST CONFIG EXTENSION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Subset of AxiosRequestConfig used by `apiRequest`. Avoids importing Axios types here.
 *
 * AbortSignal threading contract:
 *  - `signal` must be forwarded from every caller that can be cancelled.
 *  - React Query callers: destructure from `queryFn`'s context argument —
 *      `queryFn: ({ signal }) => metricsApi.getFunnel(params, signal)`
 *  - Manual fetch callers (useMetrics, etc.): pass the AbortController signal
 *      created per-batch — never close over a stale outer signal.
 *  - Endpoint functions: always include `signal?: AbortSignal` in their
 *      signature and forward it into apiRequest({ ..., signal }).
 *
 * This ensures React Query can cancel in-flight requests on query key change
 * or component unmount, eliminating race conditions and wasted network work.
 */
export type ApiRequestConfig = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  data?: unknown;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  /** Forward from React Query's queryFn context or from the caller's AbortController. */
  signal?: AbortSignal;
  /**
   * @future Reserved for retry middleware. Setting this flag has NO effect today.
   * When retry logic is implemented, pass `retry: true` to opt in.
   * Idempotent methods (GET, PUT, DELETE) will be eligible for automatic retry;
   * mutating methods (POST, PATCH) will not retry unless explicitly flagged.
   */
  retry?: boolean;
};