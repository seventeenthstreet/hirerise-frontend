/**
 * @file src/lib/query/queryClient.ts
 * @description Shared QueryClient instance and configuration.
 *
 * DESIGN DECISIONS:
 *  - Single QueryClient exported as a singleton — safe for Next.js App Router
 *    because it's imported at module level and shared across the client bundle.
 *  - `throwOnError: false` everywhere — we handle errors in hooks, never let
 *    React Query's error boundary catch API errors (they're ApiClientError, not
 *    unhandled exceptions).
 *  - `retry` uses a custom predicate that skips retries for 4xx errors — there
 *    is no point retrying auth/validation/not-found failures.
 *  - `staleTime` matches CACHE_TTL_MS in useMetrics (2 min) so React Query's
 *    cache and the existing instance cache expire on the same cadence. When
 *    useMetrics is fully migrated to useQuery, CACHE_TTL_MS can be removed.
 *  - `gcTime` (formerly cacheTime) is set to 5 min — gives users navigating
 *    back to a page an instant warm render before the background refetch lands.
 *  - `refetchOnWindowFocus` is set to FALSE (FIX 3 — Phase 1 Auth Stabilization).
 *    The previous value of `true` caused request storms whenever the user
 *    switched browser tabs or returned to the window, firing authenticated
 *    requests (including /app-entry and /users/me) before the session was
 *    guaranteed to be valid. Individual hooks that genuinely need focus-refetch
 *    can opt in by passing `refetchOnWindowFocus: true` to their useQuery call.
 *
 * ARCHITECTURE POSITION: Infrastructure (below API layer)
 *   QueryClient → API → Hooks → UI → Pages → Guards → Context
 */

import { QueryClient } from '@tanstack/react-query';
import { isApiClientError } from '@/lib/api/core';

// Phase 3B — Retry exhaustion telemetry.
// Imported lazily at the point of use to avoid a circular dependency
// (observability → queryClient → observability). The dynamic import is
// intentional: this is a non-critical side-effect path; if the module
// fails to load the retry predicate still returns correctly.
// We use a module-level lazy ref so the import only resolves once.
let _logEvent: ((e: unknown) => void) | null = null;
let _createEvent: ((i: unknown) => unknown) | null = null;

async function _loadObs(): Promise<void> {
  if (_logEvent) return;
  try {
    const obs = await import('@/lib/observability');
    _logEvent    = obs.logEvent    as (e: unknown) => void;
    _createEvent = obs.createEvent as (i: unknown) => unknown;
  } catch { /* observability unavailable — degrade silently */ }
}

// Pre-warm the import at module evaluation time so the first exhaustion
// event doesn't pay the dynamic import latency.
void _loadObs();

// ─────────────────────────────────────────────────────────────────────────────
// RETRY PREDICATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines whether React Query should retry a failed request.
 *
 * Rules:
 *  - 4xx errors (auth, validation, not_found, tier_gate, conflict) → NO retry.
 *    These are deterministic failures — retrying wastes bandwidth and confuses users.
 *  - Network / server (5xx) errors → YES, up to `maxRetries`.
 *    Transient backend issues resolve quickly; silent retry improves UX.
 *  - Unknown errors (non-ApiClientError) → YES, treat as transient.
 *
 * @param failureCount - Number of failed attempts so far (0-indexed).
 * @param error        - The thrown error (always ApiClientError in our stack).
 * @param maxRetries   - Cap passed by the caller (default: 2).
 */
export function shouldRetry(
  failureCount: number,
  error: unknown,
  maxRetries = 2,
): boolean {
  if (failureCount >= maxRetries) {
    // Phase 3B — Retry exhaustion telemetry.
    //
    // Previously silent: when all retry attempts were consumed the query
    // would fail with no observability event — retry storms and persistent
    // backend failures were invisible in monitoring.
    //
    // Fix: emit a warn-level 'QUERY_RETRY_EXHAUSTED' event so production
    // dashboards can alert on sustained backend failures or misbehaving
    // endpoints. The event is fire-and-forget — it never affects the
    // return value or the error propagation path.
    //
    // Lazy async: _logEvent / _createEvent are loaded once at module init.
    // The dynamic import is already resolved by the time any retry exhausts
    // (multiple network round-trips take longer than a dynamic import).
    try {
      if (_logEvent && _createEvent) {
        const category = isApiClientError(error) ? error.category : 'unknown';
        const status   = isApiClientError(error) ? error.status   : undefined;
        const message  = error instanceof Error  ? error.message  : String(error);
        _logEvent(_createEvent({
          type:    'api',
          name:    'QUERY_RETRY_EXHAUSTED',
          level:   'warn',
          context: { category, status, message, maxRetries },
        }));
      }
    } catch { /* never surface telemetry errors into the retry predicate */ }
    return false;
  }

  if (isApiClientError(error)) {
    // Never retry deterministic client errors.
    switch (error.category) {
      case 'auth':
      case 'validation':
      case 'not_found':
      case 'conflict':
      case 'tier_gate':
        return false;

      // Transient — retry.
      case 'network':
      case 'server':
      case 'system':
      default:
        return true;

      // rate_limit (429): do NOT retry by default.
      //
      // A 429 from the backend means the client is sending too many requests.
      // Silently retrying amplifies the problem — it produces a retry storm
      // that keeps the rate-limited endpoint busy and fills logs with
      // repeated [API RATE LIMITED] warnings.
      //
      // The global default is conservative: surface the 429 immediately.
      // Individual queries that have a safe Retry-After-aware retry strategy
      // (e.g. metrics polling) can override retry at the call site.
      //
      // retryDelay() already handles Retry-After correctly when a caller
      // does opt in — the back-off math is preserved.
      case 'rate_limit':
        return false;
    }
  }

  // Non-ApiClientError: treat as transient.
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// RETRY DELAY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exponential back-off with jitter, capped at 30 s.
 *
 * For rate-limit errors we respect the `retryAfter` hint from the backend.
 * For all other transient errors we use exponential back-off so burst
 * failures don't hammer the API in lockstep.
 *
 * Formula: min(base * 2^attempt + jitter, cap)
 *  - attempt 0 → ~1.0–1.5 s
 *  - attempt 1 → ~2.0–2.5 s
 *  - attempt 2 → ~4.0–4.5 s  (max we reach with default maxRetries=2)
 */
export function retryDelay(attempt: number, error: unknown): number {
  const CAP_MS   = 30_000;
  const BASE_MS  = 1_000;
  const jitter   = Math.random() * 500;

  if (isApiClientError(error) && error.isRateLimit && error.retryAfter) {
    // Backend explicitly told us how long to wait.
    return Math.min(error.retryAfter * 1_000, CAP_MS);
  }

  return Math.min(BASE_MS * Math.pow(2, attempt) + jitter, CAP_MS);
}

// ─────────────────────────────────────────────────────────────────────────────
// STALE / CACHE TIMES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How long a query result is considered "fresh".
 * Matches CACHE_TTL_MS in useMetrics (2 min) for consistent staleness semantics.
 * Once useMetrics is fully migrated, its internal TTL can be removed.
 */
export const QUERY_STALE_TIME = 2 * 60 * 1_000; // 2 minutes

/**
 * How long React Query holds an unused query in memory after all observers
 * have unmounted. 5 min gives users navigating back to a page an instant
 * warm render before the background refetch completes.
 */
export const QUERY_GC_TIME = 5 * 60 * 1_000; // 5 minutes

// ─────────────────────────────────────────────────────────────────────────────
// QUERY CLIENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Singleton QueryClient.
 *
 * Defaults are set conservatively — individual queries can override them
 * by passing `queryOptions` to useQuery/useMutation.
 *
 * DEFAULT BEHAVIOUR SUMMARY:
 *  queryFn                → throws immediately if omitted (misconfiguration guard)
 *  staleTime              → 2 min  (data considered fresh)
 *  gcTime                 → 5 min  (cache retention after unmount)
 *  retry                  → 2 max, skip 4xx
 *  retryDelay             → exponential back-off with jitter
 *  refetchOnWindowFocus   → false  (FIX 3: disabled to prevent focus-triggered 401 storms)
 *  refetchOnReconnect     → true   (refresh after network restore)
 *  refetchOnMount         → true   (stale data triggers background refresh)
 *  throwOnError           → false  (never let errors bubble to Error Boundaries)
 *  networkMode            → 'online' (pause queries when offline)
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Safety guard: any useQuery call that omits queryFn will throw
      // immediately with a clear message instead of hanging silently.
      // Every real query overrides this with its own queryFn.
      queryFn: async () => {
        throw new Error('[QueryClient] No queryFn provided for this query. Did you forget to pass queryFn to useQuery?');
      },
      staleTime:            QUERY_STALE_TIME,
      gcTime:               QUERY_GC_TIME,
      retry:                shouldRetry,
      retryDelay:           retryDelay,
      // FIX 3 — Phase 1 Auth Stabilization:
      // Disabled to prevent focus-triggered request storms.
      // Previously `true`, which caused every tab-switch or window-focus event
      // to re-fire all active queries — including /app-entry and /users/me —
      // before the Supabase session was guaranteed to be loaded, producing 401s.
      // Hooks that genuinely need focus-revalidation can opt in individually
      // by passing refetchOnWindowFocus: true to their own useQuery call.
      refetchOnWindowFocus: false,
      refetchOnReconnect:   true,
      refetchOnMount:       true,
      throwOnError:         false,
      networkMode:          'online',
    },
    mutations: {
      retry:       false, // Mutations are not safe to auto-retry (non-idempotent)
      throwOnError: false,
    },
  },
});