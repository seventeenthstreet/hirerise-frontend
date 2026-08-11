/**
 * @file lib/api/core/api-error.ts
 * @description ApiClientError class, BackendErrorCode registry, and error helpers.
 *
 * This file owns:
 *  - BackendErrorCode  (stable code registry — internal / logging use only)
 *  - ERROR_CODE_TO_HTTP_STATUS (canonical HTTP status map)
 *  - mapErrorCodeToCategory (code → UI category)
 *  - ApiClientError (runtime error class — the ONLY error shape UI receives)
 *  - ensureDataExists (business-layer helper — separate from parsing)
 *  - logApiParsingError (observability hook)
 */

// Imports from api-error-types.ts (not api-types.ts) to break the circular
// type dependency: api-error.ts ↔ api-types.ts detected by madge.
// api-error-types.ts is a neutral primitives file that neither api-error.ts
// nor api-types.ts depends on — cycle eliminated.
import type { ApiSuccess, ErrorCategory } from './api-error-types';

// ─────────────────────────────────────────────────────────────────────────────
// BACKEND ERROR CODE REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stable error code registry.
 *
 * STABILITY CONTRACT: Never rename or delete. Add new values; deprecate old ones.
 *
 * ⚠️  UI RULE: Never branch on these values in components.
 *    Always use `ErrorCategory` via `err.category`.
 */
export const BackendErrorCode = {
  // AUTH
  UNAUTHORIZED:                   'UNAUTHORIZED',
  TOKEN_EXPIRED:                  'TOKEN_EXPIRED',
  FORBIDDEN:                      'FORBIDDEN',
  // VALIDATION
  VALIDATION_ERROR:               'VALIDATION_ERROR',
  INVALID_INPUT:                  'INVALID_INPUT',
  // RESUME
  RESUME_NOT_FOUND:               'RESUME_NOT_FOUND',
  NO_FILE:                        'NO_FILE',
  NOT_A_CV:                       'NOT_A_CV',
  PROCESSING_FAILED:              'PROCESSING_FAILED',
  // ONBOARDING
  ONBOARDING_STEP_INVALID:        'ONBOARDING_STEP_INVALID',
  QUALIFICATION_INVALID:          'QUALIFICATION_INVALID',
  // RESOURCE
  NOT_FOUND:                      'NOT_FOUND',
  CONFLICT:                       'CONFLICT',
  // RATE LIMIT
  RATE_LIMITED:                   'RATE_LIMITED',
  /** @deprecated Use RATE_LIMITED. */
  RATE_LIMIT_EXCEEDED:            'RATE_LIMIT_EXCEEDED',
  PENDING_JOB_LIMIT_EXCEEDED:     'PENDING_JOB_LIMIT_EXCEEDED',
  // TIER / PLAN
  TIER_INSUFFICIENT:              'TIER_INSUFFICIENT',
  PLAN_UPGRADE_REQUIRED:          'PLAN_UPGRADE_REQUIRED',
  DAILY_AI_COST_LIMIT_EXCEEDED:   'DAILY_AI_COST_LIMIT_EXCEEDED',
  // SYSTEM
  INTERNAL_ERROR:                 'INTERNAL_ERROR',
  EXTERNAL_SERVICE_ERROR:         'EXTERNAL_SERVICE_ERROR',
  RATE_LIMIT_SERVICE_UNAVAILABLE: 'RATE_LIMIT_SERVICE_UNAVAILABLE',
  // PERMISSION ADMINISTRATION (WP-ADMIN-04F-09) — additive only. Mirrors
  // the `.code` strings the certified domain layers actually throw
  // (src/domain/permission/**/*.errors.js) and the manual 'PERMISSION_NOT_FOUND'
  // 404 sent by permissionRegistry.controller.js's notFound() helper.
  // Without these entries every Permission Administration error would
  // fall through mapErrorCodeToCategory's default and be miscategorized
  // as 'system' regardless of its real HTTP status (see that function's
  // `if (category === 'system' && !code)` guard — it only re-derives
  // from status when `code` is ABSENT, and every one of these errors
  // does carry a `code`).
  PERMISSION_NOT_FOUND:                        'PERMISSION_NOT_FOUND',
  PERMISSION_REGISTRY_VALIDATION_ERROR:        'PERMISSION_REGISTRY_VALIDATION_ERROR',
  PERMISSION_REGISTRY_DUPLICATE_IDENTITY:      'PERMISSION_REGISTRY_DUPLICATE_IDENTITY',
  PERMISSION_REGISTRY_MALFORMED_ENTRY:         'PERMISSION_REGISTRY_MALFORMED_ENTRY',
  ASSIGNMENT_INVALID_REQUEST:                  'ASSIGNMENT_INVALID_REQUEST',
  ASSIGNMENT_PERMISSION_NOT_ASSIGNABLE:        'ASSIGNMENT_PERMISSION_NOT_ASSIGNABLE',
  ASSIGNMENT_DUPLICATE:                        'ASSIGNMENT_DUPLICATE',
  ASSIGNMENT_NOT_FOUND:                        'ASSIGNMENT_NOT_FOUND',
  EVALUATION_PERMISSION_NOT_FOUND:             'EVALUATION_PERMISSION_NOT_FOUND',
  EVALUATION_PERMISSION_NOT_EVALUABLE:         'EVALUATION_PERMISSION_NOT_EVALUABLE',
  EVALUATION_CONTEXT_ERROR:                    'EVALUATION_CONTEXT_ERROR',
  EVALUATION_UNSUPPORTED_REQUEST:              'EVALUATION_UNSUPPORTED_REQUEST',
  PERMISSION_INVALID_RESOURCE:                 'PERMISSION_INVALID_RESOURCE',
  PERMISSION_INVALID_ACTION:                   'PERMISSION_INVALID_ACTION',
  PERMISSION_INVALID_CATEGORY:                 'PERMISSION_INVALID_CATEGORY',
  PERMISSION_INVALID_STATUS:                   'PERMISSION_INVALID_STATUS',
  PERMISSION_INVALID_AUTHORIZATION_CONTEXT:    'PERMISSION_INVALID_AUTHORIZATION_CONTEXT',
  PERMISSION_INVALID_PERMISSION:               'PERMISSION_INVALID_PERMISSION',
} as const;

export type BackendErrorCode = (typeof BackendErrorCode)[keyof typeof BackendErrorCode];

// ─────────────────────────────────────────────────────────────────────────────
// HTTP STATUS MAP  (R5)
// ─────────────────────────────────────────────────────────────────────────────

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
  // PERMISSION ADMINISTRATION (WP-ADMIN-04F-09) — statuses mirror
  // permissionAdmin.errorMap.js's ERROR_STATUS_BY_NAME exactly (keyed
  // there by error.name; keyed here by the same error's wire .code).
  [BackendErrorCode.PERMISSION_NOT_FOUND]:                     404,
  [BackendErrorCode.PERMISSION_REGISTRY_VALIDATION_ERROR]:     400,
  [BackendErrorCode.PERMISSION_REGISTRY_DUPLICATE_IDENTITY]:   409,
  [BackendErrorCode.PERMISSION_REGISTRY_MALFORMED_ENTRY]:      422,
  [BackendErrorCode.ASSIGNMENT_INVALID_REQUEST]:               400,
  [BackendErrorCode.ASSIGNMENT_PERMISSION_NOT_ASSIGNABLE]:     422,
  [BackendErrorCode.ASSIGNMENT_DUPLICATE]:                     409,
  [BackendErrorCode.ASSIGNMENT_NOT_FOUND]:                     404,
  [BackendErrorCode.EVALUATION_PERMISSION_NOT_FOUND]:          404,
  [BackendErrorCode.EVALUATION_PERMISSION_NOT_EVALUABLE]:      422,
  [BackendErrorCode.EVALUATION_CONTEXT_ERROR]:                 400,
  [BackendErrorCode.EVALUATION_UNSUPPORTED_REQUEST]:           400,
  [BackendErrorCode.PERMISSION_INVALID_RESOURCE]:              400,
  [BackendErrorCode.PERMISSION_INVALID_ACTION]:                400,
  [BackendErrorCode.PERMISSION_INVALID_CATEGORY]:              400,
  [BackendErrorCode.PERMISSION_INVALID_STATUS]:                400,
  [BackendErrorCode.PERMISSION_INVALID_AUTHORIZATION_CONTEXT]: 400,
  [BackendErrorCode.PERMISSION_INVALID_PERMISSION]:            400,
};

// ─────────────────────────────────────────────────────────────────────────────
// ERROR CODE → CATEGORY MAP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps a raw backend error code to a stable UI `ErrorCategory`.
 * Returns `'system'` for any unrecognised code — never 'unknown' — so new
 * backend codes always degrade to a safe, actionable UI state.
 */
export function mapErrorCodeToCategory(code: string | undefined): ErrorCategory {
  if (!code) return 'system';

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

    // PERMISSION ADMINISTRATION (WP-ADMIN-04F-09)
    case BackendErrorCode.PERMISSION_NOT_FOUND:
    case BackendErrorCode.ASSIGNMENT_NOT_FOUND:
    case BackendErrorCode.EVALUATION_PERMISSION_NOT_FOUND:
      return 'not_found';

    case BackendErrorCode.PERMISSION_REGISTRY_DUPLICATE_IDENTITY:
    case BackendErrorCode.ASSIGNMENT_DUPLICATE:
      return 'conflict';

    case BackendErrorCode.PERMISSION_REGISTRY_VALIDATION_ERROR:
    case BackendErrorCode.PERMISSION_REGISTRY_MALFORMED_ENTRY:
    case BackendErrorCode.ASSIGNMENT_INVALID_REQUEST:
    case BackendErrorCode.ASSIGNMENT_PERMISSION_NOT_ASSIGNABLE:
    case BackendErrorCode.EVALUATION_PERMISSION_NOT_EVALUABLE:
    case BackendErrorCode.EVALUATION_CONTEXT_ERROR:
    case BackendErrorCode.EVALUATION_UNSUPPORTED_REQUEST:
    case BackendErrorCode.PERMISSION_INVALID_RESOURCE:
    case BackendErrorCode.PERMISSION_INVALID_ACTION:
    case BackendErrorCode.PERMISSION_INVALID_CATEGORY:
    case BackendErrorCode.PERMISSION_INVALID_STATUS:
    case BackendErrorCode.PERMISSION_INVALID_AUTHORIZATION_CONTEXT:
    case BackendErrorCode.PERMISSION_INVALID_PERMISSION:
      return 'validation';

    default:
      return 'system';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OBSERVABILITY HOOK
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// RAW PAYLOAD SANITIZER  (used by logApiParsingError only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sanitizes a raw API payload string before it reaches any log output.
 *
 * Protects against accidental exposure of:
 *  - Bearer tokens / JWTs (Authorization header values echoed in error bodies)
 *  - Supabase / API keys (long alphanumeric tokens)
 *  - Email addresses (PII)
 *  - Cookie header values
 *  - Generic secrets in key=value form
 *
 * Also truncates large payloads (e.g. full HTML error pages) so logs remain
 * readable. 300 chars gives enough context to identify the response type
 * (HTML doctype, JSON fragment, plain-text error) without leaking full content.
 *
 * This function is intentionally conservative — it may redact non-sensitive
 * values that match the patterns (e.g. a long random string in a role name).
 * That is acceptable: observability completeness is subordinate to data safety.
 *
 * NEVER log raw API payloads without passing them through this function first.
 */
function sanitizeForLog(raw: unknown): unknown {
  if (typeof raw !== 'string') {
    // Non-strings (objects, arrays) are passed directly to logApiParsingError
    // as structured data. They cannot contain inline tokens in a way that this
    // function could safely redact without risk of false positives on legitimate
    // field names. Object payloads are truncated at the JSON.stringify level.
    if (raw !== null && typeof raw === 'object') {
      try {
        const str = JSON.stringify(raw);
        // Recursively sanitize the JSON representation
        return JSON.parse(sanitizeForLog(str) as string);
      } catch {
        return '[non-serializable object]';
      }
    }
    return raw;
  }

  let s = raw;

  // 1. Redact Bearer tokens (JWT or opaque)
  //    Matches: "Bearer eyJ...", "bearer abc123..."
  s = s.replace(/\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]');

  // 2. Redact JWT segments (three base64url segments separated by dots)
  //    Matches any eyJ... token even without "Bearer" prefix
  s = s.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, '[JWT REDACTED]');

  // 3. Redact email addresses (RFC 5322 simplified)
  s = s.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL REDACTED]');

  // 4. Redact common secret key patterns in key=value or "key":"value" JSON forms
  //    Covers: apikey, api_key, secret, password, token, access_token, refresh_token
  s = s.replace(
    /(["']?(?:api[_-]?key|secret|password|access[_-]?token|refresh[_-]?token|authorization|auth[_-]?token)["']?\s*[:=]\s*["']?)[^\s"'&,}\]]{8,}/gi,
    '$1[REDACTED]',
  );

  // 5. Truncate — after redaction so truncation never cuts mid-token
  const MAX_CHARS = 300;
  if (s.length > MAX_CHARS) {
    s = `${s.slice(0, MAX_CHARS)}… [truncated ${s.length - MAX_CHARS} chars]`;
  }

  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// OBSERVABILITY HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Centralised logging hook for all API parsing anomalies.
 *
 * Called by parsers when:
 *  - a contract violation is detected
 *  - an unexpected error shape is encountered
 *  - a try/catch fallback is triggered
 *
 * `url` and `method` are passed from api-client.ts to make production logs
 * actionable — you can immediately identify which endpoint drifted.
 *
 * In production this is `console.error` — swap the body to forward to your
 * observability platform (Sentry, Datadog, etc.) without changing call sites.
 *
 * All `raw` values are passed through `sanitizeForLog()` before output.
 * This prevents JWTs, tokens, emails, and other PII from appearing in logs.
 */
export function logApiParsingError(context: {
   
  stage: string;
  raw?: unknown;
  error?: unknown;
  message?: string;
  /** Request URL — passed from api-client for production traceability. */
  url?: string;
  /** HTTP method — passed from api-client for production traceability. */
  method?: string;
}): void {
  if (_isDev()) {
    // Error objects have non-enumerable properties (.message, .stack) that
    // console.error({ error }) renders as {} in structured logging contexts.
    // Explicitly extract message + stack so the log is always actionable.
    const errorDetail = context.error instanceof Error
      ? { errorMessage: context.error.message, stack: context.error.stack }
      : context.error !== undefined
        ? { errorValue: context.error }
        : undefined;

    // Sanitize raw payload — redact tokens/PII, truncate large bodies.
    // IMPORTANT: always sanitize before logging; never log raw response bodies directly.
    const rawDetail = context.raw !== undefined
      ? sanitizeForLog(context.raw)
      : undefined;

    // Log each field as a separate console.error argument so DevTools renders
    // them inline regardless of console grouping context. A single object
    // argument always shows {} in collapsed groups; individual string/value
    // arguments always render immediately.
    try {
      const parts: unknown[] = [
        '[API PARSING ERROR]',
        `stage=${context.stage}`,
        context.message ?? 'Unexpected error during API response parsing',
      ];
      if (context.url)    parts.push(`url=${context.url}`);
      if (context.method) parts.push(`method=${context.method}`);
      if (rawDetail !== undefined) parts.push('raw=', rawDetail);
      if (errorDetail)             parts.push('error=', errorDetail);
      console.error(...parts);
    } catch {
      console.error('[API PARSING ERROR]', context.stage, context.message);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSPORT ERROR OBSERVABILITY
//
// Transport events (no response, timeout, request setup failure, unknown errors
// that escape the pipeline) are DISTINCT from parser violations.
//
// These are transport lifecycle events — NOT malformed backend JSON. Logging
// them via logApiParsingError() produces misleading [API PARSING ERROR] labels
// that conflate two separate failure domains.
//
// logApiTransportError() uses console.warn (not console.error) because:
//   - Timeout / no-response during hydration is often benign (dev restart,
//     StrictMode double-render, race cancellation).
//   - These events are operationally actionable but not parser violations.
//   - Keeping them at warn-level preserves error log signal-to-noise ratio.
//
// Transport categories surfaced here:
//   'no-response'   — request reached the network but no HTTP response arrived
//   'timeout'       — ECONNABORTED or message contains 'timeout'
//   'setup-failure' — error thrown during Axios request configuration
//   'unknown'       — non-Axios error that escaped the request pipeline
// ─────────────────────────────────────────────────────────────────────────────

export type TransportErrorCategory =
  | 'no-response'
  | 'timeout'
  | 'setup-failure'
  | 'unknown';

/**
 * Logs a transport-layer observability event.
 *
 * IMPORTANT: Do NOT use this for parser violations (malformed JSON, legacy shape,
 * no-success payloads). Those must continue to use logApiParsingError() so the
 * [API PARSING ERROR] signal remains high-fidelity.
 *
 * Transport events use [API TRANSPORT WARNING] / [API TIMEOUT] / [API NO RESPONSE]
 * labels so they are easily distinguishable from parser governance events in logs.
 */
export function logApiTransportError(context: {
  stage: string;
  category: TransportErrorCategory;
  message?: string;
  error?: unknown;
  /** Request URL — for operational traceability. */
  url?: string;
  /** HTTP method — for operational traceability. */
  method?: string;
}): void {
  if (_isDev()) {
    const errorDetail = context.error instanceof Error
      ? { errorMessage: context.error.message, stack: context.error.stack }
      : context.error !== undefined
        ? { errorValue: context.error }
        : undefined;

    // Choose a semantically accurate label based on transport category.
    const label =
      context.category === 'timeout'       ? '[API TIMEOUT]'
      : context.category === 'no-response' ? '[API NO RESPONSE]'
      : context.category === 'unknown'     ? '[API TRANSPORT WARNING]'
      :                                      '[API TRANSPORT WARNING]';

    try {
      const parts: unknown[] = [
        label,
        `stage=${context.stage}`,
        context.message ?? 'Transport-layer event during API request',
      ];
      if (context.url)    parts.push(`url=${context.url}`);
      if (context.method) parts.push(`method=${context.method}`);
      if (errorDetail)    parts.push('error=', errorDetail);
      // Transport warnings at console.warn — not console.error — to preserve
      // [API PARSING ERROR] as a high-signal error domain.
      console.warn(...parts);
    } catch {
      console.warn(label, context.stage, context.message);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API CLIENT ERROR CLASS
// ─────────────────────────────────────────────────────────────────────────────

type ApiClientErrorParams = {
  message: string;
  /** @internal Raw backend code — logging / i18n only. UI must use `category`. */
  code?: string;
  category: ErrorCategory;
  status?: number;
  requestId?: string;
  retryAfter?: number;
  details?: Record<string, unknown> | null;
};

/**
 * Runtime error class — the ONLY error shape that crosses the API boundary into UI.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  UI USAGE RULE                                                      │
 * │  ✅  Branch on `err.category`  — stable, backend-agnostic          │
 * │  ✅  Read `err.details`        — field-level validation info        │
 * │  ✅  Read `err.retryAfter`     — rate-limit back-off hint          │
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
 *   case 'network':    return showConnectionError();
 *   default:           return showGenericToast(err.message);
 * }
 */
export class ApiClientError extends Error {
  /**
   * @internal Raw backend error code. INTERNAL USE ONLY.
   * For logging pipelines and i18n key lookup. Never branch on this in UI.
   */
  public readonly code: BackendErrorCode | string | undefined;

  /** Primary field for UI branching. Always use this — never `code`. */
  public readonly category: ErrorCategory;

  /** HTTP status resolved from transport layer or error code map. */
  public readonly status: number;

  /** Seconds to wait before retrying. Only set on `rate_limit` errors. */
  public readonly retryAfter: number | undefined;

  /** Correlation ID for structured logging and support. */
  public readonly requestId: string | undefined;

  /**
   * Structured details. Shape is endpoint-specific.
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
    Object.setPrototypeOf(this, ApiClientError.prototype);
  }

  // All getters delegate to `category` — single source of truth.
  get isAuthError():       boolean { return this.category === 'auth'; }
  get isValidationError(): boolean { return this.category === 'validation'; }
  get isRateLimit():       boolean { return this.category === 'rate_limit'; }
  get isTierGate():        boolean { return this.category === 'tier_gate'; }
  get isServerError():     boolean { return this.category === 'server'; }
  get isNotFound():        boolean { return this.category === 'not_found'; }
  get isConflict():        boolean { return this.category === 'conflict'; }
  get isNetworkError():    boolean { return this.category === 'network'; }
  get isSystemError():     boolean { return this.category === 'system'; }
  /** True for intentional React Query / AbortController cancellations. Never log as an error. */
  get isCancelledError():  boolean { return this.category === 'cancelled'; }

  toJSON(): Record<string, unknown> {
    return {
      name:       this.name,
      code:       this.code,
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
// FALLBACK ERROR FACTORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a safe fallback `ApiClientError` for unrecoverable parse failures.
 * Category is `'system'` — signals an internal contract/parse failure, not a
 * backend error. UI should show a generic error and log via observability.
 *
 * In development, emits a `console.warn` with the stage name so backend drift
 * is caught early without needing to inspect network panels.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function makeFallbackError(httpStatus = 500, stage?: string): ApiClientError {
  // DO NOT call logApiParsingError here.
  //
  // makeFallbackError is invoked from two distinct contexts:
  //
  //   A. Genuine parse failures — e.g. backend returned a non-object body or a
  //      response with no `success` flag. These ARE worth logging.
  //   B. Expected empty-body responses — e.g. 304 Not Modified where Axios
  //      replays the previous cached response body rather than returning null/''
  //      (a Axios HTTP-cache quirk). parseApiResponse then sees a stale body
  //      that fails structural validation and reaches makeFallbackError.
  //      These are NOT worth logging — they produce "[API PARSING ERROR] {}"
  //      noise for every 304 on a cached endpoint.
  //
  // The callers in case A already call logApiParsingError BEFORE calling
  // makeFallbackError (see parseApiResponse, parseBackendSuccess, etc.).
  // A second call from here is redundant in case A and harmful in case B.
  //
  // The console.warn below is also removed: it fires in dev on every 304
  // reload, making genuine backend drift warnings invisible in the noise.
  // Callers that hit case A already logged; case B is silent by design.

  return new ApiClientError({
    message:  'Unexpected server response',
    category: 'system',
    status:   httpStatus,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS VALIDATION HELPER  (separate from parsing — call after parsing)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Business-layer helper — separate from structural parsing.
 *
 * Use after `parseApiResponse` or `parseBackendSuccess` when the feature
 * contract requires `data` to be non-null (most endpoints).
 *
 * Throws `ApiClientError(category: 'system')` if data is null or undefined,
 * letting the caller handle it uniformly with all other API errors.
 *
 * @example
 * const res = await apiRequest<Resume>({ url: '/resume/123', method: 'GET' });
 * const resume = ensureDataExists(res); // throws ApiClientError if null
 */
export function ensureDataExists<T>(result: ApiSuccess<T>): T {
  if (result.data === null || result.data === undefined) {
    throw new ApiClientError({
      message:  'Expected data was missing from the server response',
      category: 'system',
      status:   500,
    });
  }
  return result.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPE GUARDS
// ─────────────────────────────────────────────────────────────────────────────

export function isApiClientError(err: unknown): err is ApiClientError {
  return err instanceof ApiClientError;
}

export function isKnownErrorCode(code: string): code is BackendErrorCode {
  return Object.values(BackendErrorCode).includes(code as BackendErrorCode);
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL DEV HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dev environment check — no `@types/node` or `vite/client` required.
 * Double-cast through `unknown` bypasses the `ImportMeta` interface.
 */
export function _isDev(): boolean {
  try {
    return (import.meta as unknown as { env: { DEV: boolean } }).env.DEV !== false;
  } catch {
    return true;
  }
}