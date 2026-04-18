// src/services/apiClient.ts
//
// Supabase-safe API client.
// Final production version for Next.js App Router + SSR + backend status integrity.

import { getIdToken } from '@/lib/auth';
import { ApiError, type ApiErrorResponse } from '@/types/api';

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? '';

const API_BASE = `${BASE_URL}/api/v1`;

const REQUEST_TIMEOUT_MS = 8_000;
const TOKEN_TIMEOUT_MS = 5_000;

const MAX_RETRIES = 2;
const RETRY_DELAY = 500;

const RETRYABLE_STATUSES = new Set([
  408,
  429,
  500,
  502,
  503,
  504,
]);

export interface FetchOptions
  extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  skipRetry?: boolean;
  skipAuth?: boolean;
}

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function parseResponseBody(
  response: Response
): Promise<unknown> {
  if (
    response.status === 204 ||
    response.headers.get('content-length') === '0'
  ) {
    return null;
  }

  const contentType =
    response.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function getSupabaseIdToken(): Promise<string> {
  let timeoutId: ReturnType<typeof setTimeout> | null =
    null;

  try {
    const token = await Promise.race([
      getIdToken(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new ApiError(
              'Session not ready — please try again.',
              'UNAUTHORIZED',
              401
            )
          );
        }, TOKEN_TIMEOUT_MS);
      }),
    ]);

    if (!token) {
      throw new ApiError(
        'No authenticated session — please sign in.',
        'UNAUTHORIZED',
        401
      );
    }

    return token;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function buildHeaders(
  options: FetchOptions
): Promise<Record<string, string>> {
  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = isFormData
    ? { ...(options.headers ?? {}) }
    : {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      };

  if (!options.skipAuth) {
    const token = await getSupabaseIdToken();
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function executeRequestWithResponse<T>(
  path: string,
  options: FetchOptions = {},
  attempt = 0
): Promise<{ data: T; response: Response }> {
  const {
    signal: callerSignal,
    skipRetry,
    ...init
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  const abortHandler = () => controller.abort();

  if (callerSignal) {
    callerSignal.addEventListener('abort', abortHandler, {
      once: true,
    });
  }

  try {
    const headers = await buildHeaders(options);

    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
      credentials: 'include',
    });

    if (
      !skipRetry &&
      RETRYABLE_STATUSES.has(response.status) &&
      attempt < MAX_RETRIES
    ) {
      await sleep(RETRY_DELAY * 2 ** attempt);
      return executeRequestWithResponse<T>(
        path,
        options,
        attempt + 1
      );
    }

    const body = await parseResponseBody(response);

    if (!response.ok) {
      const err = body as ApiErrorResponse | null;

      throw new ApiError(
        err?.error?.message ??
          `Request failed: ${response.status}`,
        err?.error?.code ?? 'UNKNOWN_ERROR',
        response.status,
        (err as any)?.details
      );
    }

    const successBody = body as
      | { success?: boolean; data?: T }
      | null;

    return {
      data: (successBody?.data ??
        (body as T)) as T,
      response,
    };
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new ApiError(
        `Request timed out after ${
          REQUEST_TIMEOUT_MS / 1000
        }s.`,
        'TIMEOUT',
        0
      );
    }

    const shouldRetry =
      !skipRetry &&
      !(error instanceof ApiError) &&
      attempt < MAX_RETRIES;

    if (shouldRetry) {
      await sleep(RETRY_DELAY * 2 ** attempt);
      return executeRequestWithResponse<T>(
        path,
        options,
        attempt + 1
      );
    }

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      'Network request failed. Please check your connection.',
      'NETWORK_ERROR',
      0
    );
  } finally {
    clearTimeout(timeoutId);

    if (callerSignal) {
      callerSignal.removeEventListener(
        'abort',
        abortHandler
      );
    }
  }
}

async function executeRequest<T>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { data } = await executeRequestWithResponse<T>(
    path,
    options
  );

  return data;
}

export async function apiFetch<T>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  return executeRequest<T>(path, options);
}

export async function apiFetchWithStatus<T>(
  path: string,
  options: FetchOptions = {}
): Promise<{ data: T; status: number }> {
  const { data, response } =
    await executeRequestWithResponse<T>(
      path,
      options
    );

  return {
    data,
    status: response.status,
  };
}