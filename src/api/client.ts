/**
 * src/api/client.ts
 *
 * HireRise — Central Axios Client
 *
 * Aligns 1-to-1 with backend contracts:
 *   • V2 canonical error envelope  { success, error: { code, message }, meta: { requestId, timestamp } }
 *   • Supabase JWT Bearer auth      (auth.middleware.js)
 *   • Correlation headers           (correlation.middleware.js: x-request-id, x-hydration-id)
 *   • Rate-limit zones              (rateLimiting.middleware.js: 429 + Retry-After)
 *   • Plan / tier gate responses    (requireTier / requirePaidPlan: 402)
 *   • AI cost-guard responses       (aiCostGuard: 402)
 *   • Token expiry detection        (auth.middleware.js: "Token expired. Please refresh.")
 *
 * Architecture: interceptor pipeline → normalizer → typed ApiError
 */

import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { v4 as uuidv4 } from 'uuid';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE_URL =
  (import.meta as ImportMeta & { env: Record<string, string> }).env
    .VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1';

const DEFAULT_TIMEOUT_MS  = 30_000;   // 30 s — covers AI inference endpoints
const AI_TIMEOUT_MS       = 90_000;   // 90 s — careerCopilot / digitalTwin streams
const UPLOAD_TIMEOUT_MS   = 120_000;  // 2 min — resume upload

// ─────────────────────────────────────────────────────────────────────────────
// TYPED ERROR ENVELOPE
// Mirrors backend V2 canonical error shape (errorHandler.js / auth.middleware.js)
// ─────────────────────────────────────────────────────────────────────────────

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'PAYMENT_REQUIRED'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR'
  | 'TOKEN_EXPIRED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | string; // extensible — backend may add new codes

export interface ApiErrorMeta {
  requestId:  string | null;
  timestamp:  string;
  retryAfter?: number; // seconds — present on 429
}

export class ApiError extends Error {
  public readonly code:       ApiErrorCode;
  public readonly statusCode: number;
  public readonly meta:       ApiErrorMeta;
  public readonly isTokenExpired: boolean;
  public readonly isRateLimited:  boolean;
  public readonly isPaymentRequired: boolean;
  public readonly isNetworkError:  boolean;

  constructor(
    message:    string,
    code:       ApiErrorCode,
    statusCode: number,
    meta:       ApiErrorMeta,
  ) {
    super(message);
    this.name       = 'ApiError';
    this.code       = code;
    this.statusCode = statusCode;
    this.meta       = meta;

    this.isTokenExpired     = code === 'TOKEN_EXPIRED';
    this.isRateLimited      = code === 'RATE_LIMITED'  || statusCode === 429;
    this.isPaymentRequired  = code === 'PAYMENT_REQUIRED' || statusCode === 402;
    this.isNetworkError     = code === 'NETWORK_ERROR';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TOKEN EXPIRY DETECTION
// Matches backend message: "Token expired. Please refresh."
// ─────────────────────────────────────────────────────────────────────────────

function isTokenExpiredMessage(message?: string): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes('token expired') ||
    lower.includes('jwt expired')   ||
    lower.includes('please refresh')
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR NORMALIZER
// Converts any Axios error into a typed ApiError, regardless of shape.
// ─────────────────────────────────────────────────────────────────────────────

function normalizeError(error: unknown): ApiError {
  // Network / timeout / DNS errors (no response)
  if (axios.isAxiosError(error) && !error.response) {
    const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
    return new ApiError(
      isTimeout ? 'Request timed out. Please try again.' : 'Network error. Check your connection.',
      isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
      0,
      { requestId: null, timestamp: new Date().toISOString() },
    );
  }

  if (axios.isAxiosError(error) && error.response) {
    const { status, data, headers } = error.response;

    // Backend V2 envelope: { success: false, error: { code, message }, meta: { requestId, timestamp } }
    const backendError   = data?.error;
    const backendMeta    = data?.meta ?? {};
    const message        = backendError?.message ?? data?.message ?? error.message ?? 'Request failed';
    const retryAfter     = headers['retry-after'] ? Number(headers['retry-after']) : undefined;

    let code: ApiErrorCode = backendError?.code ?? 'INTERNAL_ERROR';

    // Normalise token-expiry to a distinct frontend code
    if (status === 401 && isTokenExpiredMessage(message)) {
      code = 'TOKEN_EXPIRED';
    } else if (status === 401) {
      code = 'UNAUTHORIZED';
    } else if (status === 402) {
      code = 'PAYMENT_REQUIRED';
    } else if (status === 429) {
      code = 'RATE_LIMITED';
    } else if (status === 503) {
      code = 'SERVICE_UNAVAILABLE';
    }

    return new ApiError(message, code, status, {
      requestId:  backendMeta.requestId  ?? headers['x-request-id']  ?? null,
      timestamp:  backendMeta.timestamp  ?? new Date().toISOString(),
      ...(retryAfter !== undefined ? { retryAfter } : {}),
    });
  }

  // Unknown / non-Axios error
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';
  return new ApiError(message, 'INTERNAL_ERROR', 0, {
    requestId: null,
    timestamp: new Date().toISOString(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TOKEN PROVIDER
// Pluggable so AuthProvider can inject the Supabase session getter at startup.
// ─────────────────────────────────────────────────────────────────────────────

type TokenProvider = () => Promise<string | null> | string | null;

let _tokenProvider: TokenProvider = () => null;

/**
 * Called once from AuthProvider.  Injects the Supabase token getter so
 * the client never imports Supabase directly (keeps auth concerns isolated).
 */
export function setTokenProvider(fn: TokenProvider): void {
  _tokenProvider = fn;
}

// ─────────────────────────────────────────────────────────────────────────────
// HYDRATION ID
// Single session-scoped ID for correlation with backend logs (OBS Phase 2).
// Mirrors backend: correlation.middleware.js → x-hydration-id header.
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_HYDRATION_ID = `hyd_${uuidv4()}`;

// ─────────────────────────────────────────────────────────────────────────────
// REFRESH-TOKEN HOOK
// Pluggable refresh callback — injected by AuthProvider for future token
// rotation.  When set, a 401/TOKEN_EXPIRED will attempt one refresh then retry.
// ─────────────────────────────────────────────────────────────────────────────

type RefreshHandler = () => Promise<string | null>;
let _refreshHandler: RefreshHandler | null = null;

export function setRefreshHandler(fn: RefreshHandler): void {
  _refreshHandler = fn;
}

// ─────────────────────────────────────────────────────────────────────────────
// AXIOS INSTANCE
// ─────────────────────────────────────────────────────────────────────────────

const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  },
  withCredentials: false, // Supabase JWT via Authorization header, not cookies
});

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST INTERCEPTOR
// 1. Injects Bearer token from plugged-in token provider
// 2. Attaches correlation headers (x-request-id, x-hydration-id)
// ─────────────────────────────────────────────────────────────────────────────

client.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // ── Auth token ──────────────────────────────────────────────────────────
    const token = await _tokenProvider();
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }

    // ── Correlation headers (OBS Phase 2 contract) ──────────────────────────
    // x-request-id: unique per request — lets backend join this call in logs
    // x-hydration-id: unique per session — traces the full frontend session
    config.headers.set('X-Request-ID',   `req_${uuidv4()}`);
    config.headers.set('X-Hydration-ID', SESSION_HYDRATION_ID);

    return config;
  },
  (error) => Promise.reject(normalizeError(error)),
);

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE INTERCEPTOR
// 1. Pass-through success responses
// 2. Normalise errors → ApiError
// 3. Attempt one token refresh on TOKEN_EXPIRED then retry
// ─────────────────────────────────────────────────────────────────────────────

let _isRefreshing = false;
let _refreshPromise: Promise<string | null> | null = null;

client.interceptors.response.use(
  (response: AxiosResponse) => response,

  async (error) => {
    const normalised = normalizeError(error);

    // ── Token refresh flow ───────────────────────────────────────────────────
    // Only attempt if: token expired + refresh handler registered + not already retried
    const originalConfig = error.config as InternalAxiosRequestConfig & { _retried?: boolean };

    if (
      normalised.isTokenExpired &&
      _refreshHandler             &&
      !originalConfig?._retried
    ) {
      originalConfig._retried = true;

      // Serialise concurrent refresh calls to a single promise
      if (!_isRefreshing) {
        _isRefreshing   = true;
        _refreshPromise = _refreshHandler()
          .finally(() => { _isRefreshing = false; _refreshPromise = null; });
      }

      const newToken = await _refreshPromise;

      if (newToken) {
        originalConfig.headers.set('Authorization', `Bearer ${newToken}`);
        return client(originalConfig);
      }
    }

    return Promise.reject(normalised);
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// TIMEOUT PRESETS
// Use these for route-specific overrides:
//   const res = await client.post('/career-copilot/stream', body, AI_REQUEST_CONFIG);
// ─────────────────────────────────────────────────────────────────────────────

export const AI_REQUEST_CONFIG: Partial<AxiosRequestConfig> = {
  timeout: AI_TIMEOUT_MS,
};

export const UPLOAD_REQUEST_CONFIG: Partial<AxiosRequestConfig> = {
  timeout:  UPLOAD_TIMEOUT_MS,
  headers:  { 'Content-Type': 'multipart/form-data' },
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPE GUARD
// ─────────────────────────────────────────────────────────────────────────────

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export default client;
