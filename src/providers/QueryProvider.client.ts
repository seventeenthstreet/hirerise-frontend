/**
 * src/providers/QueryProvider.client.ts
 *
 * HireRise — React Query client configuration, stale-time presets,
 * retry strategy, global error handler, and queryClient singleton.
 *
 * Extracted from QueryProvider.tsx for Vite Fast Refresh compatibility.
 * Import STALE presets and queryClient from here; the JSX provider lives in QueryProvider.tsx.
 */

import {
  QueryClient,
  type QueryClientConfig,
} from '@tanstack/react-query';
import { ApiError } from '../api/client';

// ─────────────────────────────────────────────────────────────────────────────
// STALE-TIME PRESETS
// Export these so individual hooks can opt into the right caching tier.
// Usage: useQuery({ queryKey: [...], queryFn, staleTime: STALE.CAREER_GRAPH })
// ─────────────────────────────────────────────────────────────────────────────

export const STALE = {
  /** Auth/user hydration — invalidated on login, plan change, onboarding */
  USER:            30  * 1_000,         // 30 s
  /** Onboarding session state — tight to avoid stale multi-step reads */
  ONBOARDING:      60  * 1_000,         // 1 min
  /** AI results — should not refetch silently; results are session-scoped */
  AI_RESULT:       5   * 60 * 1_000,   // 5 min
  /** Dashboard aggregates — expensive backend queries */
  DASHBOARD:       2   * 60 * 1_000,   // 2 min
  /** Career / skill graph data — slow-moving */
  CAREER_GRAPH:    10  * 60 * 1_000,   // 10 min
  /** Analytics snapshots */
  ANALYTICS:       5   * 60 * 1_000,   // 5 min
  /** Reference / CMS data (roles, skills taxonomy) */
  REFERENCE:       30  * 60 * 1_000,   // 30 min
  /** Never go stale — use only for fully static content */
  FOREVER:         Infinity,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// RETRY STRATEGY
// Wires into the ApiError taxonomy from client.ts.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns false immediately for errors that should never be retried:
 *   • Auth failures (UNAUTHORIZED, FORBIDDEN, TOKEN_EXPIRED) — retrying won't help
 *   • Client errors 4xx (BAD_REQUEST, VALIDATION_ERROR, NOT_FOUND, PAYMENT_REQUIRED)
 *   • Rate-limited — the caller should handle RATE_LIMITED with retry-after logic
 *
 * Allows up to `maxRetries` for transient server/network failures.
 */
function retryPolicy(failureCount: number, error: unknown): boolean {
  const MAX_RETRIES = 2;

  if (error instanceof ApiError) {
    const { statusCode, isTokenExpired, isRateLimited, isPaymentRequired } = error;

    // Never retry these — they are deterministic failures
    if (
      isTokenExpired     ||
      isRateLimited      ||
      isPaymentRequired  ||
      statusCode === 400 ||
      statusCode === 401 ||
      statusCode === 403 ||
      statusCode === 404 ||
      statusCode === 409 ||
      statusCode === 422
    ) {
      return false;
    }
  }

  return failureCount < MAX_RETRIES;
}

/**
 * Exponential backoff with jitter (stays under rate-limit windows).
 * Caps at 30 s to avoid unbounded delays.
 */
function retryDelay(attemptIndex: number): number {
  const base    = Math.min(1_000 * 2 ** attemptIndex, 30_000);
  const jitter  = Math.random() * 500;
  return base + jitter;
}

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL ERROR HANDLER
// Central hook for auth-level side-effects:
//   - TOKEN_EXPIRED → surface notification / redirect to re-auth
//   - PAYMENT_REQUIRED → route to /pricing
//   - RATE_LIMITED → surface toast with retry-after countdown
// Downstream: extend via setQueryClientErrorHandler() if needed.
// ─────────────────────────────────────────────────────────────────────────────

type GlobalErrorHandler = (error: unknown) => void;
let _globalErrorHandler: GlobalErrorHandler = () => {};

export function setQueryClientErrorHandler(fn: GlobalErrorHandler): void {
  _globalErrorHandler = fn;
}

function handleQueryError(error: unknown): void {
  _globalErrorHandler(error);
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY CLIENT
// Singleton — imported directly where imperative cache ops are needed.
// ─────────────────────────────────────────────────────────────────────────────

const queryClientConfig: QueryClientConfig = {
  defaultOptions: {
    queries: {
      // Moderate default — overridden per-query via STALE presets
      staleTime:  STALE.DASHBOARD,
      // Keep unused data in cache for 10 min (gcTime renamed from cacheTime in v5)
      gcTime:     10 * 60 * 1_000,
      retry:      retryPolicy,
      retryDelay: retryDelay,
      // Do not refetch when window regains focus for AI/expensive routes —
      // individual hooks can override with refetchOnWindowFocus: true
      refetchOnWindowFocus:       false,
      refetchOnReconnect:         true,
      refetchOnMount:             true,
      // Structural sharing avoids unnecessary re-renders when data is referentially equal
      structuralSharing:          true,
    },
    mutations: {
      // Mutations are never retried by default — they may not be idempotent
      retry:      false,
      onError:    handleQueryError,
    },
  },
};

export const queryClient = new QueryClient(queryClientConfig);

// Attach global query error handler after client creation
queryClient.getQueryCache().subscribe((event) => {
  if (event.type === 'observerResultsUpdated') {
    const query = event.query;
    if (query.state.status === 'error') {
      handleQueryError(query.state.error);
    }
  }
});