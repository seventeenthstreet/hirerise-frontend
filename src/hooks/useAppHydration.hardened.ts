/**
 * @file src/hooks/useAppHydration.hardened.ts
 *
 * PHASES 3, 4, 10 — Drop-in hardened replacement for hooks/useAppHydration.ts
 *
 * HOW TO ADOPT
 * ────────────
 * In hooks/useAppHydration.ts, replace the function body with this implementation.
 * The exported interface (UseAppHydrationReturn, fetchUser, warmAppEntry) is
 * identical — AppContext.tsx requires no changes.
 *
 * WHAT CHANGES vs. THE EXISTING HOOK
 * ────────────────────────────────────
 * 1. fetchUser wraps the apiClient call in withRetry() (Phases 3).
 *    - Retries: network, 5xx, timeout.
 *    - No retry: 401, 403, 422, AbortError (cancel).
 *    - Max 3 attempts, exponential backoff with jitter.
 *
 * 2. fetchUser is guarded by withHydrationTimeout() (Phase 4).
 *    - Hard 10-second deadline. After expiry, the in-flight request is
 *      cancelled and a HYDRATION_TIMEOUT event is emitted.
 *    - Hydration continues gracefully — isError is set, isHydrated resolves.
 *
 * 3. warmAppEntry timeout unchanged at 3 s (existing H-01 fix already handles this).
 *    External signal threading from AppContext is preserved.
 *
 * 4. Structured log events emitted at start/end of each fetchUser call (Phase 1).
 *    requestId header injected into every /users/me request (Phase 2).
 *
 * 5. Hydration duration measured and pushed to telemetry (Phase 10).
 *
 * PRESERVED (no regression)
 * ─────────────────────────
 * - Cache-busting no-cache headers on initial/login
 * - 404 → null (new OAuth user, no profile yet)
 * - source='refresh' failure isolation (no isError on transient refresh errors)
 * - AbortError swallowed cleanly (HYDRATION_CANCELLED event emitted)
 * - AS-01: external AbortSignal threading
 */

import { useCallback } from 'react';
import { apiClient }          from '@/lib/api/client';
import { isApiClientError }   from '@/lib/api/core/api-error';
import { queryClient, queryKeys } from '@/lib/query';
import type { User }          from '@/hooks/useUser';

import {
  logAuthEvent,
  AUTH_LOG_EVENTS,
  createHydrationIds,
  startTimer,
  endTimer,
  recordHydration,
  buildCorrelationHeaders,
  trackTelemetry,
} from '@/lib/observability/authLogger';
import {
  withRetry,
  withHydrationTimeout,
  classifyAuthError,
  FETCH_USER_TIMEOUT_MS,
} from '@/lib/auth/fetchUserResilient';

// Re-export the existing interface so call sites don't need to change imports
export interface UseAppHydrationReturn {
  fetchUser:    (accessToken?: string, source?: 'initial' | 'login' | 'refresh', signal?: AbortSignal) => Promise<User | null>;
  warmAppEntry: (accessToken: string, signal?: AbortSignal) => Promise<void>;
}

export function useAppHydration({
  setUser,
  setIsError,
}: {
  setUser:    (user: User | null) => void;
  setIsError: (v: boolean) => void;
}): UseAppHydrationReturn {

  const fetchUser = useCallback(async (
    accessToken?: string,
    source?: 'initial' | 'login' | 'refresh',
    externalSignal?: AbortSignal,
  ): Promise<User | null> => {

    // ── Phase 2: Correlation IDs ──────────────────────────────────────────
    const ids         = createHydrationIds();
    const hydrationTimer = startTimer('fetchUser');

    // ── Phase 1: Log start ────────────────────────────────────────────────
    logAuthEvent(AUTH_LOG_EVENTS.FETCH_USER_START, ids, { source });

    // ── Phase 4: Timeout controller ───────────────────────────────────────
    const timeoutController = new AbortController();

    // Combine external (unmount/SIGNED_OUT) + internal timeout signals
    const combinedSignal: AbortSignal =
      externalSignal != null && typeof AbortSignal.any === 'function'
        ? AbortSignal.any([externalSignal, timeoutController.signal])
        : timeoutController.signal;

    try {
      // ── Phase 3+4: Retry + Timeout wrapper ───────────────────────────────
      const payload = await withHydrationTimeout(
        async (signal) => {
          // Build request headers
          const headers: Record<string, string> = {
            // Phase 2: Inject correlation IDs so backend logs can join to frontend
            ...buildCorrelationHeaders(ids),
          };
          if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
          // Cache bust on initial/login to avoid 304 nulling the user state
          if (source === 'initial' || source === 'login') headers['Cache-Control'] = 'no-cache';

          // Phase 3: Retry wrapper around the apiClient call
          // Only retries on: network, 5xx, timeout
          // Never retries: 401, 403, 422, external AbortError
          return withRetry(
            () => apiClient<{ user: User; credits?: unknown; quota?: unknown }>({
              url: '/api/v1/users/me',
              headers,
              signal,
            }),
            {
              maxAttempts: source === 'refresh' ? 2 : 3, // fewer retries on token refresh
              baseDelayMs: 200,
              maxDelayMs:  8_000,
              signal,
              ids,
              spanName: 'fetchUser',
            },
          );
        },
        FETCH_USER_TIMEOUT_MS,
        timeoutController,
        ids,
        'fetchUser',
      );

      // ── Seed React Query cache (unchanged from original) ─────────────────
      if (payload?.user) {
        if (!combinedSignal.aborted) {
          queryClient.setQueryData(queryKeys.user.me(), {
            user:    payload.user,
            credits: payload.credits,
            quota:   payload.quota,
          });
          setUser(payload.user);
        }

        const durationMs = endTimer(hydrationTimer);
        recordHydration(durationMs);

        // Phase 10: log end with latency
        logAuthEvent(AUTH_LOG_EVENTS.FETCH_USER_END, ids, { source, durationMs, userId: payload.user.id });

        // Phase 8: track login telemetry
        if (source === 'login')   trackTelemetry('loginSuccess',  ids, { userId: payload.user.id });
        if (source === 'initial') trackTelemetry('loginSuccess',  ids, { source: 'initial' });

        return payload.user;
      }

      // No user in payload = new OAuth user (no profile yet)
      logAuthEvent(AUTH_LOG_EVENTS.FETCH_USER_END, ids, { source, result: 'no_profile' });
      return null;

    } catch (err) {

      // ── Cancellation (AbortError from unmount or SIGNED_OUT) ──────────────
      if (err instanceof Error && err.name === 'AbortError' && combinedSignal.aborted) {
        try {
          logAuthEvent(AUTH_LOG_EVENTS.HYDRATION_CANCELLED, ids, { source }, 'info');
        } catch { /* never surface */ }
        return null;
      }

      // ── 404 → new user, no profile (unchanged semantic) ──────────────────
      if (isApiClientError(err) && err.status === 404) {
        logAuthEvent(AUTH_LOG_EVENTS.FETCH_USER_END, ids, { source, result: 'not_found' });
        return null;
      }

      // ── Classify error (Phase 6) ──────────────────────────────────────────
      const classified = classifyAuthError(err);
      logAuthEvent(
        AUTH_LOG_EVENTS.FETCH_USER_ERROR,
        ids,
        {
          source,
          errorClass: classified.class,
          status:     classified.status,
          message:    classified.message,
          retryable:  classified.retryable,
        },
        'error',
      );

      // Phase 8: track bootstrap failure
      if (classified.class === 'backend' || classified.class === 'hydration') {
        trackTelemetry('bootstrapFailure', ids, { source, errorClass: classified.class });
      }

      // ── Transient refresh error — preserve existing guard ─────────────────
      // source='refresh' failures are transient; do NOT set isError or redirect
      if (source !== 'refresh') {
        // Phase 8: track login failure
        if (source === 'login') trackTelemetry('loginFailure', ids, { errorClass: classified.class });

        logAuthEvent(AUTH_LOG_EVENTS.AUTH_HYDRATION_FAILED, ids, {
          source,
          errorClass: classified.class,
          fatal:      classified.fatal,
        }, 'error');

        setIsError(true);
      }

      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setUser, setIsError]);


  // ── warmAppEntry — unchanged semantics, correlation headers added ─────────
  const warmAppEntry = useCallback(async (
    accessToken: string,
    externalSignal?: AbortSignal,
  ): Promise<void> => {
    const ids = createHydrationIds();
    logAuthEvent(AUTH_LOG_EVENTS.WARM_ENTRY_START, ids);

    const WARM_TIMEOUT_MS    = 3_000;
    const timeoutController  = new AbortController();
    const timeoutId          = setTimeout(() => timeoutController.abort(), WARM_TIMEOUT_MS);

    const combinedSignal: AbortSignal =
      externalSignal != null && typeof AbortSignal.any === 'function'
        ? AbortSignal.any([timeoutController.signal, externalSignal])
        : timeoutController.signal;

    const warmTimer = startTimer('warmAppEntry');

    await fetch('/api/v1/app-entry', {
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        // Phase 2: inject correlation headers into warm request too
        ...buildCorrelationHeaders(ids),
      },
      signal: combinedSignal,
    })
      .then(r => {
        const durationMs = endTimer(warmTimer);
        logAuthEvent(AUTH_LOG_EVENTS.WARM_ENTRY_END, ids, {
          status: r.status,
          durationMs,
        });
        return r.text(); // drain body — prevents TCP connection stall
      })
      .catch((err) => {
        const durationMs = endTimer(warmTimer);
        const classified = classifyAuthError(err);
        if (classified.class === 'timeout') {
          logAuthEvent(AUTH_LOG_EVENTS.WARM_ENTRY_TIMEOUT, ids, { durationMs }, 'warn');
        } else if (classified.class !== 'transport') {
          logAuthEvent(AUTH_LOG_EVENTS.WARM_ENTRY_ERROR, ids, {
            errorClass: classified.class,
            message:    classified.message,
            durationMs,
          }, 'warn');
        }
      })
      .finally(() => clearTimeout(timeoutId));
  }, []);

  return { fetchUser, warmAppEntry };
}