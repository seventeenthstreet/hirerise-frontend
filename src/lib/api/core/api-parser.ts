/**
 * @file lib/api/core/api-parser.ts
 * @description All API response parsing logic.
 *
 * SEPARATION OF CONCERNS:
 *  - This file handles STRUCTURE validation only.
 *  - Business validation (e.g. "data must exist") → use `ensureDataExists` from api-error.ts.
 *  - Transport errors (network, timeout) → handled in api-client.ts via `normalizeTransportError`.
 *
 * Exports:
 *  - isObject              — safe type guard for plain objects
 *  - hasSuccessFlag        — safe type guard for { success: boolean }
 *  - parseBackendError     — error wire shape → ApiClientError
 *  - parseBackendSuccess   — success wire shape → ApiSuccess<T> | ApiFailure
 *  - parseBackendPaginated — paginated wire shape → PaginatedApiSuccess<T> | ApiFailure
 *  - parseApiResponse      — unified entry point (success + error routing)
 */

import {
  ApiClientError,
  BackendErrorCode,
  ERROR_CODE_TO_HTTP_STATUS,
  _isDev,
  logApiParsingError,
  makeFallbackError,
  mapErrorCodeToCategory,
} from './api-error';

import {
  observeLegacyBranch,
  observeMalformedResponse,
  observeTransitionalBranch,
} from './api-parser-observation';

import type {
  ApiFailure,
  ApiResponse,
  ApiSuccess,
  PaginatedApiSuccess,
  RawApiError,
  RawApiErrorLegacy,
  RawApiErrorTransitional,
  RawApiErrorV2,
  RawApiPaginatedSuccess,
  RawApiSuccess,
} from './api-types';

const FALLBACK_MESSAGE = 'Unexpected server response';

// ─────────────────────────────────────────────────────────────────────────────
// MANDATORY TYPE GUARDS  (no unsafe property access allowed outside these)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Narrows `unknown` to `Record<string, unknown>`.
 * All property access in this file goes through this guard first.
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Narrows to an object with a `success` boolean field.
 * Used by `parseApiResponse` to route without unsafe access.
 *
 * Forward-compatible: also accepts `status: "ok" | "error"` and normalises
 * it to a boolean `success` field in-place. This prevents total system failure
 * if the backend slightly renames the success discriminator.
 *
 * Supported shapes:
 *  - `{ success: boolean }`       — canonical
 *  - `{ status: "ok" | "error" }` — tolerated, normalised to boolean
 */
export function hasSuccessFlag(value: unknown): value is { success: boolean } {
  if (!isObject(value)) return false;

  // Canonical shape — already a boolean.
  if (typeof value.success === 'boolean') return true;

  // Tolerated: success as string "true" / "false" — some serialisers emit this.
  if (value.success === 'true' || value.success === 'false') {
    (value as Record<string, unknown>).success = value.success === 'true';
    return true;
  }

  // Tolerated shape: status: "ok" | "error" — normalise in-place.
  if (value.status === 'ok' || value.status === 'error') {
    (value as Record<string, unknown>).success = value.status === 'ok';
    return true;
  }

  // NestJS default exception filter shape: { statusCode: number, message: string }
  if (
    typeof value.statusCode === 'number' &&
    value.statusCode >= 100 &&
    value.statusCode <= 599
  ) {
    (value as Record<string, unknown>).success = false;
    return true;
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL WIRE SHAPE DISCRIMINATORS
// ─────────────────────────────────────────────────────────────────────────────

function _isV2Shape(raw: Record<string, unknown>): raw is RawApiErrorV2 {
  return (
    raw.success === false &&
    isObject(raw.error)
  );
}

function _isLegacyShape(raw: Record<string, unknown>): raw is RawApiErrorLegacy {
  return typeof raw.error === 'string' && raw.error.length > 0;
}

/**
 * @deprecated TRANSITIONAL SHAPE — NON-LOAD-BEARING after Phase 2 migration.
 *
 * This discriminator was introduced to handle two legacy backend patterns:
 *   1. `{ code: string, message }` — older route-level inline error format
 *   2. `{ errorCode: string, message }` — formerly emitted by auth.middleware.js
 *
 * MIGRATION STATUS (Phase 2 — Eliminate Remaining Transitional Controllers):
 *   ✅ auth.middleware.js — migrated in Phase 1
 *   ✅ job.controller.js, careerPrediction.controller.js — migrated in Phase 2
 *   ✅ chiBenchmark.controller.js — migrated in Phase 2
 *   ✅ All education-intelligence controllers — migrated in Phase 2
 *   ✅ market.controller.js, adminCmsCareerDomains, adminCmsImport — migrated in Phase 2
 *   ✅ adminContributors, adminMetrics, adminPending — migrated in Phase 2
 *   ✅ adaptiveWeight.routes.js, jobSync.routes.js — migrated in Phase 2
 *   ✅ server.js auth safety net — migrated in Phase 2
 *
 * POST-PHASE-2: This branch is a safety net ONLY. No known backend endpoint should
 *   reach it in normal operation. A hit in dev logs signals an undiscovered legacy
 *   endpoint — investigate and migrate it before Phase 3.
 *
 * REMOVAL PLAN (Phase 3):
 *   - Verify zero transitional hits in prod logs over a 2-week observation window.
 *   - Remove `_isTransitionalShape`, `RawApiErrorTransitional` type, and Branch 3
 *     in `parseBackendError`.
 *
 * TODO(phase3-cleanup): Remove this function and Branch 3 in parseBackendError.
 */
function _isTransitionalShape(raw: Record<string, unknown>): raw is RawApiErrorTransitional {
  // Safety net only — post-Phase-2 this branch should never fire in normal operation.
  // `errorCode` detection retained for any unpatched/undiscovered endpoints.
  return typeof raw.code === 'string' || typeof raw.errorCode === 'string';
}

function _isSuccessShape(raw: Record<string, unknown>): raw is RawApiSuccess<unknown> {
  return raw.success === true && 'data' in raw;
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR PARSER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalises any of the three backend error wire shapes into an `ApiClientError`.
 *
 * Shape priority:
 *  1. V2:           { success: false, error: { code, message, details }, meta }
 *  2. Legacy:       { error: 'CODE_STRING', message, requestId }
 *  3. Transitional: { code, message, requestId }
 *
 * Never throws — always returns a valid `ApiClientError`.
 *
 * @param raw            Raw response body. Typed as `unknown` for interceptor safety.
 * @param httpStatus     HTTP status from the transport layer. Defaults to 500.
 * @param requestContext Optional { url, method } forwarded from parseApiResponse for observation.
 */
export function parseBackendError(
  raw: RawApiError | unknown,
  httpStatus = 500,
  requestContext?: { url?: string; method?: string },
): ApiClientError {
  try {
    if (!isObject(raw)) {
      logApiParsingError({ stage: 'parseBackendError', raw, message: 'Non-object error body' });
      return makeFallbackError(httpStatus, 'parseBackendError:non-object');
    }

    let code:      string | undefined;
    let message:   string = FALLBACK_MESSAGE;
    let requestId: string | undefined;
    let retryAfter: number | undefined;
    let details:   Record<string, unknown> | null = null;

    // ── Branch 1: V2 shape ────────────────────────────────────────────────
    if (_isV2Shape(raw)) {
      const errObj = raw.error as Record<string, unknown>;

      code    = typeof errObj.code === 'string'                              ? errObj.code    : undefined;
      message = typeof errObj.message === 'string' && errObj.message.length  ? errObj.message
              : typeof raw.message    === 'string' && (raw.message as string).length
                ? (raw.message as string)
                : FALLBACK_MESSAGE;

      if (isObject(errObj.details)) {
        details = errObj.details;
      }

      const meta   = isObject(raw.meta) ? raw.meta : undefined;
      requestId    = typeof meta?.requestId === 'string' ? meta.requestId : undefined;
      const ra     = meta?.retryAfter ?? meta?.retryAfterSeconds;
      retryAfter   = typeof ra === 'number' && ra > 0 ? ra : undefined;
    }

    // ── Branch 2: Legacy shape ────────────────────────────────────────────
    else if (_isLegacyShape(raw)) {
      code      = raw.error;
      message   = typeof raw.message === 'string' && (raw.message as string).length
                    ? (raw.message as string) : FALLBACK_MESSAGE;
      requestId = typeof raw.requestId === 'string' ? raw.requestId : undefined;

      // OBSERVATION: Record legacy branch hit for Phase 3 gate monitoring.
      // Must be called AFTER code is extracted so we can pass it for deduplication.
      observeLegacyBranch({ code, url: requestContext?.url, raw });

      if (_isDev()) {
        console.warn('[API] Legacy error shape — migrate to v2', { code, raw });
      }
    }

    // ── Branch 3: Transitional shape ──────────────────────────────────────
    else if (_isTransitionalShape(raw)) {
      code      = (typeof raw.code === 'string' ? raw.code : raw.errorCode) as string;
      message   = typeof raw.message === 'string' && (raw.message as string).length
                    ? (raw.message as string) : FALLBACK_MESSAGE;
      requestId = typeof raw.requestId === 'string' ? raw.requestId : undefined;

      // OBSERVATION: Record transitional branch hit. Post-Phase-2 this should
      // never fire. A hit here signals an undiscovered legacy endpoint.
      observeTransitionalBranch({ code, url: requestContext?.url, raw });

      if (_isDev()) {
        console.warn('[API] Transitional error shape — migrate to v2', { code, raw });
      }
    }

    // ── Branch 4: NestJS default exception shape ───────────────────────────
    // NestJS's built-in HttpException (TooManyRequestsException, UnauthorizedException,
    // etc.) emits { statusCode: number, message: string } when no custom response
    // interceptor is present. This shape has no `success` field (synthesised to false
    // by hasSuccessFlag) and no `code` / `error` field — all three branches above
    // miss it. Without this branch it would fall through to the status-derivation
    // block with all fields undefined, producing a generic system error with no
    // category information, which masks legitimate rate-limit / auth errors from
    // the UI layer.
    //
    // We don't set `code` (NestJS doesn't emit one) — mapErrorCodeToCategory will
    // return a category derived from httpStatus instead. The httpStatus passed in
    // from apiRequest is authoritative (it's the transport-layer status, not the
    // body field), so 429 → rate_limit, 401 → auth, etc.
    else if (
      typeof (raw as Record<string, unknown>).statusCode === 'number' &&
      typeof (raw as Record<string, unknown>).message    === 'string'
    ) {
      message = ((raw as Record<string, unknown>).message as string) || FALLBACK_MESSAGE;
      // No `code` — category is derived from httpStatus below.
      const ra = (raw as Record<string, unknown>).retryAfter;
      retryAfter = typeof ra === 'number' && ra > 0 ? ra : undefined;
    }

    // ── Derive canonical HTTP status (R5) ─────────────────────────────────
    const mappedStatus = code ? ERROR_CODE_TO_HTTP_STATUS[code as BackendErrorCode] : undefined;

    let fallbackStatus: number | undefined;
    if (isObject(raw)) {
      const rawRecord = raw as Record<string, unknown>;
      if (typeof rawRecord.status === 'number') {
        fallbackStatus = rawRecord.status;
      }
    }

    const status =
      httpStatus !== undefined     ? httpStatus     :
      mappedStatus !== undefined   ? mappedStatus   :
      fallbackStatus !== undefined ? fallbackStatus :
      500;

    // Derive category from error code first; fall back to HTTP status when
    // code is absent (e.g. NestJS default exception shape has no code field).
    let category = mapErrorCodeToCategory(code);
    if (category === 'system' && !code) {
      // mapErrorCodeToCategory returned the default 'system' because code is
      // undefined. Use HTTP status to give a more useful category:
      //   429 → rate_limit  (TooManyRequestsException)
      //   401/403 → auth    (UnauthorizedException / ForbiddenException)
      //   404 → not_found
      //   409 → conflict
      if      (status === 429)                   category = 'rate_limit';
      else if (status === 401 || status === 403)  category = 'auth';
      else if (status === 404)                    category = 'not_found';
      else if (status === 409)                    category = 'conflict';
      else if (status >= 500)                     category = 'server';
      // else leave as 'system'
    }

    // Downgraded from logApiParsingError (console.error) — this path is the
    // normal success path of parseBackendError (e.g. a 401 parsed correctly).
    // Using console.error here produced the misleading "[API PARSING ERROR] {}"
    // in DevTools for every expected auth failure. Only genuine exceptions
    // (the :catch branch below) are true parsing errors worth surfacing as errors.
    if (_isDev()) {
      console.debug('[API] Backend error parsed:', {
        stage: 'parseBackendError',
        code: code ?? 'none',
        category,
        raw,
      });
    }

    return new ApiClientError({ message, code, category, status, requestId, retryAfter, details });

  } catch (err) {
    logApiParsingError({ stage: 'parseBackendError:catch', raw, error: err });
    return makeFallbackError(httpStatus, 'parseBackendError:catch');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUCCESS PARSER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses a `RawApiSuccess<T>` wire response into `ApiSuccess<T>`.
 *
 * Structural validation only:
 *  - `success === true` must be present
 *  - `data` key must exist (may be `null` — business validation is the caller's job)
 *
 * Returns `ApiFailure` if the shape is invalid, so callers always get `ApiResponse<T>`.
 */
export function parseBackendSuccess<T>(raw: RawApiSuccess<T>): ApiSuccess<T> | ApiFailure {
  try {
    if (!isObject(raw)) {
      logApiParsingError({ stage: 'parseBackendSuccess', raw, message: 'Non-object response' });
      return { success: false, error: makeFallbackError(500, 'parseBackendSuccess:non-object') };
    }

    if (raw.success !== true) {
      logApiParsingError({ stage: 'parseBackendSuccess', raw,
        message: 'success flag is not true (R1 violation)' });
      return { success: false, error: makeFallbackError(500, 'parseBackendSuccess:R1') };
    }

    if (!('data' in (raw as unknown as Record<string, unknown>))) {
      logApiParsingError({ stage: 'parseBackendSuccess', raw,
        message: 'data key missing from success response (R1 violation)' });
      return { success: false, error: makeFallbackError(500, 'parseBackendSuccess:missing-data') };
    }

    const meta = isObject((raw as unknown as Record<string, unknown>).meta)
      ? (raw as unknown as Record<string, unknown>).meta as Record<string, unknown>
      : undefined;

    return {
      success:   true,
      data:      raw.data,
      requestId: typeof meta?.requestId === 'string' ? meta.requestId : undefined,
    };
  } catch (err) {
    logApiParsingError({ stage: 'parseBackendSuccess:catch', raw, error: err });
    return { success: false, error: makeFallbackError(500, 'parseBackendSuccess:catch') };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGINATED SUCCESS PARSER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses a raw paginated wire response into `PaginatedApiSuccess<T>`.
 *
 * Structural validation:
 *  - `success === true`
 *  - `data` is an array
 *
 * All `PaginationMeta` fields are extracted defensively — partial backends never crash.
 * Backend `pageSize` → client `limit` (renamed at this boundary, not in UI).
 */
export function parseBackendPaginated<T>(
  raw: RawApiPaginatedSuccess<T> | unknown,
): PaginatedApiSuccess<T> | ApiFailure {
  try {
    if (!isObject(raw)) {
      logApiParsingError({ stage: 'parseBackendPaginated', raw, message: 'Non-object response' });
      return { success: false, error: makeFallbackError(500, 'parseBackendPaginated:non-object') };
    }

    if (raw.success !== true) {
      logApiParsingError({ stage: 'parseBackendPaginated', raw,
        message: 'success flag is not true (R1 violation)' });
      return { success: false, error: makeFallbackError(500, 'parseBackendPaginated:R1') };
    }

    if (!Array.isArray(raw.data)) {
      logApiParsingError({ stage: 'parseBackendPaginated', raw,
        message: 'data is not an array in paginated response (R1 violation)' });
      return { success: false, error: makeFallbackError(500, 'parseBackendPaginated:non-array') };
    }

    const meta = isObject(raw.meta) ? raw.meta : {};

    return {
      success:   true,
      data:      raw.data as T[],
      requestId: typeof meta.requestId === 'string' ? meta.requestId : undefined,
      pagination: {
        total:   typeof meta.total    === 'number'  ? meta.total    : undefined,
        page:    typeof meta.page     === 'number'  ? meta.page     : undefined,
        limit:   typeof meta.pageSize === 'number'  ? meta.pageSize : undefined,
        hasMore: typeof meta.hasMore  === 'boolean' ? meta.hasMore  : undefined,
        // Preserve any extra fields via the index signature on PaginationMeta
        ...Object.fromEntries(
          Object.entries(meta).filter(
            ([k]) => !['requestId', 'timestamp', 'total', 'page', 'pageSize', 'hasMore'].includes(k)
          )
        ),
      },
    };
  } catch (err) {
    logApiParsingError({ stage: 'parseBackendPaginated:catch', raw, error: err });
    return { success: false, error: makeFallbackError(500, 'parseBackendPaginated:catch') };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED PARSER ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Single entry point for parsing any raw backend response body.
 *
 * ⚠️  This function handles BACKEND responses only.
 *    Transport errors (no response, timeout, network failure) must be handled
 *    separately via `normalizeTransportError` in api-client.ts BEFORE calling here.
 *
 * Routing logic:
 *  1. Validate `raw` is a non-null object           → system fallback on failure
 *  2. Check `success` flag via `hasSuccessFlag`     → system fallback if absent
 *  3. success === true  → `parseBackendSuccess`
 *  4. success === false → `parseBackendError`
 *  5. ALWAYS returns `ApiResponse<T>` — never throws
 *
 * @param raw            Raw response body (unknown — safe for any interceptor).
 * @param httpStatus     HTTP status from the transport layer.
 * @param requestContext Optional { url, method } forwarded from api-client for actionable logs.
 *
 * @example
 * // In Axios success interceptor:
 * axiosInstance.interceptors.response.use(
 *   (res) => parseApiResponse(res.data),
 * );
 */
export function parseApiResponse<T>(
  raw: unknown,
  httpStatus?: number,
  requestContext?: { url?: string; method?: string },
): ApiResponse<T> {
  try {
    // ── Guard 1: must be a plain object ──────────────────────────────────
    if (!isObject(raw)) {
      logApiParsingError({
        stage: 'parseApiResponse',
        raw,
        message: [
          'Response body is not a plain object',
          requestContext?.method && requestContext?.url
            ? `[${requestContext.method} ${requestContext.url}]`
            : '',
          `received type: ${raw === null ? 'null' : typeof raw}`,
        ].filter(Boolean).join(' — '),
        ...requestContext,
      });
      return { success: false, error: makeFallbackError(httpStatus, 'parseApiResponse:non-object') };
    }

    // ── Guard 1b: structurally empty object — dev proxy cache collision ───
    // When the Next.js dev server proxy has cached an empty-body response from
    // a fire-and-forget endpoint (e.g. /api/v1/app-entry) and a subsequent
    // conditional GET (If-None-Match) is answered with 304 by the backend, the
    // proxy replays that cached empty body as `{}`. The browser sees a 200 with
    // `{}` — the status-based 304 guard in apiRequest doesn't fire.
    //
    // `{}` is a plain object (passes Guard 1) but has no `success` field. If we
    // fall through to Guard 2, parseApiResponse returns `success: false` with a
    // system-category error. apiRequest then throws that error. fetchUser's catch
    // block sees `err.status === 500` (makeFallbackError default), not 404, so it
    // calls setIsError(true) → AppEntryPage routes to /login → TOKEN_REFRESHED
    // fires → hydrate() → fetchUser() → same {} → setIsError(true) → /login loop.
    //
    // Fix: treat `{}` as a no-content success. apiRequest returns undefined.
    // fetchUser receives undefined as payload → !payload?.user is true → returns
    // null (same as the 404 / no-profile path). AppEntryPage calls getSession()
    // and routes correctly. No error set. No loop.
    //
    // Safety: this guard only fires for objects with ZERO own keys. Any real
    // backend response — success or error — has at least `{ success: boolean }`.
    // This cannot mask genuine contract violations.
    if (Object.keys(raw as object).length === 0) {
      // Do NOT call logApiParsingError — this is a known dev-proxy artefact, not
      // a backend contract violation. Logging would produce "[API PARSING ERROR] {}"
      // noise on every warm page reload in development.
      return { success: true, data: undefined as unknown as T };
    }

    // ── Guard 1c: non-V2 rate-limit shape { error, retryAfter } ────────────────────
    // The backend rate-limiter emits { error: string, retryAfter: number } on 429.
    // This shape has no `success` field and would otherwise fall through to Guard 2,
    // which logs a V2 contract violation and returns a generic 500 system error.
    // That generic error causes fetchUser() to call setIsError(true), sending the
    // user to /login even though they have a valid session.
    //
    // Fix: detect this shape BEFORE Guard 2 and route it through the standard
    // error path with the correct 429 HTTP status. The NestJS Branch 4 handler
    // above covers { statusCode, message } but not this { error, retryAfter } shape.
    if (
      !hasSuccessFlag(raw) &&
      httpStatus === 429 &&
      typeof (raw as Record<string, unknown>).error === 'string'
    ) {
      const ra = (raw as Record<string, unknown>).retryAfter;
      const retryAfter = typeof ra === 'number' && ra > 0 ? ra : undefined;
      return {
        success: false,
        error: new ApiClientError({
          message:    (raw as Record<string, unknown>).error as string || 'Too many requests. Please wait and try again.',
          category:   'rate_limit',
          status:     429,
          retryAfter,
        }),
      };
    }

    // ── Guard 2: must have a boolean `success` field (or tolerated `status`) ──
    if (!hasSuccessFlag(raw)) {
      // CONTRACT VALIDATION: response is missing the required `success` discriminant.
      // This indicates a backend endpoint that does not conform to the V2 contract.
      // Check the endpoint below and ensure it returns { success: boolean, ... }.

      // OBSERVATION: Record malformed response hit for Phase 3 gate monitoring.
      observeMalformedResponse({ stage: 'parseApiResponse:no-success', url: requestContext?.url, raw });

      logApiParsingError({
        stage: 'parseApiResponse',
        raw,
        message: [
          'Response body is missing boolean `success` field (V2 contract violation)',
          requestContext?.method && requestContext?.url
            ? `endpoint: ${requestContext.method} ${requestContext.url}`
            : 'endpoint: unknown',
          `received keys: [${Object.keys(raw as object).join(', ') || 'none'}]`,
        ].join(' | '),
        ...requestContext,
      });
      return { success: false, error: makeFallbackError(httpStatus, 'parseApiResponse:no-success') };
    }

    // ── Route: success ────────────────────────────────────────────────────
    if (raw.success === true && _isSuccessShape(raw)) {
      return parseBackendSuccess(raw as RawApiSuccess<T>) as ApiResponse<T>;
    }

    // ── Route: error ──────────────────────────────────────────────────────
    if (raw.success === false) {
      return {
        success: false,
        error: parseBackendError(raw, httpStatus, requestContext),
      };
    }

    // ── Fallback: success=true but no data key — contract violation ───────
    // CONTRACT VALIDATION: success=true responses MUST include a `data` key (may be null).
    // This endpoint is returning { success: true } without a `data` field — V2 contract R1.
    logApiParsingError({
      stage:   'parseApiResponse',
      raw,
      message: [
        'success=true but data key is absent (V2 contract R1 violation)',
        requestContext?.method && requestContext?.url
          ? `endpoint: ${requestContext.method} ${requestContext.url}`
          : 'endpoint: unknown',
      ].join(' | '),
      ...requestContext,
    });
    return { success: false, error: makeFallbackError(httpStatus, 'parseApiResponse:R1') };

  } catch (err) {
    logApiParsingError({ stage: 'parseApiResponse:catch', raw, error: err, ...requestContext });
    return { success: false, error: makeFallbackError(httpStatus, 'parseApiResponse:catch') };
  }
}