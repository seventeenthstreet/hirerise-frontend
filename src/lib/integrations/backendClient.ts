/**
 * @file lib/integrations/backendClient.ts
 * @description Internal backend analytics API integration client.
 *
 * RULES (NON-NEGOTIABLE):
 *  - ZERO business logic — fetch, catch, and return raw data only
 *  - ZERO normalization — raw backend shapes leave this file unchanged
 *  - ZERO imports from hooks, UI, or alerts
 *  - All errors are caught and reflected in the payload shape (never thrown)
 *  - AbortSignal supported for request cancellation
 *  - Failed sections degrade gracefully — other sections still succeed
 *  - ALL returned types are from /types/external/backend.ts ONLY
 *
 * ARCHITECTURE POSITION:
 *  Backend API → [this file] → metricsMapper.ts → /lib/api/metrics.ts → hooks
 *
 * NOTE:
 *  This client calls the same backend that /lib/api/core/api-client.ts serves,
 *  BUT it uses its own fetch path deliberately:
 *  - It fetches analytics-specific endpoints that don't go through the standard
 *    api-client auth/error-handling pipeline
 *  - It returns raw shapes (not ApiClientError) so the mapper controls error handling
 *  - It is isolated from internal api-client changes
 *
 *  If you want to run through apiRequest instead, replace the fetch calls here.
 *  Nothing outside this file changes.
 */

import type {
  BackendRawPayload,
  BackendSection,
  BackendAnalyticsEnvelope,
  BackendRawResumeFunnel,
  BackendRawOnboardingFunnel,
  BackendRawPerformance,
  BackendRawReliability,
  BackendRawExperiments,
} from '@/types/external/backend';
import { getAccessToken } from '@/lib/supabase/client';

// Phase 3.5 — Observability Layer (additive)
import { emitApiSuccess, emitApiError } from '@/lib/observability/apiInstrumentation';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

// ── CORS FIX — use relative paths, not an absolute BASE_URL ──────────────────
//
// Previously: `const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? ''`
// and then `new URL(`${BASE_URL}${path}`)` — which produces an absolute URL
// (http://localhost:3001/api/v1/...) when the env var is set. This bypasses
// the Next.js proxy and sends a cross-origin request from :3000 → :3001.
//
// FIX: `new URL(absolute)` is replaced below with a simple path + query
// string concatenation. Relative paths go through the Next.js proxy rewrite
// (/api/v1/* → backend) — same-origin, no CORS preflight.
//
// NOTE: new URL() with a relative path throws ("Invalid URL") unless a base
// is provided. We avoid new URL() entirely for browser-side relative paths
// and build the query string manually via buildQuery().
const REQUEST_TIMEOUT = 10_000; // 10s per section

/**
 * Backend analytics endpoint paths.
 * Versioned separately from the core API so they can evolve independently.
 */
const ENDPOINTS = {
  resumeFunnel:    '/api/v1/analytics/resume-funnel',
  onboarding:      '/api/v1/analytics/onboarding',
  performance:     '/api/v1/analytics/performance',
  reliability:     '/api/v1/analytics/reliability',
  experiments:     '/api/v1/analytics/experiments',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL FETCH UTILITY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Internal low-level backend fetch.
 * Returns the full envelope (including success/error metadata) or null on
 * network failure. HTTP error responses are returned as null — the caller
 * checks envelope.success to distinguish API-level errors from no data.
 */
async function backendFetch<T>(
  path: string,
  params?: Record<string, string | undefined>,
  signal?: AbortSignal,
  traceId?: string,
): Promise<BackendAnalyticsEnvelope<T> | null> {
  const timeoutController = new AbortController();
  const timeoutId         = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT);

  const combinedSignal = signal
    ? AbortSignal.any
      ? AbortSignal.any([signal, timeoutController.signal])
      : timeoutController.signal
    : timeoutController.signal;

  try {
    // CORS FIX: Build a relative URL string instead of using new URL(absolute).
    // `new URL(relative)` throws "Invalid URL" in browsers — it requires a base.
    // We build the path + query string manually; relative paths go through the
    // Next.js proxy rewrite (/api/v1/* → backend) without CORS preflights.
    const query    = buildQuery(params);
    const fullPath = query ? `${path}?${query}` : path;

    const response = await fetch(fullPath, {
      method:  'GET',
      headers: await (async () => {
        const token = await getAccessToken();
        return {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
      })(),
      credentials: 'include',
      signal:      combinedSignal,
    });

    if (!response.ok) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[backendClient] HTTP ${response.status} for ${path}`);
      }
      return null;
    }

    const json = (await response.json()) as BackendAnalyticsEnvelope<T>;
    // Phase 3.5 — Observability: emit success
    emitApiSuccess(path, traceId, { status: response.status });
    return json;
  } catch (err) {
    // Phase 3.5 — Observability: emit error (only for non-abort errors)
    const isAbort =
      err instanceof DOMException && err.name === 'AbortError';
    if (!isAbort) {
      emitApiError(path, err, traceId);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function buildQuery(params?: Record<string, string | undefined>): string {
  if (!params) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) p.set(k, v);
  }
  return p.toString();
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API — single entry point
// ─────────────────────────────────────────────────────────────────────────────

export interface BackendFetchOptions {
  dateFrom?:  string;
  dateTo?:    string;
  userType?:  string;
  variant?:   string;
  grain?:     string;
  signal?:    AbortSignal;
  /** Phase 3.5: optional trace ID for cross-layer event correlation. */
  traceId?:   string;
}

/**
 * Fetch all backend analytics sections in parallel.
 *
 * Each section is fetched independently via Promise.allSettled. A failed
 * section returns null in the payload — the mapper applies safe defaults.
 * The rest of the sections proceed unaffected.
 *
 * GUARANTEES:
 *  - Never throws
 *  - Always returns BackendRawPayload
 *  - successfulSections reflects actual fetch outcomes
 *
 * @param options - Optional filters and AbortSignal
 * @returns BackendRawPayload with whatever sections succeeded
 */
export async function fetchBackendMetrics(
  options: BackendFetchOptions = {},
): Promise<BackendRawPayload> {
  const { dateFrom, dateTo, userType, variant, grain, signal, traceId } = options;

  const params: Record<string, string | undefined> = {
    date_from:  dateFrom,
    date_to:    dateTo,
    user_type:  userType,
    variant,
    grain,
  };

  const [
    resumeFunnelResult,
    onboardingResult,
    performanceResult,
    reliabilityResult,
    experimentsResult,
  ] = await Promise.allSettled([
    backendFetch<BackendRawResumeFunnel>(ENDPOINTS.resumeFunnel, params, signal, traceId),
    backendFetch<BackendRawOnboardingFunnel>(ENDPOINTS.onboarding, params, signal, traceId),
    backendFetch<BackendRawPerformance>(ENDPOINTS.performance, params, signal, traceId),
    backendFetch<BackendRawReliability>(ENDPOINTS.reliability, params, signal, traceId),
    backendFetch<BackendRawExperiments>(ENDPOINTS.experiments, params, signal, traceId),
  ]);

  const successfulSections = new Set<BackendSection>();

  const unwrap = <T>(
    result: PromiseSettledResult<BackendAnalyticsEnvelope<T> | null>,
    section: BackendSection,
  ): BackendAnalyticsEnvelope<T> | undefined => {
    if (
      result.status === 'fulfilled' &&
      result.value !== null &&
      result.value.success !== false
    ) {
      successfulSections.add(section);
      return result.value;
    }
    return undefined;
  };

  return {
    resumeFunnel:    unwrap(resumeFunnelResult,  'resumeFunnel'),
    onboardingFunnel: unwrap(onboardingResult,   'onboardingFunnel'),
    performance:     unwrap(performanceResult,   'performance'),
    reliability:     unwrap(reliabilityResult,   'reliability'),
    experiments:     unwrap(experimentsResult,   'experiments'),
    fetchedAt:       Date.now(),
    successfulSections,
  };
}