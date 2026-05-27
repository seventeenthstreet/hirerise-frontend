/**
 * @file lib/integrations/posthogClient.ts
 * @description PostHog API integration client.
 *
 * RULES (NON-NEGOTIABLE):
 *  - ZERO business logic — fetch, catch, and return raw data only
 *  - ZERO normalization — raw PostHog shapes leave this file unchanged
 *  - ZERO imports from hooks, UI, or alerts
 *  - All errors are caught and reflected via IntegrationResult (never thrown)
 *  - AbortSignal supported for request cancellation
 *  - Failed sections degrade gracefully — other sections still succeed
 *  - ALL returned types are from /types/external/posthog.ts ONLY
 *
 * ARCHITECTURE POSITION:
 *  PostHog API → [this file] → metricsAdapter.ts → metricsMapper.ts → /lib/api/metrics.ts → hooks
 *
 * CONFIGURATION:
 *  posthogClient reads from environment variables only.
 *  Never hardcode credentials. Never log them.
 *
 * TO SWITCH SOURCES:
 *  You do not touch this file. You update METRICS_SOURCE in your environment.
 *  The adapter selects the active client. This file remains unchanged.
 *
 * PATCH SUMMARY (Critical Refinements — Req 1: Soft Error Channel):
 *  - fetchPostHogMetrics now returns Promise<IntegrationResult<PostHogRawPayload>>
 *  - On total failure: { data: null, error: { source: 'posthog', message, code } }
 *  - On success:       { data: PostHogRawPayload }
 *  - Internal section failures still degrade gracefully (null fields in payload)
 *  - posthogFetch now returns { data, code } to surface structured error codes
 *  - All other logic (parallel fetches, timeout, AbortSignal) is unchanged
 */

import type {
  PostHogRawPayload,
  PostHogSection,
  PostHogFunnelResult,
  PostHogTrendsResult,
  PostHogListResponse,
  PostHogEventAggregation,
  PostHogExperimentResult,
} from '@/types/external/posthog';

import type { IntegrationResult } from '@/types/internal/integrationResult';
import { integrationOk, integrationErr } from '@/types/internal/integrationResult';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// All config is read-only at module load time. Mutations are not possible.
// ─────────────────────────────────────────────────────────────────────────────

const _env = typeof process !== 'undefined' ? process.env : ({} as NodeJS.ProcessEnv);

const POSTHOG_HOST       = _env.NEXT_PUBLIC_POSTHOG_HOST       ?? 'https://app.posthog.com';
const POSTHOG_API_KEY    = _env.POSTHOG_API_KEY                ?? '';
const POSTHOG_PROJECT_ID = _env.POSTHOG_PROJECT_ID             ?? '';
const REQUEST_TIMEOUT_MS = 10_000; // 10s per section fetch

/**
 * PostHog insight IDs — configure these per environment.
 * These reference saved insights in your PostHog project.
 */
const INSIGHT_IDS = {
  resumeFunnel:      _env.POSTHOG_INSIGHT_RESUME_FUNNEL      ?? '',
  onboardingFunnel:  _env.POSTHOG_INSIGHT_ONBOARDING_FUNNEL  ?? '',
  processingLatency: _env.POSTHOG_INSIGHT_PROCESSING_LATENCY ?? '',
  uploadDuration:    _env.POSTHOG_INSIGHT_UPLOAD_DURATION    ?? '',
  experimentId:      _env.POSTHOG_EXPERIMENT_ID              ?? '',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL FETCH RESULT
// Carries the parsed response + a structured error code for the outer layer.
// ─────────────────────────────────────────────────────────────────────────────

interface FetchSectionResult<T> {
  data: T | null;
  /** Machine-readable error code — populated only when data is null. */
  code?: 'CONFIG_MISSING' | 'HTTP_ERROR' | 'TIMEOUT' | 'NETWORK_ERROR' | 'PARSE_ERROR';
  /** Human-readable detail for dev logging. */
  detail?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL FETCH UTILITY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Internal low-level PostHog API fetch.
 *
 * Returns a FetchSectionResult — never throws.
 * Callers check result.data for success; result.code describes failure reason.
 */
async function posthogFetch<T>(
  path: string,
  signal?: AbortSignal,
): Promise<FetchSectionResult<T>> {
  if (!POSTHOG_API_KEY || !POSTHOG_PROJECT_ID) {
    if (_env.NODE_ENV === 'development') {
      console.warn('[posthogClient] Missing POSTHOG_API_KEY or POSTHOG_PROJECT_ID');
    }
    return { data: null, code: 'CONFIG_MISSING', detail: 'POSTHOG_API_KEY or POSTHOG_PROJECT_ID not set' };
  }

  const timeoutController = new AbortController();
  const timeoutId         = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);

  // Combine caller's signal with our timeout signal
  const combinedSignal = signal
    ? AbortSignal.any
      ? AbortSignal.any([signal, timeoutController.signal])
      : timeoutController.signal
    : timeoutController.signal;

  try {
    const url      = `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}${path}`;
    const response = await fetch(url, {
      method:  'GET',
      headers: {
        'Authorization': `Bearer ${POSTHOG_API_KEY}`,
        'Content-Type':  'application/json',
      },
      signal: combinedSignal,
    });

    if (!response.ok) {
      if (_env.NODE_ENV === 'development') {
        console.warn(`[posthogClient] HTTP ${response.status} for ${path}`);
      }
      return { data: null, code: 'HTTP_ERROR', detail: `HTTP ${response.status} ${response.statusText}` };
    }

    let parsed: T;
    try {
      parsed = (await response.json()) as T;
    } catch {
      return { data: null, code: 'PARSE_ERROR', detail: 'Failed to parse JSON response' };
    }

    return { data: parsed };
  } catch (err) {
    // Distinguish timeout aborts from caller cancellations and network errors
    const isTimeout = timeoutController.signal.aborted && !(signal?.aborted);
    return {
      data:   null,
      code:   isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
      detail: err instanceof Error ? err.message : 'Unknown fetch error',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION FETCHERS
// Each function fetches one PostHog insight and returns raw response or null.
// Section-level failures are isolated — they do not affect other sections.
// ─────────────────────────────────────────────────────────────────────────────

async function fetchResumeFunnel(
  dateFrom?: string,
  dateTo?:   string,
  signal?:   AbortSignal,
): Promise<PostHogFunnelResult | null> {
  if (!INSIGHT_IDS.resumeFunnel) return null;
  const params = buildDateParams(dateFrom, dateTo);
  const result = await posthogFetch<PostHogFunnelResult>(
    `/insights/${INSIGHT_IDS.resumeFunnel}/funnel/${params}`,
    signal,
  );
  return result.data;
}

async function fetchOnboardingFunnel(
  dateFrom?: string,
  dateTo?:   string,
  signal?:   AbortSignal,
): Promise<PostHogFunnelResult | null> {
  if (!INSIGHT_IDS.onboardingFunnel) return null;
  const params = buildDateParams(dateFrom, dateTo);
  const result = await posthogFetch<PostHogFunnelResult>(
    `/insights/${INSIGHT_IDS.onboardingFunnel}/funnel/${params}`,
    signal,
  );
  return result.data;
}

async function fetchProcessingLatency(
  dateFrom?: string,
  dateTo?:   string,
  signal?:   AbortSignal,
): Promise<PostHogTrendsResult | null> {
  if (!INSIGHT_IDS.processingLatency) return null;
  const params = buildDateParams(dateFrom, dateTo);
  const result = await posthogFetch<PostHogTrendsResult>(
    `/insights/${INSIGHT_IDS.processingLatency}/trend/${params}`,
    signal,
  );
  return result.data;
}

async function fetchUploadDuration(
  dateFrom?: string,
  dateTo?:   string,
  signal?:   AbortSignal,
): Promise<PostHogTrendsResult | null> {
  if (!INSIGHT_IDS.uploadDuration) return null;
  const params = buildDateParams(dateFrom, dateTo);
  const result = await posthogFetch<PostHogTrendsResult>(
    `/insights/${INSIGHT_IDS.uploadDuration}/trend/${params}`,
    signal,
  );
  return result.data;
}

async function fetchErrorAggregations(
  dateFrom?: string,
  dateTo?:   string,
  signal?:   AbortSignal,
): Promise<PostHogListResponse<PostHogEventAggregation> | null> {
  const params = buildDateParams(dateFrom, dateTo, {
    event:      'resume_processing_failed',
    properties: JSON.stringify([{ key: 'error_reason', type: 'event' }]),
  });
  const result = await posthogFetch<PostHogListResponse<PostHogEventAggregation>>(
    `/events/${params}`,
    signal,
  );
  return result.data;
}

async function fetchExperimentResults(
  signal?: AbortSignal,
): Promise<PostHogExperimentResult | null> {
  if (!INSIGHT_IDS.experimentId) return null;
  const result = await posthogFetch<PostHogExperimentResult>(
    `/experiments/${INSIGHT_IDS.experimentId}/`,
    signal,
  );
  return result.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Build URLSearchParams string from optional date range + extra params. */
function buildDateParams(
  dateFrom?: string,
  dateTo?:   string,
  extra?:    Record<string, string>,
): string {
  const params = new URLSearchParams();
  if (dateFrom) params.set('date_from', dateFrom);
  if (dateTo)   params.set('date_to',   dateTo);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API — single entry point
// ─────────────────────────────────────────────────────────────────────────────

export interface PostHogFetchOptions {
  dateFrom?: string;
  dateTo?:   string;
  signal?:   AbortSignal;
}

/**
 * Fetch all PostHog metrics sections in parallel.
 *
 * Returns IntegrationResult<PostHogRawPayload> — NEVER throws.
 *
 * Success path:
 *   { data: PostHogRawPayload }
 *   Individual section failures are silent — those fields are undefined in the
 *   payload and the mapper falls back to section-level defaults. The overall
 *   result is still a success as long as the fetch orchestration itself didn't
 *   catastrophically fail.
 *
 * Failure path:
 *   { data: null, error: { source: 'posthog', message, code } }
 *   Returned only when the entire fetch cycle itself fails in an unexpected way.
 *   In practice this path is unreachable (Promise.allSettled never rejects), but
 *   it is present for defensive completeness.
 *
 * GUARANTEES:
 *  - Never throws
 *  - Always returns IntegrationResult<PostHogRawPayload>
 *  - successfulSections reflects actual per-section outcomes
 *  - fetchedAt is the Unix timestamp (ms) of payload assembly
 *
 * @param options - Optional date range and AbortSignal
 * @returns IntegrationResult wrapping PostHogRawPayload
 */
export async function fetchPostHogMetrics(
  options: PostHogFetchOptions = {},
): Promise<IntegrationResult<PostHogRawPayload>> {
  const { dateFrom, dateTo, signal } = options;

  try {
    // All sections run in parallel. Promise.allSettled never rejects.
    const [
      resumeFunnelResult,
      onboardingFunnelResult,
      processingLatencyResult,
      uploadDurationResult,
      errorAggregationsResult,
      experimentResultsResult,
    ] = await Promise.allSettled([
      fetchResumeFunnel(dateFrom, dateTo, signal),
      fetchOnboardingFunnel(dateFrom, dateTo, signal),
      fetchProcessingLatency(dateFrom, dateTo, signal),
      fetchUploadDuration(dateFrom, dateTo, signal),
      fetchErrorAggregations(dateFrom, dateTo, signal),
      fetchExperimentResults(signal),
    ]);

    // Track which sections delivered real data
    const successfulSections = new Set<PostHogSection>();

    const unwrap = <T>(
      result: PromiseSettledResult<T | null>,
      section: PostHogSection,
    ): T | undefined => {
      if (result.status === 'fulfilled' && result.value !== null) {
        successfulSections.add(section);
        return result.value;
      }
      return undefined;
    };

    const payload: PostHogRawPayload = {
      resumeFunnel:      unwrap(resumeFunnelResult,      'resumeFunnel'),
      onboardingFunnel:  unwrap(onboardingFunnelResult,  'onboardingFunnel'),
      processingLatency: unwrap(processingLatencyResult, 'processingLatency'),
      uploadDuration:    unwrap(uploadDurationResult,    'uploadDuration'),
      errorAggregations: unwrap(errorAggregationsResult, 'errorAggregations'),
      experimentResults: unwrap(experimentResultsResult, 'experimentResults'),
      fetchedAt:         Date.now(),
      successfulSections,
    };

    return integrationOk(payload);

  } catch (err) {
    // This branch is unreachable in normal operation — Promise.allSettled never
    // rejects. Guard present for defensive completeness and future-proofing.
    const message = err instanceof Error ? err.message : 'Unexpected error in fetchPostHogMetrics';
    if (_env.NODE_ENV === 'development') {
      console.error('[posthogClient] Catastrophic fetch failure:', message);
    }
    return integrationErr('posthog', message, 'FETCH_FAILED');
  }
}