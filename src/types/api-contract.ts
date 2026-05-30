/**
 * @file src/types/api-contract.ts
 * @description Hirerise client-safe API contract.
 *
 * This is the ONLY file UI components and feature hooks should import from.
 * Raw backend wire types live in `api.ts` and must not leak past this boundary.
 *
 * Exports:
 *  §1  BackendErrorCode          — stable error code registry
 *  §2  ERROR_CODE_TO_HTTP_STATUS — canonical HTTP status map (R5)
 *  §3  ErrorCategory             — UI-facing error abstraction
 *  §4  PaginationMeta            — normalised pagination shape
 *  §5  ApiSuccess<T>             — client-safe success type
 *  §6  ApiFailure                — client-safe failure type
 *  §7  ApiResponse<T>            — discriminated union for feature hooks
 *  §8  PaginatedApiSuccess<T>    — paginated list variant
 *  §9  ContractViolationError    — dev-only contract enforcement
 *  §10 assertValidResponse       — dev-safe response shape guard
 *  §11 parseBackendError         — error wire shape → ApiClientError
 *  §12 parseBackendSuccess       — success wire shape → ApiSuccess<T>
 *  §13 parseBackendPaginated     — paginated wire shape → PaginatedApiSuccess<T>
 *  §14 parseApiResponse          — unified entry point for all wire shapes
 *  §15 ApiClientError            — runtime error class (category-first)
 *  §16 Type guards
 *
 * CONTRACT VERSION: 2.2.0
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  CONTRACT RULES                                                      │
 * │  R1  success=true   → data MUST be present, error MUST be absent    │
 * │  R2  success=false  → data MUST be absent,  error MUST be present   │
 * │  R3  error.code     → MUST be a BackendErrorCode value              │
 * │  R4  message        → MUST be a non-empty string on every response  │
 * │  R5  HTTP status    → MUST align with the error code category       │
 * └──────────────────────────────────────────────────────────────────────┘
 */

import type {
  RawApiError,
  RawApiErrorLegacy,
  RawApiErrorTransitional,
  RawApiErrorV2,
  RawApiSuccess,
  RawPaginatedMeta,
} from './api';

// ─────────────────────────────────────────────────────────────────────────────
// §1 — ERROR CODE REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Centralised, stable error code registry.
 *
 * STABILITY CONTRACT:
 *  - Values are frozen strings used as keys in monitoring, alerting, and i18n.
 *  - Never rename or delete a value — add a new one and deprecate the old.
 *  - Adding new values is always backward-compatible.
 *
 * ⚠️  UI RULE: Never branch on `BackendErrorCode` values in components.
 *    Always use `ErrorCategory` via `err.category`.
 */
export const BackendErrorCode = {

  // ── AUTH (HTTP 401 / 403) ─────────────────────────────────────────────────
  /** No valid JWT present in the Authorization header. */
  UNAUTHORIZED: 'UNAUTHORIZED',
  /** JWT was valid but has expired. Prompt silent token refresh then retry. */
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  /** Authenticated user lacks permission for this resource. Do not retry. */
  FORBIDDEN: 'FORBIDDEN',

  // ── VALIDATION (HTTP 400 / 422) ───────────────────────────────────────────
  /** Request body / query params failed schema validation. `details` has field errors. */
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  /** A field value is structurally valid but semantically wrong. */
  INVALID_INPUT: 'INVALID_INPUT',

  // ── RESUME (HTTP 400 / 404 / 422) ────────────────────────────────────────
  /** The requested resumeId does not exist or does not belong to the caller. */
  RESUME_NOT_FOUND: 'RESUME_NOT_FOUND',
  /** No resume file was included in the multipart request. */
  NO_FILE: 'NO_FILE',
  /** File was uploaded but is not a valid resume / CV. */
  NOT_A_CV: 'NOT_A_CV',
  /** Resume was received but the async scoring pipeline failed. */
  PROCESSING_FAILED: 'PROCESSING_FAILED',

  // ── ONBOARDING (HTTP 400 / 422) ───────────────────────────────────────────
  /** The submitted onboarding step is not a legal transition from current state. */
  ONBOARDING_STEP_INVALID: 'ONBOARDING_STEP_INVALID',
  /** A qualification entry failed domain validation. */
  QUALIFICATION_INVALID: 'QUALIFICATION_INVALID',

  // ── RESOURCE (HTTP 404 / 409) ─────────────────────────────────────────────
  /** Generic not-found when a more specific code is not available. */
  NOT_FOUND: 'NOT_FOUND',
  /** Operation conflicts with existing state (e.g. duplicate submission). */
  CONFLICT: 'CONFLICT',

  // ── RATE LIMIT (HTTP 429) ─────────────────────────────────────────────────
  /** Per-user or per-route rate limit exceeded. Check `retryAfter`. */
  RATE_LIMITED: 'RATE_LIMITED',
  /**
   * Alias emitted by some middleware versions.
   * @deprecated Use RATE_LIMITED. Will be unified in a future release.
   */
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  /** The caller has reached their daily job-submission cap. */
  PENDING_JOB_LIMIT_EXCEEDED: 'PENDING_JOB_LIMIT_EXCEEDED',

  // ── TIER / PLAN (HTTP 402 / 403) ─────────────────────────────────────────
  /** Feature requires a higher subscription tier. Check `details.upgradeUrl`. */
  TIER_INSUFFICIENT: 'TIER_INSUFFICIENT',
  /** Alias used by the plan-credit subsystem. */
  PLAN_UPGRADE_REQUIRED: 'PLAN_UPGRADE_REQUIRED',
  /** User's AI credit allowance for the day is exhausted. */
  DAILY_AI_COST_LIMIT_EXCEEDED: 'DAILY_AI_COST_LIMIT_EXCEEDED',

  // ── SYSTEM (HTTP 500 / 502 / 503) ─────────────────────────────────────────
  /** Unclassified server-side failure. */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  /** A downstream service (AI, embeddings, pub/sub) returned an error or timed out. */
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  /** The rate-limit backend service itself is unavailable. Treat as transient. */
  RATE_LIMIT_SERVICE_UNAVAILABLE: 'RATE_LIMIT_SERVICE_UNAVAILABLE',

} as const;

/** Branded union of all valid error code strings. */
export type BackendErrorCode = (typeof BackendErrorCode)[keyof typeof BackendErrorCode];

// ─────────────────────────────────────────────────────────────────────────────
// §2 — HTTP STATUS MAP  (R5)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical HTTP status for every error code.
 * Used by `parseBackendError` for R5 validation and by `ApiClientError`
 * to normalise status when the transport layer value is unavailable.
 */
export const ERROR_CODE_TO_HTTP_STATUS: Record<BackendErrorCode, number> = {
  [BackendErrorCode.UNAUTHORIZED]:                    401,
  [BackendErrorCode.TOKEN_EXPIRED]:                   401,
  [BackendErrorCode.FORBIDDEN]:                       403,
  [BackendErrorCode.VALIDATION_ERROR]:                400,
  [BackendErrorCode.INVALID_INPUT]:                   400,
  [BackendErrorCode.RESUME_NOT_FOUND]:                404,
  [BackendErrorCode.NO_FILE]:                         400,
  [BackendErrorCode.NOT_A_CV]:                        422,
  [BackendErrorCode.PROCESSING_FAILED]:               422,
  [BackendErrorCode.ONBOARDING_STEP_INVALID]:         400,
  [BackendErrorCode.QUALIFICATION_INVALID]:           400,
  [BackendErrorCode.NOT_FOUND]:                       404,
  [BackendErrorCode.CONFLICT]:                        409,
  [BackendErrorCode.RATE_LIMITED]:                    429,
  [BackendErrorCode.RATE_LIMIT_EXCEEDED]:             429,
  [BackendErrorCode.PENDING_JOB_LIMIT_EXCEEDED]:      429,
  [BackendErrorCode.TIER_INSUFFICIENT]:               403,
  [BackendErrorCode.PLAN_UPGRADE_REQUIRED]:           402,
  [BackendErrorCode.DAILY_AI_COST_LIMIT_EXCEEDED]:    429,
  [BackendErrorCode.INTERNAL_ERROR]:                  500,
  [BackendErrorCode.EXTERNAL_SERVICE_ERROR]:          502,
  [BackendErrorCode.RATE_LIMIT_SERVICE_UNAVAILABLE]:  503,
};

// ─────────────────────────────────────────────────────────────────────────────
// §3 — ERROR CATEGORY SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * UI-facing error category abstraction.
 *
 * ✅  UI MUST branch on `category` — never on the raw `code`.
 * ❌  Do NOT import BackendErrorCode into UI components.
 *
 * @example
 * if (err.category === 'auth')       redirectToLogin();
 * if (err.category === 'tier_gate')  openUpgradeModal();
 * if (err.category === 'rate_limit') scheduleRetry(err.retryAfter);
 * if (err.category === 'validation') showFieldErrors(err.details);
 * if (err.category === 'server')     showGenericErrorToast();
 */
export type ErrorCategory =
  | 'auth'        // 401 / 403 — re-authenticate or redirect to login
  | 'validation'  // 400 / 422 — surface field errors, do not retry
  | 'not_found'   // 404 — resource absent
  | 'conflict'    // 409 — state conflict, user action required
  | 'rate_limit'  // 429 — back off, respect retryAfter
  | 'tier_gate'   // 402 / 403 plan — prompt upgrade
  | 'server'      // 5xx — retry with back-off, show generic error UI
  | 'unknown';    // unclassified — log and show generic message

/**
 * Maps a raw backend error code to a stable UI category.
 * Returns `'unknown'` for any code not in the registry so new backend
 * codes degrade gracefully without ever breaking UI.
 */
function mapErrorCodeToCategory(code: string | undefined): ErrorCategory {
  if (!code) return 'unknown';

  switch (code) {
    case BackendErrorCode.UNAUTHORIZED:
    case BackendErrorCode.TOKEN_EXPIRED:
    case BackendErrorCode.FORBIDDEN:
      return 'auth';

    case BackendErrorCode.VALIDATION_ERROR:
    case BackendErrorCode.INVALID_INPUT:
    case BackendErrorCode.ONBOARDING_STEP_INVALID:
    case BackendErrorCode.QUALIFICATION_INVALID:
    case BackendErrorCode.NO_FILE:
    case BackendErrorCode.NOT_A_CV:
      return 'validation';

    case BackendErrorCode.RESUME_NOT_FOUND:
    case BackendErrorCode.NOT_FOUND:
      return 'not_found';

    case BackendErrorCode.CONFLICT:
      return 'conflict';

    case BackendErrorCode.RATE_LIMITED:
    case BackendErrorCode.RATE_LIMIT_EXCEEDED:
    case BackendErrorCode.PENDING_JOB_LIMIT_EXCEEDED:
    case BackendErrorCode.DAILY_AI_COST_LIMIT_EXCEEDED:
      return 'rate_limit';

    case BackendErrorCode.TIER_INSUFFICIENT:
    case BackendErrorCode.PLAN_UPGRADE_REQUIRED:
      return 'tier_gate';

    case BackendErrorCode.INTERNAL_ERROR:
    case BackendErrorCode.EXTERNAL_SERVICE_ERROR:
    case BackendErrorCode.PROCESSING_FAILED:
    case BackendErrorCode.RATE_LIMIT_SERVICE_UNAVAILABLE:
      return 'server';

    default:
      return 'unknown';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// §4 — PAGINATION META
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalised, client-safe pagination shape.
 *
 * All fields are optional — not every paginated endpoint returns every counter.
 * UI components must always guard before rendering (e.g. `total ?? 0`).
 *
 * Field mapping from backend wire shape:
 *   total    ← meta.total
 *   page     ← meta.page
 *   limit    ← meta.pageSize  (renamed: backend uses pageSize, UI uses limit)
 *   hasMore  ← meta.hasMore   (derived field, kept as-is)
 */
export type PaginationMeta = {
  readonly total?: number;
  readonly page?: number;
  readonly limit?: number;
  readonly hasMore?: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// §5 — CLIENT-SAFE SUCCESS TYPE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Client-safe success type.
 * The raw `meta` block is flattened — UI code never touches `meta.requestId`.
 */
export type ApiSuccess<T> = {
  readonly success: true;
  readonly data: T;
  /** Correlation ID surfaced for structured logging in feature hooks. */
  readonly requestId?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// §6 — CLIENT-SAFE FAILURE TYPE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Client-safe failure type.
 * UI code receives an `ApiClientError` instance — never a raw backend body.
 */
export type ApiFailure = {
  readonly success: false;
  readonly error: ApiClientError;
};

// ─────────────────────────────────────────────────────────────────────────────
// §7 — DISCRIMINATED UNION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Client-safe discriminated union.
 * Narrow with `if (response.success)` — TypeScript infers the correct branch.
 *
 * @example
 * const res: ApiResponse<User> = await fetchUser();
 * if (res.success) {
 *   setUser(res.data);
 * } else {
 *   handleError(res.error); // res.error is ApiClientError
 * }
 */
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

// ─────────────────────────────────────────────────────────────────────────────
// §8 — PAGINATED SUCCESS TYPE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Client-safe paginated list response.
 * Uses `PaginationMeta` (all fields optional) so partial backends don't break.
 */
export type PaginatedApiSuccess<T> = ApiSuccess<T[]> & {
  readonly pagination: PaginationMeta;
};

// ─────────────────────────────────────────────────────────────────────────────
// §9 — CONTRACT VIOLATION TOOLING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Thrown in non-production environments when the backend returns a response
 * that violates the API contract (R1–R5).
 *
 * Never thrown in production — all parsers degrade gracefully instead.
 */
export class ContractViolationError extends Error {
  public readonly violations: string[];
  public readonly rawResponse: unknown;

  constructor(violations: string[], rawResponse: unknown) {
    super(
      `[Hirerise] API contract violation(s) detected:\n` +
        violations.map((v) => `  • ${v}`).join('\n'),
    );
    this.name = 'ContractViolationError';
    this.violations = violations;
    this.rawResponse = rawResponse;
    Object.setPrototypeOf(this, ContractViolationError.prototype);
  }
}

/**
 * Guards that a raw API response is a non-null plain object.
 * Logs a contract violation in non-production environments.
 * Returns `false` (instead of throwing) so production always degrades safely.
 */
export function assertValidResponse(raw: unknown): raw is Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    if (_isDev()) {
      console.error('[API CONTRACT VIOLATION] Response is not a plain object:', raw);
    }
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dev environment check — works in Vite without `@types/node` or `vite/client`.
 * The double cast through `unknown` sidesteps the `ImportMeta` interface entirely.
 * The `try/catch` handles any runtime environment where `import.meta.env` is absent.
 * Falls back to `true` so violations are never silently swallowed.
 */
function _isDev(): boolean {
  try {
    return (import.meta as unknown as { env: { DEV: boolean } }).env.DEV !== false;
  } catch {
    return true;
  }
}

const FALLBACK_MESSAGE = 'Unexpected server response';

/** Returns a safe fallback `ApiClientError` for unrecoverable parse failures. */
function _fallbackError(httpStatus = 500): ApiClientError {
  return new ApiClientError({
    message: FALLBACK_MESSAGE,
    category: 'unknown',
    status: httpStatus,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// WIRE SHAPE DISCRIMINATORS (internal)
// ─────────────────────────────────────────────────────────────────────────────

function _isV2Shape(raw: Record<string, unknown>): raw is RawApiErrorV2 {
  return (
    raw.success === false &&
    raw.error !== null &&
    typeof raw.error === 'object' &&
    !Array.isArray(raw.error)
  );
}

function _isLegacyShape(raw: Record<string, unknown>): raw is RawApiErrorLegacy {
  return typeof raw.error === 'string' && raw.error.length > 0;
}

function _isTransitionalShape(raw: Record<string, unknown>): raw is RawApiErrorTransitional {
  return typeof (raw as RawApiErrorTransitional).code === 'string';
}

function _isSuccessShape(raw: Record<string, unknown>): raw is RawApiSuccess<unknown> {
  return raw.success === true && 'data' in raw;
}

// ─────────────────────────────────────────────────────────────────────────────
// §10 — ERROR PARSER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalises any of the three backend error wire shapes into an `ApiClientError`.
 *
 * Shape priority:
 *  1. V2 (current):      { success: false, error: { code, message }, meta }
 *  2. Legacy:            { error: 'CODE_STRING', message, requestId }
 *  3. Transitional:      { code, message, requestId }
 *
 * Dev: logs every parsed error; warns when legacy/transitional shapes are hit.
 * Prod: silent — always returns a valid `ApiClientError`, never throws.
 *
 * @param raw         Raw response body (typed as `unknown` for interceptor safety).
 * @param httpStatus  HTTP status from the transport layer. Defaults to 500.
 */
export function parseBackendError(
  raw: RawApiError | unknown,
  httpStatus = 500,
): ApiClientError {
  try {
    if (!assertValidResponse(raw)) {
      return _fallbackError(httpStatus);
    }

    const body = raw as Record<string, unknown>;

    let code: string | undefined;
    let message: string = FALLBACK_MESSAGE;
    let requestId: string | undefined;
    let retryAfter: number | undefined;
    let details: Record<string, unknown> | null = null;

    // ── Branch 1: V2 shape ────────────────────────────────────────────────
    if (_isV2Shape(body)) {
      const errObj = body.error as Record<string, unknown>;

      code    = typeof errObj.code === 'string' ? errObj.code : undefined;
      message =
        typeof errObj.message === 'string' && errObj.message.length > 0
          ? errObj.message
          : typeof body.message === 'string' && (body.message as string).length > 0
            ? (body.message as string)
            : FALLBACK_MESSAGE;

      if (errObj.details && typeof errObj.details === 'object' && !Array.isArray(errObj.details)) {
        details = errObj.details as Record<string, unknown>;
      }

      const meta = body.meta as Record<string, unknown> | undefined;
      requestId  = typeof meta?.requestId === 'string' ? meta.requestId : undefined;

      const ra   = meta?.retryAfter ?? meta?.retryAfterSeconds;
      retryAfter = typeof ra === 'number' && ra > 0 ? ra : undefined;
    }

    // ── Branch 2: Legacy shape ────────────────────────────────────────────
    else if (_isLegacyShape(body)) {
      code      = body.error as string;
      message   =
        typeof body.message === 'string' && (body.message as string).length > 0
          ? (body.message as string)
          : FALLBACK_MESSAGE;
      requestId = typeof body.requestId === 'string' ? (body.requestId as string) : undefined;

      if (_isDev()) {
        console.warn('[API] Legacy error shape detected — migrate backend to v2 shape', { code, raw });
      }
    }

    // ── Branch 3: Transitional shape ──────────────────────────────────────
    else if (_isTransitionalShape(body)) {
      code      = (body as RawApiErrorTransitional).code;
      message   =
        typeof body.message === 'string' && (body.message as string).length > 0
          ? (body.message as string)
          : FALLBACK_MESSAGE;
      requestId = typeof body.requestId === 'string' ? (body.requestId as string) : undefined;

      if (_isDev()) {
        console.warn('[API] Transitional error shape detected — migrate backend to v2 shape', { code, raw });
      }
    }

    // ── R5: derive canonical HTTP status ──────────────────────────────────
    const mappedStatus = code ? ERROR_CODE_TO_HTTP_STATUS[code as BackendErrorCode] : undefined;
    const status =
      httpStatus !== 500     ? httpStatus  :
      mappedStatus           ? mappedStatus :
      // Cast through unknown — RawApiError union has no `status` field but some
      // middleware shapes emit it at the top level.
      typeof (body as unknown as Record<string, unknown>).status === 'number'
        ? (body as unknown as Record<string, unknown>).status as number :
      500;

    const category = mapErrorCodeToCategory(code);

    if (_isDev()) {
      console.error('[API ERROR PARSED]', { code, message, category, status, requestId, raw });
    }

    return new ApiClientError({ message, code, category, status, requestId, retryAfter, details });

  } catch {
    // Ultimate safety net — never let a parse failure propagate unhandled.
    return _fallbackError(httpStatus);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// §11 — SUCCESS PARSER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses a `RawApiSuccess<T>` wire response into a client-safe `ApiSuccess<T>`.
 *
 * Validates:
 *  - `success === true`  (R1)
 *  - `data` is present   (R1)
 *
 * Returns an `ApiFailure` wrapping an `ApiClientError` if either check fails
 * so callers always receive a valid `ApiResponse<T>` — never a thrown exception.
 */
export function parseBackendSuccess<T>(raw: RawApiSuccess<T>): ApiSuccess<T> | ApiFailure {
  try {
    if (raw.success !== true) {
      if (_isDev()) {
        console.error('[API CONTRACT VIOLATION] parseBackendSuccess called with success !== true', raw);
      }
      return {
        success: false,
        error: new ApiClientError({
          message: FALLBACK_MESSAGE,
          category: 'unknown',
          status: 500,
        }),
      };
    }

    if (raw.data === undefined || raw.data === null) {
      if (_isDev()) {
        console.error('[API CONTRACT VIOLATION] Success response missing data field (R1)', raw);
      }
      return {
        success: false,
        error: new ApiClientError({
          message: FALLBACK_MESSAGE,
          category: 'unknown',
          status: 500,
        }),
      };
    }

    return {
      success: true,
      data: raw.data,
      requestId: raw.meta?.requestId,
    };
  } catch {
    return { success: false, error: _fallbackError() };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// §12 — PAGINATED SUCCESS PARSER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses a raw paginated wire response into a `PaginatedApiSuccess<T>`.
 *
 * Validates:
 *  - `success === true` (R1)
 *  - `data` is a non-null array (R1)
 *
 * All `PaginationMeta` fields are optional — partial backends never cause crashes.
 * Backend `pageSize` is remapped to `limit` for UI consistency.
 */
export function parseBackendPaginated<T>(
  raw: Omit<RawApiSuccess<T[]>, 'meta'> & { meta: RawPaginatedMeta },
): PaginatedApiSuccess<T> | ApiFailure {
  try {
    if (raw.success !== true) {
      if (_isDev()) {
        console.error('[API CONTRACT VIOLATION] parseBackendPaginated called with success !== true', raw);
      }
      return { success: false, error: _fallbackError() };
    }

    if (!Array.isArray(raw.data)) {
      if (_isDev()) {
        console.error('[API CONTRACT VIOLATION] Paginated success response has non-array data (R1)', raw);
      }
      return { success: false, error: _fallbackError() };
    }

    const meta = raw.meta ?? {};

    return {
      success:   true,
      data:      raw.data,
      requestId: meta.requestId,
      pagination: {
        total:   typeof meta.total    === 'number' ? meta.total    : undefined,
        page:    typeof meta.page     === 'number' ? meta.page     : undefined,
        limit:   typeof meta.pageSize === 'number' ? meta.pageSize : undefined,
        hasMore: typeof meta.hasMore  === 'boolean' ? meta.hasMore : undefined,
      },
    };
  } catch {
    return { success: false, error: _fallbackError() };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// §13 — UNIFIED PARSER ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Single entry point for parsing any raw API response.
 *
 * Logic:
 *  1. Validate raw is a non-null object                     → fallback on failure
 *  2. Detect success vs error via `success` discriminant
 *  3. On success: validate `data` exists, return ApiSuccess  → fallback on failure
 *  4. On error:   parse wire shape → ApiClientError
 *  5. ALWAYS returns a valid `ApiResponse<T>` — never throws
 *
 * Use this in your Axios interceptor for a single, consistent call site:
 *
 * @example
 * axiosInstance.interceptors.response.use(
 *   (res) => parseApiResponse(res.data),
 *   (err) => {
 *     const raw    = err.response?.data;
 *     const status = err.response?.status ?? 500;
 *     return parseApiResponse(raw, status);
 *   },
 * );
 *
 * @param raw         Raw response body (unknown — safe for any interceptor).
 * @param httpStatus  HTTP status from the transport layer. Defaults to 200 for
 *                    success paths, 500 for error paths when not provided.
 */
export function parseApiResponse<T>(raw: unknown, httpStatus?: number): ApiResponse<T> {
  try {
    // ── Structural guard ──────────────────────────────────────────────────
    if (!assertValidResponse(raw)) {
      return { success: false, error: _fallbackError(httpStatus) };
    }

    const body = raw as Record<string, unknown>;

    // ── Route: success ────────────────────────────────────────────────────
    if (_isSuccessShape(body)) {
      return parseBackendSuccess(body as RawApiSuccess<T>) as ApiResponse<T>;
    }

    // ── Route: error (all three wire shapes) ──────────────────────────────
    return {
      success: false,
      error: parseBackendError(body, httpStatus),
    };

  } catch {
    // Absolute safety net — no uncaught exceptions escape this function.
    return { success: false, error: _fallbackError(httpStatus) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// §14 — API CLIENT ERROR CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Constructor parameters for `ApiClientError`.
 * Internal — not exported. Use `parseBackendError` or `parseApiResponse` to create instances.
 */
type ApiClientErrorParams = {
  message: string;
  /**
   * @internal Raw backend code. For logging and i18n key lookup ONLY.
   * UI must branch on `category`, never on `code`.
   */
  code?: string;
  category: ErrorCategory;
  status?: number;
  requestId?: string;
  retryAfter?: number;
  details?: Record<string, unknown> | null;
};

/**
 * Runtime error class produced by all parsers in this module.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  UI USAGE RULE                                                      │
 * │  ✅  Branch on `err.category`  — stable, backend-agnostic          │
 * │  ✅  Read `err.details`        — for field-level validation info    │
 * │  ✅  Read `err.retryAfter`     — for rate-limit back-off           │
 * │  ⚠️  `err.code` is INTERNAL   — logging / i18n keys only          │
 * │  ❌  Never branch on `err.code` in UI components                   │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * @example
 * switch (err.category) {
 *   case 'auth':       return redirectToLogin();
 *   case 'tier_gate':  return openUpgradeModal(err.details?.upgradeUrl);
 *   case 'rate_limit': return scheduleRetry(err.retryAfter ?? 30);
 *   case 'validation': return showFieldErrors(err.details);
 *   default:           return showGenericToast(err.message);
 * }
 */
export class ApiClientError extends Error {
  /**
   * Raw backend error code string.
   *
   * @internal INTERNAL USE ONLY — for logging pipelines and i18n key lookup.
   * UI components MUST NOT branch on this value. Use `category` instead.
   * This value may change as the backend evolves; `category` will not.
   */
  public readonly code: BackendErrorCode | string | undefined;

  /**
   * UI-facing error category.
   * This is the primary field — always branch on this in UI components.
   */
  public readonly category: ErrorCategory;

  /** HTTP status code resolved from the transport layer or the error code map. */
  public readonly status: number;

  /**
   * Seconds to wait before retrying.
   * Only populated on `rate_limit` category errors.
   * `undefined` means no hint was provided — apply your own back-off strategy.
   */
  public readonly retryAfter: number | undefined;

  /** Correlation ID for structured logging and support requests. */
  public readonly requestId: string | undefined;

  /**
   * Structured details payload. Shape is endpoint-specific.
   * Check `category` before accessing:
   *  - `validation` → field error map
   *  - `tier_gate`  → `{ upgradeUrl: string }`
   *  - `rate_limit` → may include quota info
   */
  public readonly details: Record<string, unknown> | null;

  constructor(params: ApiClientErrorParams) {
    super(params.message);
    this.name       = 'ApiClientError';
    this.code       = params.code;
    this.category   = params.category;
    this.status     = params.status ?? 500;
    this.retryAfter = params.retryAfter;
    this.requestId  = params.requestId;
    this.details    = params.details ?? null;

    // Preserve prototype chain for `instanceof` checks in transpiled output
    Object.setPrototypeOf(this, ApiClientError.prototype);
  }

  // ── CATEGORY GETTERS  (all delegate to `category` — single source of truth) ──

  /**
   * `true` for auth failures (401 / 403).
   * Prompt silent token refresh then retry — or redirect to login.
   */
  get isAuthError(): boolean     { return this.category === 'auth'; }

  /**
   * `true` for validation failures (400 / 422).
   * Do NOT retry — surface field-level errors from `this.details` to the user.
   */
  get isValidationError(): boolean { return this.category === 'validation'; }

  /**
   * `true` for rate-limit errors (429).
   * Respect `this.retryAfter` (seconds) before scheduling a retry.
   */
  get isRateLimit(): boolean     { return this.category === 'rate_limit'; }

  /**
   * `true` for tier-gate errors (402 / plan 403).
   * Prompt the user to upgrade. Check `this.details?.upgradeUrl` for the CTA target.
   */
  get isTierGate(): boolean      { return this.category === 'tier_gate'; }

  /**
   * `true` for server errors (5xx).
   * Retry with exponential back-off; show a generic error UI.
   */
  get isServerError(): boolean   { return this.category === 'server'; }

  /**
   * `true` for not-found errors (404).
   */
  get isNotFound(): boolean      { return this.category === 'not_found'; }

  /**
   * `true` for conflict errors (409).
   */
  get isConflict(): boolean      { return this.category === 'conflict'; }

  /** Serialise to a plain object for structured logging pipelines. */
  toJSON(): Record<string, unknown> {
    return {
      name:       this.name,
      code:       this.code,        // included for log correlation only
      category:   this.category,
      message:    this.message,
      status:     this.status,
      requestId:  this.requestId,
      retryAfter: this.retryAfter,
      details:    this.details,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// §15 — TYPE GUARDS
// ─────────────────────────────────────────────────────────────────────────────

/** Narrows an `ApiResponse<T>` to `ApiSuccess<T>`. */
export function isApiSuccess<T>(response: ApiResponse<T>): response is ApiSuccess<T> {
  return response.success === true;
}

/** Narrows an `ApiResponse<T>` to `ApiFailure`. */
export function isApiFailure<T>(response: ApiResponse<T>): response is ApiFailure {
  return response.success === false;
}

/** Returns `true` when the code is a known `BackendErrorCode`. */
export function isKnownErrorCode(code: string): code is BackendErrorCode {
  return Object.values(BackendErrorCode).includes(code as BackendErrorCode);
}

/** Returns `true` when an error is an `ApiClientError` instance. */
export function isApiClientError(err: unknown): err is ApiClientError {
  return err instanceof ApiClientError;
}
// ─────────────────────────────────────────────────────────────────────────────
// §16 — METRIC STATUS SYSTEM  (analytics dashboard contract)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tri-state metric health classification.
 *
 * DESIGN DECISION — "neutral" is intentionally excluded:
 *   neutral was previously used as a null-safety escape hatch when data was
 *   absent. The correct pattern is to guard at the call-site and not render
 *   a status indicator at all when the source value is null/undefined.
 *   Keeping neutral in the union forces every consumer to handle a fourth
 *   branch that is semantically meaningless and produces confusing UI.
 *
 * MIGRATION: all call-sites that previously returned 'neutral' on null input
 *   now return 'warning' as a safe default, or are guarded with an optional
 *   prop so the status strip is hidden entirely.
 */
export type MetricStatus = 'good' | 'warning' | 'critical';

// ─────────────────────────────────────────────────────────────────────────────
// §17 — BASE METRIC + DOMAIN METRIC TYPES  (analytics dashboard contract)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimal base for any displayable metric value.
 * All domain metric types extend this so the status + formatted-string pair
 * is always co-located, reducing prop-drilling in the UI layer.
 */
export interface BaseMetric {
  /** Pre-formatted display string (e.g. "74.3%", "2.1 s"). Never null — use "—" as fallback. */
  readonly formatted: string;
  /** Health classification for visual status indicators. */
  readonly status: MetricStatus;
}

/**
 * KPI card metric — adds optional period-comparison fields.
 * UI renders delta + trend only when both are non-null.
 */
export interface KpiMetric extends BaseMetric {
  readonly delta?: string | null;
  readonly trend?: 'up' | 'down' | 'neutral' | null;
  readonly improved?: boolean | null;
}

/**
 * Funnel step metric — includes bar geometry + optional raw count.
 * barPct is 0–100 (UI percentage, NOT 0–1).
 */
export interface FunnelStepMetric extends BaseMetric {
  readonly barPct: number;
  readonly count?: string | null;
}

/** Funnel drop-off row — formatted only; no status indicator. */
export interface FunnelDropOffMetric {
  readonly formatted: string;
}

/**
 * Latency percentile bar — includes bar geometry.
 * barPct drives the visual progress bar width (0–100).
 */
export interface PerformanceBarMetric extends BaseMetric {
  readonly barPct: number;
}

/** Stat-only performance metric (ratio / avg) — no bar geometry. */
export type PerformanceStatMetric = BaseMetric;

/**
 * Reliability row metric — adds optional delta + improvement direction.
 */
export interface ReliabilityMetric extends BaseMetric {
  readonly delta?: string | null;
  readonly improved?: boolean | null;
}

/** Derived / cross-section signal — status + formatted only. */
export type DerivedMetric = BaseMetric;

/**
 * Health panel metric.
 * score is the raw 0–1 value used only for SVG arc geometry.
 * All other fields are display-ready strings.
 */
export interface HealthMetric extends BaseMetric {
  /** Raw 0–1 score for SVG arc geometry ONLY. null during initial load. */
  readonly score: number | null;
  readonly delta?: string;
  readonly processingP50?: string;
  readonly timeToValueP50?: string;
}

/** Single entry in the period-comparison strip. */
export interface ComparisonEntry {
  readonly formatted: string;
  readonly delta: string;
  readonly improved: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// §18 — UI CONTRACT  (analytics dashboard)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * KPI section of the UI contract — four headline metrics.
 */
export interface UiKpis {
  readonly conversion:     KpiMetric;
  readonly uploadSessions: KpiMetric;
  readonly failureRate:    KpiMetric;
  readonly onboarding:     KpiMetric;
}

/** Funnel section of the UI contract. */
export interface UiFunnel {
  readonly uploadSuccess:      FunnelStepMetric;
  readonly processingSuccess:  FunnelStepMetric;
  readonly endToEndConversion: FunnelStepMetric;
  readonly dropOff:            FunnelDropOffMetric;
}

/** Latency section of the UI contract. */
export interface UiPerformance {
  readonly p50:         PerformanceBarMetric;
  readonly p95:         PerformanceBarMetric;
  readonly p99:         PerformanceBarMetric;
  readonly p95p50Ratio: PerformanceStatMetric;
  readonly avgAttempts: PerformanceStatMetric;
}

/** Reliability section of the UI contract. */
export interface UiReliability {
  readonly failureRate:  ReliabilityMetric;
  readonly timeoutRate:  ReliabilityMetric;
  readonly retrySuccess: ReliabilityMetric;
}

/** Derived signals section of the UI contract. */
export interface UiDerived {
  readonly retryWaste:    DerivedMetric;
  readonly p95p50Ratio:   DerivedMetric;
  readonly onboardingGap: DerivedMetric;
  readonly uploadDropOff: DerivedMetric;
}

/**
 * Comparison strip — null when comparison mode is disabled.
 * Each key maps to the comparison entry for that metric.
 */
export interface UiComparison {
  readonly conversion:  ComparisonEntry;
  readonly failureRate: ComparisonEntry;
  readonly timeout:     ComparisonEntry;
  readonly p95Latency:  ComparisonEntry;
  readonly uploadOk:    ComparisonEntry;
  readonly onboarding:  ComparisonEntry;
}

/**
 * Full UI contract for the analytics dashboard.
 *
 * This is the ONLY shape the UI layer imports for analytics display.
 * It is produced by the hooks layer and consumed by page + UI components.
 * Raw API section types (ResumeFunnelMetrics, PerformanceMetrics, etc.)
 * must NOT be imported in UI components — use this contract instead.
 *
 * comparison is null when the user has not activated comparison mode.
 */
export interface UiContract {
  readonly kpis:        UiKpis;
  readonly funnel:      UiFunnel;
  readonly performance: UiPerformance;
  readonly reliability: UiReliability;
  readonly derived:     UiDerived;
  readonly health:      HealthMetric;
  readonly comparison:  UiComparison | null;
}