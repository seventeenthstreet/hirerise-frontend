/**
 * @file lib/api/core/api-client.ts
 * @description Axios instance, transport error normalisation, and `apiRequest` wrapper.
 *
 * SEPARATION OF CONCERNS:
 *  - Transport errors (network, timeout, no response) are handled HERE.
 *  - Backend response parsing is delegated to `parseApiResponse` in api-parser.ts.
 *  - Business validation (ensureDataExists) is the caller's responsibility.
 *
 * The `apiRequest<T>` function is the ONLY function feature hooks should call.
 * It always either returns `T` or throws `ApiClientError` — nothing else escapes.
 */

import axios, { type AxiosError, type AxiosInstance, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

import { ApiClientError, _isDev, ensureDataExists, logApiParsingError, logApiTransportError, makeFallbackError } from './api-error';
import { parseApiResponse, parseBackendPaginated } from './api-parser';
import type { ApiRequestConfig, PaginationMeta } from './api-types';
import { getAccessToken } from '@/lib/supabase/client';

// Phase 3.5 — Observability Layer (additive)
import { emitApiRequest, emitApiSuccess, emitApiError, extractTraceId } from '@/lib/observability/apiInstrumentation';

// ─────────────────────────────────────────────────────────────────────────────
// TRANSPORT ERROR NORMALISATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalises Axios / network errors into `ApiClientError`.
 *
 * This function handles errors that occur BEFORE or DURING the HTTP transport:
 *  - No network connection
 *  - DNS failure
 *  - Request timeout
 *  - Request cancelled (AbortSignal / CancelToken)
 *  - Unexpected non-Axios errors
 *
 * It does NOT parse backend response bodies — that is `parseApiResponse`'s job.
 * This clean separation means network failures and backend errors are always
 * distinguishable by `err.category`.
 */
export function normalizeTransportError(error: unknown): ApiClientError {
  // Already an ApiClientError — pass through untouched.
  if (error instanceof ApiClientError) return error;

  if (isAxiosError(error)) {
    // ── Has a response — backend returned an HTTP error body ──────────────
    // This should not normally reach here (interceptor handles it), but acts
    // as a safety net when `normalizeTransportError` is called directly.
    if (error.response) {
      const raw    = error.response.data;
      const status = error.response.status;
      const parsed = parseApiResponse(raw, status);
      if (!parsed.success) return parsed.error;
      // A 4xx/5xx with a parseable success body — treat as server error.
      return makeFallbackError(status, 'normalizeTransportError:unexpected-success-body');
    }

    // ── Request was made but no response received ─────────────────────────
    if (error.request) {
      const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');

      // ── Cancellation guard — MUST come before any logging ────────────────
      // React Query's cancelQueries() triggers AbortController.abort(), which
      // causes Axios to throw a CanceledError (ERR_CANCELED). This is intentional
      // orchestration control flow — NOT an application error. Logging it as a
      // parsing or network error produces misleading observability noise.
      //
      // We detect all three cancellation surfaces:
      //   1. error.code === 'ERR_CANCELED'   — Axios 1.x CanceledError code
      //   2. error.name === 'CanceledError'  — Axios CanceledError class name
      //   3. axios.isCancel(error)           — legacy CancelToken path
      //   4. error.name === 'AbortError'     — native fetch / AbortController
      //   5. error.signal?.aborted           — AbortSignal already-aborted check
      //
      // Return a typed ApiClientError so callers can still distinguish 'cancelled'
      // from 'network' if they need to (e.g. to skip error toasts), but do NOT log.
      const isCancelled =
        error.code === 'ERR_CANCELED' ||
        error.name === 'CanceledError' ||
        error.name === 'AbortError' ||
        axios.isCancel(error) ||
        (error.config?.signal as AbortSignal | undefined)?.aborted === true;

      if (isCancelled) {
        if (_isDev()) {
          // Debug-only trace — silent in production builds.
          console.debug('[API] Request cancelled (expected orchestration):', error.config?.url);
        }
        return new ApiClientError({
          message:  'Request was cancelled.',
          category: 'cancelled',
          status:   0,
        });
      }

      // Only real transport failures (no response, not cancelled) are logged.
      // These are transport lifecycle events — NOT parser violations — so they
      // use logApiTransportError() with accurate labels instead of the misleading
      // [API PARSING ERROR] label.
      logApiTransportError({
        stage:    'normalizeTransportError',
        category: isTimeout ? 'timeout' : 'no-response',
        message:  isTimeout ? 'Request timed out' : 'No response received',
        url:      error.config?.url,
        method:   error.config?.method?.toUpperCase(),
        error,
      });

      return new ApiClientError({
        message:  isTimeout ? 'The request timed out. Please try again.'
                            : 'No response from server. Check your connection.',
        category: 'network',
        status:   0,
      });
    }

    // ── Error during request setup ─────────────────────────────────────────
    // Setup failures are transport events (misconfigured headers, invalid URL),
    // not parser violations. Log with transport label for accurate observability.
    logApiTransportError({
      stage:    'normalizeTransportError:setup',
      category: 'setup-failure',
      message:  error.message ?? 'Request setup failed',
      url:      error.config?.url,
      method:   error.config?.method?.toUpperCase(),
      error,
    });

    return new ApiClientError({
      message:  'Failed to send request.',
      category: 'network',
      status:   0,
    });
  }

  // ── Unknown / non-Axios error ────────────────────────────────────────────
  // A non-Axios error escaping the pipeline is a transport anomaly (unexpected
  // throw from Axios internals, middleware, or interceptors) — not a parser
  // violation. Log with transport label so it is distinguishable in dev tools.
  logApiTransportError({
    stage:    'normalizeTransportError:unknown',
    category: 'unknown',
    message:  'Non-Axios error escaped request pipeline',
    error,
  });

  return new ApiClientError({
    message:  'An unexpected error occurred.',
    category: 'system',
    status:   500,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// AXIOS INSTANCE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shared Axios instance.
 *
 * Configuration:
 *  - `validateStatus: () => true` — never throw on HTTP status codes.
 *    All status-based error handling happens in `apiRequest`, not Axios.
 *    This gives us full control over the response pipeline.
 *  - `timeout: 15_000` — 15 s default. Override per-request via `config.signal`.
 */
// ── CORS FIX — relative baseURL for browser requests ─────────────────────────
//
// ROOT CAUSE: process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:3001"
// is an ABSOLUTE URL. Axios sends it directly from the browser's origin
// (http://localhost:3000) to the backend (http://localhost:3001) — different
// ports = cross-origin request → browser enforces CORS. If the backend port
// doesn't match exactly, the browser gets a connection-refused error and
// reports it as a CORS failure in the Network tab.
//
// FIX: Use empty string as baseURL so all browser Axios requests become
// relative paths (e.g. "/api/v1/users/me"). Relative paths go to the
// Next.js dev server at localhost:3000 — SAME origin — so the browser
// never performs a CORS preflight. next.config.js rewrites all /api/v1/*
// paths to the backend transparently.
//
// SERVER-SIDE (Next.js Route Handlers / SSR):
//   `typeof window === 'undefined'` — must use an absolute URL because
//   Next.js server-side code doesn't benefit from the proxy rewrite.
//   API_BASE_URL (server-only) is preferred; falls back to NEXT_PUBLIC_.
//
// PRODUCTION:
//   Behind a reverse proxy (Nginx, Cloud Run, Vercel), relative paths
//   route to the same host and are forwarded to the backend. If frontend
//   and backend are on separate domains, set API_BASE_URL server-side and
//   ensure CORS ALLOWED_ORIGINS includes the frontend domain.
export const axiosInstance: AxiosInstance = axios.create({
  baseURL: typeof window === 'undefined'
    // Server-side: Next.js Route Handlers need a direct absolute URL.
    ? (process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? '')
    // Browser: relative path → Next.js proxy → backend. No CORS, no port coupling.
    : '',
  timeout:        15_000,
  withCredentials: true,
  validateStatus: () => true, // Never let Axios throw on HTTP status — we handle it
  headers: {
    'Content-Type': 'application/json',
    Accept:         'application/json',
  },
});

// ── FIX 4 — Phase 1 Auth Stabilization: DEV-ONLY missing Authorization header warning ──
// Logs a console.warn when a request leaves without an Authorization header.
// This is a development-only diagnostic tool — it does NOT block the request,
// log tokens, or produce any output in production builds.
//
// INTERCEPTOR ORDER FIX: Axios runs request interceptors in LIFO order (last
// registered = first to run). This diagnostic interceptor was previously
// registered AFTER the auth-token interceptor, so it ran BEFORE the token was
// attached — producing false "Missing Authorization header" warnings on every
// request, including those that would have had a token attached correctly.
//
// Fix: register this interceptor BEFORE the auth interceptor (i.e. move it
// above that block in source order) so it runs AFTER auth attachment in the
// LIFO execution order. The auth interceptor (registered later = runs first)
// attaches the token, then this diagnostic interceptor (registered earlier =
// runs second) checks for its presence. Warnings now only fire for requests
// that genuinely have no token after the auth interceptor has run.
//
// NOTE: This block is intentionally placed BEFORE the auth interceptor
// registration below. Do not reorder these two blocks.
if (process.env.NODE_ENV === 'development') {
  axiosInstance.interceptors.request.use((config) => {
    if (!config.headers?.['Authorization']) {
      console.warn(
        '[API] Missing Authorization header:',
        config.url,
      );
    }
    return config;
  });
}

// ── Request interceptor: attach Supabase auth token ─────────────────────────
axiosInstance.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  // If the caller already set an Authorization header (e.g. fetchUser passing
  // a known session token directly), preserve it — don't overwrite with a
  // potentially-stale getAccessToken() result.
  if (config.headers?.['Authorization']) {
    return config;
  }

  // Fetch the current Supabase session token (cached; auto-refreshed by Supabase).
  // getAccessToken() is the ONLY token source for requests that don't pass one explicitly.
  try {
    const token = await getAccessToken();
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // Never block the request — auth failure surfaces as a 401 from the backend
  }
  return config;
});

// ── Response interceptor: transparent pass-through ───────────────────────
// We use validateStatus: () => true so ALL responses reach `apiRequest`.
// This interceptor is a no-op; it exists as a hook point for future needs
// (e.g. response logging, metric collection).
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: unknown) => {
    // Only genuine transport failures reach here (DNS, abort, timeout).
    // HTTP error responses are passed through by validateStatus.
    throw normalizeTransportError(error);
  },
);



// ─────────────────────────────────────────────────────────────────────────────
// API REQUEST WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for `apiRequest` / `apiRequestWithMeta`.
 *
 * @property requireData  When `true`, throws `ApiClientError(category: 'system')` if
 *                        the parsed `data` field is `null` or `undefined`.
 *                        Default: `false` (null is allowed — caller must validate).
 *                        Use for endpoints where a missing data payload is always a bug.
 */
export type ApiRequestOptions = {
  requireData?: boolean;
  /**
   * Phase 3.5 — Observability: optional metadata bag.
   * Callers may pass `{ traceId: string }` here to correlate API events with
   * the initiating user action. Mirrors the React Query `meta` convention.
   */
  meta?: Record<string, unknown>;
};

/**
 * Primary API request function.
 *
 * Rules:
 *  ✅  Always returns typed data `T` on success.
 *  ✅  Always throws `ApiClientError` on failure — nothing else escapes.
 *  ✅  Never returns the raw Axios response.
 *  ✅  Never exposes backend field names to callers.
 *  ✅  Transport errors and backend errors are separately classified.
 *  ✅  Pass `options.requireData: true` to guard against silent null-data bugs.
 *
 * @example
 * // Feature hook usage:
 * const user = await apiRequest<User>({ url: '/me', method: 'GET' });
 *
 * @example
 * // Enforce data existence at the transport boundary (prevents silent null bugs):
 * const resume = await apiRequest<Resume>(
 *   { url: '/resume/123', method: 'GET' },
 *   { requireData: true },
 * );
 *
 * @example
 * // With error handling:
 * try {
 *   const resume = await apiRequest<Resume>({ url: '/resume/123', method: 'GET' });
 *   setResume(resume);
 * } catch (err) {
 *   if (isApiClientError(err)) {
 *     switch (err.category) {
 *       case 'auth':      redirectToLogin(); break;
 *       case 'not_found': show404(); break;
 *       default:          showToast(err.message);
 *     }
 *   }
 * }
 */
export async function apiRequest<T>(
  config: ApiRequestConfig,
  options?: ApiRequestOptions,
): Promise<T> {
  let response: AxiosResponse;

  // Phase 3.5 — Observability: extract traceId from React Query meta or options
  const traceId = extractTraceId(options?.meta as Record<string, unknown> | undefined);

  try {
    // Phase 3.5 — Observability: emit request start
    emitApiRequest(config.url, traceId, { method: config.method ?? 'GET' });

    response = await axiosInstance.request<unknown>({
      method:  config.method ?? 'GET',
      url:     config.url,
      data:    config.data,
      params:  config.params,
      headers: config.headers,
      signal:  config.signal,
    });
  } catch (err) {
    // Phase 3.5 — Observability: emit transport error (but NOT for intentional cancellations)
    // Cancellations are orchestration control flow — emitting them as errors produces
    // misleading dashboards. The isCancelledError check works because normalizeTransportError
    // (called by the Axios response interceptor) has already wrapped the CanceledError into
    // an ApiClientError(category: 'cancelled') before this catch runs.
    const isCancelled = err instanceof ApiClientError && err.isCancelledError;
    if (!isCancelled) {
      emitApiError(config.url, err, traceId, { method: config.method ?? 'GET' });
    }
    if (err instanceof ApiClientError) throw err;
    throw normalizeTransportError(err);
  }

  // ── Guard: 204 / 304 / empty body — skip JSON parsing entirely ───────────
  // Axios with `validateStatus: () => true` sets response.data to '' or null
  // for 204 No Content. For 304 Not Modified, Axios behaviour depends on the
  // HTTP cache: if the browser's HTTP cache replays the prior response, Axios
  // re-parses that cached body and response.data ends up as the PREVIOUS
  // response object — non-empty, but stale. parseApiResponse then receives a
  // structurally valid (or subtly stale) object and may fail validation.
  //
  // Fix: check HTTP STATUS first, in its own branch, BEFORE inspecting
  // response.data. A 304 is always a "no new content" response regardless of
  // what Axios put in response.data. The data guard below handles 204 and the
  // unusual case where response.data is empty for other reasons.
  //
  // Return `undefined` (not `null`) so that:
  //  - apiRequest<void> callers (DELETE, side-effect endpoints) receive undefined,
  //    which is the correct JS representation of void.
  //  - React Query stores undefined in query.data, which all consumers already
  //    handle via `?? null` guards — no downstream crash risk.
  const status = response.status;

  if (status === 204 || status === 304) {
    // Phase 3.5 — Observability: emit success for no-content / not-modified responses
    emitApiSuccess(config.url, traceId, { status, requestId: undefined });
    return undefined as unknown as T;
  }

  if (
    response.data === '' ||
    response.data === null ||
    response.data === undefined
  ) {
    // Phase 3.5 — Observability: emit success for empty-body responses
    emitApiSuccess(config.url, traceId, { status, requestId: undefined });
    return undefined as unknown as T;
  }

  // ── Guard: unexpected transport payload type ──────────────────────────────
  // With Axios's default responseType: 'json', valid JSON is auto-parsed into
  // a plain object or array BEFORE this code runs. Anything that isn't a plain
  // object or array at this point is a transport anomaly.
  //
  // isPlainObject() uses Object.prototype.toString + prototype-chain checks to
  // distinguish true JSON objects from exotic types that share typeof === 'object':
  // Blob, File, Date, Map, Set, ArrayBuffer, Uint8Array, FormData, Response, etc.
  //
  // Arrays ARE valid — backend paginated responses return arrays directly.
  // Plain objects ARE valid — standard { success, data } envelope.
  const isJsonLike = isPlainObject(response.data) || Array.isArray(response.data);

  if (!isJsonLike) {
    // Payload is a string or an unexpected type.
    const ct = String(
      response.headers?.['content-type'] ??
      response.headers?.['Content-Type'] ??
      ''
    );
    logApiParsingError({
      stage:   'apiRequest:invalid-payload-type',
      message: `Transport payload is not a JSON object or array (content-type: ${ct || 'missing'}, typeof: ${typeof response.data})`,
      url:     config.url,
      method:  config.method ?? 'GET',
      // Pass raw through sanitizeForLog — it's defined in api-error.ts and
      // strips tokens, JWTs, emails before the value reaches the console.
      raw:     typeof response.data === 'string' ? response.data : String(response.data),
    });
    emitApiError(config.url, new Error('Invalid transport payload'), traceId, { status });
    throw new ApiClientError({
      message:  'Server returned an unexpected response format.',
      category: 'server',
      status:   status >= 400 ? status : 502,
    });
  }

  // ── Parse backend response body (with request context for actionable logs) ──
  const requestContext = { url: config.url, method: config.method ?? 'GET' };
  const parsed = parseApiResponse<T>(response.data, response.status, requestContext);

  if (parsed.success) {
    if (_isDev()) {
      console.debug('[API]', config.method ?? 'GET', config.url, '→ OK', {
        requestId: parsed.requestId,
        status:    response.status,
      });
    }

    // Phase 3.5 — Observability: emit success
    emitApiSuccess(config.url, traceId, { status: response.status, requestId: parsed.requestId });

    // Change 2: requireData guard — throws before caller receives null data.
    if (options?.requireData) {
      return ensureDataExists(parsed);
    }

    return parsed.data;
  }

  if (_isDev()) {
    // parsed.error is always ApiClientError (has .toJSON()), but guard defensively
    // in case an unexpected plain-object leaks through the parser boundary.
    //
    // WHY JSON.parse(JSON.stringify(...)): ApiClientError is a class instance.
    // DevTools renders class instances lazily — in a collapsed console.error
    // group the inspector shows {} because it evaluates properties at expand time,
    // not at log time. The non-enumerable fields inherited from Error are invisible
    // to object spread. JSON.parse(JSON.stringify(obj)) forces a fully enumerable
    // plain-object snapshot — DevTools always renders it correctly in the header.
    const _errLog = typeof (parsed.error as { toJSON?: unknown }).toJSON === 'function'
      ? JSON.parse(JSON.stringify((parsed.error as ApiClientError).toJSON()))
      : { message: (parsed.error as { message?: string }).message ?? String(parsed.error) };

    // Task 7 — Logging severity normalization:
    // 429 rate_limit responses are legitimate backend signals, not application errors.
    // Logging them as console.error produces false operational panic in dev tools.
    // Parser violations and auth/server failures remain console.error (high-signal).
    // Rate-limit events downgrade to console.warn so they are visible but not alarming.
    if (parsed.error instanceof ApiClientError && parsed.error.isRateLimit) {
      console.warn('[API RATE LIMITED]', config.method ?? 'GET', config.url, '→ 429', _errLog);
    } else {
      console.error('[API]', config.method ?? 'GET', config.url, '→ ERROR', _errLog);
    }
  }

  // Phase 3.5 — Observability: emit API error (parsed backend error)
  emitApiError(config.url, parsed.error, traceId, { status: response.status });

  throw parsed.error;
}

/**
 * Variant of `apiRequest` that preserves pagination metadata.
 *
 * Use for list endpoints that return `meta.total / page / hasMore`.
 * Regular `apiRequest` silently drops pagination meta; this function
 * surfaces it without requiring a schema change or new abstraction layer.
 *
 * Returns `{ data: T, meta?: PaginationMeta }`.
 *
 * @example
 * // Infinite scroll / dashboard:
 * const { data: jobs, meta } = await apiRequestWithMeta<Job[]>(
 *   { url: '/jobs', method: 'GET', params: { page: 2 } },
 * );
 * if (meta?.hasMore) fetchNextPage(meta.page! + 1);
 */
export async function apiRequestWithMeta<T>(
  config: ApiRequestConfig,
  options?: ApiRequestOptions,
): Promise<{ data: T; meta?: PaginationMeta }> {
  let response: AxiosResponse;

  try {
    response = await axiosInstance.request<unknown>({
      method:  config.method ?? 'GET',
      url:     config.url,
      data:    config.data,
      params:  config.params,
      headers: config.headers,
      signal:  config.signal,
    });
  } catch (err) {
    if (err instanceof ApiClientError) throw err;
    throw normalizeTransportError(err);
  }

  const requestContext = { url: config.url, method: config.method ?? 'GET' };

  // ── Guard: 204 / 304 / empty body — skip JSON parsing entirely ───────────
  // See the equivalent guard in apiRequest for the full explanation of the
  // Axios HTTP-cache 304 body-replay quirk. Status is checked FIRST.
  const wMStatus = response.status;

  if (wMStatus === 204 || wMStatus === 304) {
    // Return undefined — no content, no pagination metadata.
    return { data: undefined as unknown as T };
  }

  if (
    response.data === '' ||
    response.data === null ||
    response.data === undefined
  ) {
    // Return undefined (not null) — consistent with apiRequest empty-body contract.
    // apiRequestWithMeta callers use meta for paginated endpoints; a 204/304
    // means no content and no pagination metadata either.
    return { data: undefined as unknown as T };
  }

  // ── Guard: structurally empty object — see equivalent guard in apiRequest ──
  if (isPlainObject(response.data) && Object.keys(response.data).length === 0) {
    return { data: undefined as unknown as T };
  }

  // Try paginated shape first — carries meta.
  const paginated = parseBackendPaginated<T extends (infer U)[] ? U : T>(
    response.data,
  );

  if (paginated.success) {
    if (_isDev()) {
      console.debug('[API]', config.method ?? 'GET', config.url, '→ OK (paginated)', {
        requestId: paginated.requestId,
        status:    response.status,
      });
    }
    const data = paginated.data as unknown as T;
    if (options?.requireData) ensureDataExists({ success: true, data });
    return { data, meta: paginated.pagination };
  }

  // Fall back to standard parse — still return meta as undefined.
  const parsed = parseApiResponse<T>(response.data, response.status, requestContext);

  if (parsed.success) {
    if (_isDev()) {
      console.debug('[API]', config.method ?? 'GET', config.url, '→ OK', {
        requestId: parsed.requestId,
        status:    response.status,
      });
    }
    if (options?.requireData) return { data: ensureDataExists(parsed) };
    return { data: parsed.data };
  }

  if (_isDev()) {
    // parsed.error is always ApiClientError (has .toJSON()), but guard defensively
    // in case an unexpected plain-object leaks through the parser boundary.
    //
    // WHY JSON.parse(JSON.stringify(...)): see the same comment in apiRequest above.
    const _errLog = typeof (parsed.error as { toJSON?: unknown }).toJSON === 'function'
      ? JSON.parse(JSON.stringify((parsed.error as ApiClientError).toJSON()))
      : { message: (parsed.error as { message?: string }).message ?? String(parsed.error) };

    // Task 7 — Logging severity normalization:
    // 429 rate_limit responses are legitimate backend signals, not application errors.
    // Logging them as console.error produces false operational panic in dev tools.
    // Parser violations and auth/server failures remain console.error (high-signal).
    // Rate-limit events downgrade to console.warn so they are visible but not alarming.
    if (parsed.error instanceof ApiClientError && parsed.error.isRateLimit) {
      console.warn('[API RATE LIMITED]', config.method ?? 'GET', config.url, '→ 429', _errLog);
    } else {
      console.error('[API]', config.method ?? 'GET', config.url, '→ ERROR', _errLog);
    }
  }

  throw parsed.error;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function isAxiosError(err: unknown): err is AxiosError {
  // isAxiosError deliberately uses a loose object check — AxiosError is a class
  // instance (inherits from Error), so it intentionally fails the strict
  // isPlainObject test. We only need to confirm it's a non-null object with
  // the Axios sentinel property.
  return (
    err !== null &&
    typeof err === 'object' &&
    (err as Record<string, unknown>).isAxiosError === true
  );
}

/**
 * True plain-object detection for transport payload validation.
 *
 * A "plain object" is one created by `{}`, `Object.create(null)`, or
 * `Object.create(Object.prototype)` — the direct product of JSON.parse().
 *
 * This intentionally rejects all exotic object types that share `typeof === 'object'`
 * but are NOT valid JSON object payloads:
 *
 *   Object.prototype.toString result → rejected types
 *   '[object Blob]'        → Blob
 *   '[object File]'        → File
 *   '[object Date]'        → Date
 *   '[object Map]'         → Map
 *   '[object Set]'         → Set
 *   '[object ArrayBuffer]' → ArrayBuffer
 *   '[object Uint8Array]'  → Uint8Array (and all TypedArrays)
 *   '[object FormData]'    → FormData
 *   '[object Response]'    → fetch Response
 *   '[object Error]'       → Error / ApiClientError
 *   '[object Foo]'         → any custom class instance
 *
 * Only '[object Object]' with a prototype of Object.prototype or null passes.
 * Arrays are excluded here — check separately via Array.isArray().
 *
 * WHY BOTH CHECKS:
 *  toString alone is spoofable via Symbol.toStringTag. The prototype check is the
 *  authoritative one for class instances. Combining both eliminates false positives
 *  from tagged primitives and false negatives from objects with custom toString tags.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (Object.prototype.toString.call(value) !== '[object Object]') {
    return false;
  }
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL TYPE AUGMENTATION  (minimal — only what this file touches)
// ─────────────────────────────────────────────────────────────────────────────