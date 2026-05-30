/**
 * @file src/types/api.ts
 * @description Raw (wire) types — backend shape only.
 *
 * ⚠️  BOUNDARY RULE: Nothing in this file should be consumed directly by UI
 * components or feature hooks. All UI code must use the client-safe types
 * exported from `api-contract.ts`.
 *
 * These types faithfully model every response shape the Hirerise backend
 * currently emits, including the legacy and transitional shapes that are
 * still in production during the v1→v2 migration window.
 *
 * CONTRACT VERSION: 2.1.0
 * STATUS: FROZEN — additive changes only after backend sign-off.
 */

// ─────────────────────────────────────────────────────────────────────────────
// RAW META BLOCKS (backend-emitted)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Standard meta block injected by the backend middleware layer.
 * All fields are optional because legacy endpoints predate this block.
 */
export type RawResponseMeta = {
  requestId?: string;
  timestamp?: string;
  [key: string]: unknown;
};

/**
 * Extended meta block emitted on 429 rate-limit responses.
 * Both `retryAfter` and `retryAfterSeconds` are in production — backend emits
 * both spellings across different middleware versions.
 */
export type RawRateLimitMeta = RawResponseMeta & {
  retryAfter?: number;
  retryAfterSeconds?: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// RAW SUCCESS RESPONSE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Raw success envelope as it arrives from the backend.
 *
 * `T` defaults to `unknown` because wire types must not make assumptions about
 * the data shape — that validation is the caller's responsibility.
 */
export type RawApiSuccess<T = unknown> = {
  success: true;
  data: T;
  /** Always absent on success. May be `null` in some serialisers. */
  error?: null;
  meta?: RawResponseMeta;
};

// ─────────────────────────────────────────────────────────────────────────────
// RAW ERROR RESPONSES (all three backend shapes in production)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Current (v2) error envelope — emitted by controllers migrated to the new
 * `sendError()` helper.
 *
 * Shape: { success: false, error: { code, message, details }, meta: { requestId, ... } }
 */
export type RawApiErrorV2 = {
  success: false;
  error: {
    code?: string;
    message?: string;
    details?: unknown;
  };
  /** Top-level message mirror — present for backward compatibility. */
  message?: string;
  meta?: RawRateLimitMeta;
};

/**
 * Legacy (v1) error envelope — emitted by the central error handler and
 * pre-migration controllers.
 *
 * Shape: { error: 'CODE_STRING', message: '...', requestId, timestamp }
 */
export type RawApiErrorLegacy = {
  /** The error code itself as a plain string (not an object). */
  error: string;
  message?: string;
  requestId?: string;
  timestamp?: string;
};

/**
 * Transitional error envelope — emitted by auth and rate-limit middleware
 * that use a flat `code` field at the top level.
 *
 * Shape: { code: 'CODE', message: '...', requestId, timestamp }
 */
export type RawApiErrorTransitional = {
  code?: string;
  message?: string;
  requestId?: string;
  timestamp?: string;
};

/**
 * Union of all error shapes the backend currently emits.
 * `parseBackendError` in `api-contract.ts` handles all three branches.
 */
export type RawApiError =
  | RawApiErrorV2
  | RawApiErrorLegacy
  | RawApiErrorTransitional;

/**
 * Full raw response union as it comes off the wire.
 * Do NOT pass this into UI components — always parse through `api-contract.ts`.
 */
export type RawApiResponse<T = unknown> = RawApiSuccess<T> | RawApiError;

// ─────────────────────────────────────────────────────────────────────────────
// SHARED DOMAIN TYPES
// These are backend-agnostic value types safe to use in UI code.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Public-facing job status values.
 *
 * The backend DB stores `complete` internally but the API boundary translates
 * it to `done`. Never use `complete` on the frontend.
 */
export type JobStatus = 'pending' | 'processing' | 'done' | 'failed';

/**
 * Minimal job tracking reference returned when an async operation is enqueued.
 */
export type JobRef = {
  readonly jobId: string;
  readonly status: JobStatus;
  readonly createdAt: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// RAW PAGINATED RESPONSE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Raw meta block for paginated list endpoints.
 */
export type RawPaginatedMeta = RawResponseMeta & {
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

/**
 * Raw paginated success envelope.
 */
export type RawApiPaginatedSuccess<T = unknown> = Omit<RawApiSuccess<T[]>, 'meta'> & {
  meta: RawPaginatedMeta;
};