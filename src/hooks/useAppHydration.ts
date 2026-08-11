/**
 * hooks/useAppHydration.ts
 *
 * Network call primitives used by AppContext's boot sequence.
 *
 * RISK-02 (Phase 2 governance): Extracted from context/AppContext.tsx.
 *
 * BEFORE: AppContext called apiClient('/api/v1/users/me') and native fetch()
 *   for '/api/v1/app-entry' directly inside the context body. This placed
 *   network logic inside the context layer — a violation of the governance
 *   boundary that says all network access belongs in hooks or lib/api.
 *   The app-entry fetch also bypassed the lib/api transport stack entirely
 *   (no parser, no error normalisation), making it invisible to monitoring.
 *
 * AFTER: This hook owns both network primitives. AppContext imports and calls
 *   them. The auth lifecycle orchestration (onAuthStateChange, hydrate(), all
 *   race-condition guards) remains in AppContext — that logic is tightly coupled
 *   to React state setters and cannot be safely extracted without regressions.
 *
 * OWNERSHIP BOUNDARY:
 *   This hook is AppContext infrastructure. It is NOT a general-purpose hook.
 *   Do not call it from pages, features, or other hooks.
 *   If other hooks need user data, use useUser().
 *
 * RUNTIME BEHAVIOUR: unchanged. Both functions are extracted verbatim from
 *   AppContext — no semantic changes, no new network calls.
 *
 * AS-01 (Phase 3A Step 4):
 *   fetchUser now accepts an optional AbortSignal. AppContext threads its
 *   per-hydration AbortController signal into fetchUser so that the
 *   /users/me network request is cancelled when:
 *     - the AppProvider unmounts (component-level cancellation)
 *     - SIGNED_OUT fires while a hydration cycle is in flight
 *     - a newer auth event supersedes the current generation
 *   Previously the `cancelled` flag in hydrate() prevented *state writes*
 *   after unmount, but the TCP request and subsequent setQueryData cache
 *   write continued to completion — a latent orphan network request.
 *   With the signal threaded through, the browser aborts the request at
 *   the transport layer, removing the orphan entirely.
 *
 *   warmAppEntry already had its own internal AbortController (H-01 timeout).
 *   It now ALSO accepts an external signal so AppContext can abort the
 *   cache-warm request on unmount — closing the second network request
 *   that could continue after component teardown.
 */

import { useCallback } from 'react';
import { apiClient } from '@/lib/api/client';
import { isApiClientError } from '@/lib/api/core/api-error';
import { queryClient } from '@/lib/query';
import { queryKeys } from '@/lib/query';
import type { User } from '@/hooks/useUser';

// Phase 3B — Auth hydration failure observability.
// Imported directly (not lazily) because this hook is a client component
// and the observability module has no circular dependency risk here.
import { logEvent, createEvent } from '@/lib/observability';

// ─────────────────────────────────────────────────────────────────────────────
// SENTINEL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Thrown by fetchUser() when /users/me responds with 429 (rate_limit).
 *
 * WHY A SENTINEL INSTEAD OF RETURNING NULL:
 *   Returning null from fetchUser() signals "no profile yet" (e.g. new OAuth
 *   user), which is a valid success path. hydrate() in AppContext sees null,
 *   reaches its finally block, and calls setIsHydrated(true) — completing
 *   hydration with user=null. AuthCallbackPage then treats null user as an
 *   auth failure and redirects to /auth/login.
 *
 *   A 429 is NOT a profile-absent signal — the user exists, the server is
 *   just overloaded. We need hydrate() to catch this, skip setIsError() (it's
 *   transient), and also skip setIsHydrated(true) (hydration didn't succeed).
 *   The next TOKEN_REFRESHED from Supabase retries the full cycle cleanly.
 *
 * AppContext catches this in hydrate()'s catch block via instanceof check and
 * handles it as a transient no-op: no isError, no isHydrated flip.
 */
export class RateLimitHydrationError extends Error {
  constructor() {
    super('fetchUser: /users/me returned 429 (rate_limit) — hydration deferred');
    this.name = 'RateLimitHydrationError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface UseAppHydrationReturn {
  /**
   * Fetches /api/v1/users/me and seeds the React Query cache.
   *
   * Returns the hydrated User on success, or null if:
   *  - The backend returns 404 (no profile row yet — new OAuth user)
   *  - The response envelope has no user field (data:null from backend)
   *
   * Sets isError=true via the provided setter on non-404 network failures
   * ONLY when source is 'initial' or 'login'. TOKEN_REFRESHED failures
   * (source='refresh') are treated as transient and do NOT set isError —
   * this prevents a temporary token renewal blip from permanently redirecting
   * the user to /login despite holding a valid session.
   *
   * Accepts an optional accessToken to avoid a redundant getSession() call
   * when the session is already available from the auth state change handler.
   *
   * AS-01: Accepts an optional AbortSignal. When provided, the underlying
   * /users/me fetch and subsequent setQueryData are cancelled if the signal
   * fires. Callers that do not supply a signal continue to work unchanged.
   */
  fetchUser: (
    accessToken?: string,
    source?: 'initial' | 'login' | 'refresh',
    signal?: AbortSignal,
  ) => Promise<User | null>;

  /**
   * Fires a fire-and-forget GET /api/v1/app-entry to warm the server-side
   * session cache before the /users/me call.
   *
   * Uses native fetch() rather than apiClient because the response body is
   * intentionally discarded (it carries no client-meaningful data). The body
   * must be consumed to release the TCP connection — see inline comment.
   *
   * Never throws — network failures are silently absorbed.
   *
   * AS-01: Accepts an optional external AbortSignal in addition to the
   * internal 5-second timeout controller. When both are provided, whichever
   * fires first aborts the fetch. The external signal comes from AppContext's
   * hydration AbortController so unmount cancels the warm request.
   */
  warmAppEntry: (accessToken: string, signal?: AbortSignal) => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Provides the two network primitives used by AppContext's hydration sequence.
 *
 * USAGE (AppContext only):
 *   const { fetchUser, warmAppEntry } = useAppHydration({ setUser, setIsError });
 *
 *   // Inside hydrate() — pass the per-hydration AbortController signal:
 *   await warmAppEntry(session.access_token, controller.signal);
 *   await fetchUser(session.access_token, source, controller.signal);
 */
export function useAppHydration({
  setUser,
  setIsError,
}: {
  setUser: (user: User | null) => void;
  setIsError: (v: boolean) => void;
}): UseAppHydrationReturn {

  // AS-01: fetchUser accepts an optional AbortSignal so AppContext's hydrate()
  // can cancel the in-flight /users/me request on unmount or SIGNED_OUT.
  //
  // Previously the `cancelled` local variable in AppContext's hydrate() only
  // prevented *state writes* after unmount — the network request itself
  // continued to completion. With a threaded AbortSignal, the browser cancels
  // the underlying TCP request when the signal fires, eliminating the orphan
  // network request and the subsequent setQueryData cache write that would
  // otherwise occur even after SIGNED_OUT cleared the cache.
  //
  // Abort handling: apiClient propagates the signal to the underlying fetch.
  // When the signal fires mid-flight, apiClient rejects with an AbortError.
  // The catch block below handles this — AbortError is caught explicitly before
  // the general error path so no state mutation occurs on cancellation.
  //
  // BACKWARD COMPATIBILITY: signal is optional — callers that don't supply
  // one (e.g. refreshUser in AppContext) continue to work unchanged.
  const fetchUser = useCallback(async (
    accessToken?: string,
    source?: 'initial' | 'login' | 'refresh',
    signal?: AbortSignal,
  ): Promise<User | null> => {
    try {
      // CACHE-BUSTING FIX: For initial boot and login, add Cache-Control: no-cache
      // so the browser does not replay a cached response or send If-None-Match.
      //
      // THE BUG WITHOUT THIS:
      //   On a repeat visit (user previously logged in), the browser holds the
      //   ETag from the last GET /users/me response in its HTTP cache. After
      //   SIGNED_IN fires, fetchUser calls GET /users/me — the browser
      //   automatically adds If-None-Match with the stored ETag. If the user's
      //   data hasn't changed (common: same device, same session, short gap),
      //   the backend returns 304 No Content. apiRequest returns undefined.
      //   fetchUser sees !payload?.user → returns null → AppContext sets user=null.
      //   page.tsx: !user → getSession() → session exists → router.replace('/direction').
      //   direction/page.tsx: user_type IS set in the DB (from a prior session) but
      //   user in memory is null → alreadyHasDirection=false → shows direction selector.
      //   User is presented with a direction re-selection they already completed.
      //
      // FIX: Cache-Control: no-cache tells the browser to revalidate with the
      // server rather than using the cached response. The server still uses its
      // own ETag/freshness logic, but the response body is always returned
      // (no 304 short-circuit at the browser cache layer).
      //
      // Scope: ONLY for 'initial' and 'login' sources. 'refresh' (TOKEN_REFRESHED)
      // is excluded — it fires frequently and the 304 behavior is desirable there
      // (avoids unnecessary payload transfers when user data hasn't changed).
      // Build headers as Record<string, string> to satisfy ApiClientConfig type.
      // Cache-Control: no-cache bypasses the browser HTTP cache on initial/login
      // fetches so a cached ETag never produces a 304 that fetchUser misreads
      // as "no profile" and nulls the user state.
      const headers: Record<string, string> = {};
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
      if (source === 'initial' || source === 'login') headers['Cache-Control'] = 'no-cache';

      const payload = await apiClient<{ user: User; credits?: unknown; quota?: unknown }>({
        url: '/api/v1/users/me',
        headers,
        ...(signal ? { signal } : {}),
      });

      // WP-AV-02E — Log: immediately after the API request succeeds.
      // NOTE: apiClient() already unwraps the backend's {success, data} envelope,
      // so `payload` here is the equivalent of `response.data` from the wire —
      // i.e. { user, credits, quota }.
      console.log("[Hydration] API", payload);

      // A null/missing `user` field in a successful response means the backend
      // returned data:null — this is the same semantic as a 404: the Supabase
      // session exists but no backend profile row has been created yet.
      // Treat it as "authenticated, no profile" → page.tsx routes to /direction.
      //
      // DO NOT set isError=true here. isError sends the user to /login, but
      // they have a valid session, so Supabase keeps firing TOKEN_REFRESHED →
      // hydrate() → fetchUser() → this branch → isError=true → /login again.
      // That produces the infinite / ↔ /login redirect loop.
      if (!payload?.user) {
        return null;
      }

      const user: User = {
        ...payload.user,
        credits: payload.credits as User['credits'],
        quota:   payload.quota   as User['quota'],
      };

      // WP-AV-02E — Log: immediately after mapping the response into the
      // application user model.
      console.log("[Hydration] mapped user", user);

      // AS-01: Guard state writes and cache writes against late-arriving abort.
      // apiClient will throw AbortError if the signal fires during the await,
      // so execution normally won't reach here after abort. However, a signal
      // can fire in the microtask between apiClient resolution and this line
      // (e.g. SIGNED_OUT fires immediately after the response body is parsed).
      // This guard is the safety net that prevents a post-abort setUser() call
      // from writing stale session data after SIGNED_OUT has already cleared it.
      if (signal?.aborted) return null;

      setUser(user);

      // WP-AV-02E — Log: immediately after updating AppContext application
      // state. `user` is the exact value passed to setUser() above — logged
      // here (rather than after a subsequent render) because React state
      // updates are asynchronous and there is no synchronous "state.user"
      // to read immediately after the setter call.
      console.log("[AppContext] state", user);

      // DEDUP FIX — Seed the React Query cache with the payload we just fetched.
      //
      // WHY: useUser uses useQuery with enabled: isHydrated. When isHydrated
      // becomes true, React Query checks if ['user', 'me'] has a fresh cache
      // entry. Without this line, the cache is empty and React Query fires a
      // second GET /api/v1/users/me immediately — producing a duplicate request.
      //
      // setQueryData writes `payload` into the cache under the same key useUser
      // queries. useUser's selectUser() transform runs on this cached value, so
      // the consumer receives a correctly shaped User object — no network request.
      //
      // staleTime=2min (queryClient default): useUser treats this as fresh and
      // skips re-fetching for 2 minutes after boot.
      queryClient.setQueryData(queryKeys.user.me(), payload);

      return user;
    } catch (err) {
      // AS-01: AbortError means the signal fired — this is expected cancellation,
      // not an application error. Return null silently without touching any state.
      // This covers both the timeout-abort path (if warmAppEntry's internal
      // controller somehow affects this call) and the external signal path.
      if (err instanceof Error && err.name === 'AbortError') {
        // Phase 3B — Hydration cancellation observability.
        //
        // Previously silent: AbortError was absorbed with no event, making
        // SIGNED_OUT-during-hydration and unmount-during-hydration races
        // invisible in the observability timeline. When debugging reports of
        // users landing in unexpected states, the missing cancellation event
        // made it impossible to distinguish a cancelled hydration from a
        // never-started one.
        //
        // Fix: emit a system-level 'HYDRATION_CANCELLED' info event. This is
        // NOT an error — it is expected control-flow. Level is 'info' so it
        // appears in the timeline without triggering alert thresholds.
        try {
          logEvent(createEvent({
            type:    'system',
            name:    'HYDRATION_CANCELLED',
            level:   'info',
            context: { source },
          }));
        } catch { /* never surface observability errors */ }
        return null;
      }

      // status 404 means the backend has no profile for this user yet.
      // Expected for brand-new OAuth (Google) sign-ins — the Supabase user
      // exists but the backend row hasn't been created yet.
      // Treat as "authenticated, no profile" → page.tsx routes to /direction.
      if (isApiClientError(err) && err.status === 404) {
        return null;
      }

      // A-03 / E-03 — Transient refresh error guard.
      //
      // Problem:
      //   A transient TOKEN_REFRESHED network failure (e.g. brief server hiccup,
      //   race between old and new token) sets isError=true, which causes
      //   page.tsx to router.replace('/login'). This permanently redirects the
      //   user even though their Supabase session is still valid — the next
      //   TOKEN_REFRESHED will succeed, but the app is already in error state.
      //
      // Fix:
      //   Only set isError=true for non-transient sources ('initial', 'login').
      //   TOKEN_REFRESHED failures (source='refresh') are treated as transient
      //   instability — the session is presumed still valid and isError is NOT set.
      //   The user stays hydrated with their current user state. Supabase will
      //   fire another TOKEN_REFRESHED when the token next needs renewal.
      //
      // Terminal failure detection:
      //   Genuine invalid sessions produce a 401 on INITIAL_SESSION or SIGNED_IN
      //   (which use source='initial'/'login'). Those paths still set isError=true
      //   and redirect to /login as before. Only the refresh path is now resilient.
      //
      // No retry loop:
      //   We do not retry — Supabase manages the renewal schedule. Returning null
      //   from a refresh failure leaves the app in its current user state without
      //   touching isError, which is the correct safe default.
      if (source !== 'refresh') {
        // Phase 3B — Auth hydration failure observability.
        //
        // Previously: setIsError(true) redirected the user to /login with no
        // observability event. Auth failures on 'initial'/'login' sources were
        // invisible in monitoring — impossible to distinguish between a genuine
        // invalid session, a backend outage, and a network blip at session start.
        //
        // Fix: emit AUTH_HYDRATION_FAILED before setting the error flag so the
        // timeline and any registered external adapters (Sentry, Datadog) capture
        // the failure with enough context to diagnose the cause in production.
        // The event is fire-and-forget — it never affects error propagation.

        // RATE-LIMIT GUARD (429):
        //   A 429 on /users/me is a transient signal — the server is temporarily
        //   overwhelmed. Calling setIsError(true) here would transition the app
        //   into error state, clear isHydrated, and allow useUser's useQuery to
        //   re-fire the moment isHydrated flips back — producing a tight 429 storm.
        //
        //   We do NOT return null here: null means "no profile" (new OAuth user),
        //   which makes hydrate() call setIsHydrated(true) with user===null, causing
        //   AuthCallbackPage to redirect to /auth/login — breaking the login flow.
        //
        //   Instead throw RateLimitHydrationError. AppContext catches it in
        //   hydrate()'s catch block, skips setIsError AND setIsHydrated, and lets
        //   the next TOKEN_REFRESHED event retry the full cycle cleanly.
        const isRateLimit = isApiClientError(err) && err.category === 'rate_limit';
        if (isRateLimit) {
          throw new RateLimitHydrationError();
        }

        try {
          const category = isApiClientError(err) ? err.category : 'unknown';
          const status   = isApiClientError(err) ? err.status   : undefined;
          const message  = err instanceof Error  ? err.message  : String(err);
          logEvent(createEvent({
            type:    'error',
            name:    'AUTH_HYDRATION_FAILED',
            level:   'error',
            context: { source, category, status, message },
          }));
        } catch { /* never surface observability errors into the auth path */ }

        setIsError(true);
      }
      return null;
    }
  }, [setUser, setIsError]);

  // AS-01: warmAppEntry now accepts an optional external AbortSignal.
  // The internal timeout controller (H-01 fix) is combined with the external
  // signal so that unmount/sign-out cancels the warm request immediately,
  // rather than waiting up to 5 seconds for the internal timeout to fire.
  //
  // AbortSignal.any() (Baseline 2024, Node 20+) returns a new signal that
  // fires when any of its inputs fire. Where unavailable (older environments),
  // we fall back to the internal-only controller — the external signal is a
  // best-effort improvement, not a hard requirement. The internal timeout
  // still protects against TCP hangs.
  const warmAppEntry = useCallback(async (accessToken: string, externalSignal?: AbortSignal): Promise<void> => {
    // Fire-and-forget cache warm — bypass apiClient to avoid parse noise.
    // The response body MUST be consumed (even for 304/empty) to prevent the
    // HTTP connection from stalling and blocking the subsequent fetchUser() call.
    //
    // Background: a 304 response has no body, but calling .text() is safe —
    // it resolves to '' and releases the TCP connection. Without this drain,
    // a 304 can hold the connection open and cause fetchUser() to stall.
    //
    // H-01 TIMEOUT FIX:
    //   `await warmAppEntry()` can block indefinitely on a TCP hang — a stalled
    //   connection that never resolves and never rejects. Without a timeout the
    //   hydration sequence is permanently blocked: fetchUser() is never called,
    //   isHydrated stays false, and the app is deadlocked.
    //
    //   Fix: race the fetch against a 5-second AbortController timeout.
    //   - 5 s is generous for a cache-warm request; normal responses are <200 ms.
    //   - On timeout, the fetch is aborted and the error is absorbed (same as any
    //     other network failure). warmAppEntry is cache-warm only — the app
    //     continues to fetchUser() regardless of whether it succeeds.
    //   - AbortController is used rather than Promise.race + setTimeout so the
    //     browser cancels the underlying TCP request, preventing phantom drains.
    //
    //   Semantics preserved:
    //   - Still fire-and-forget from the caller's perspective.
    //   - Still absorbs all errors silently.
    //   - Does NOT retry — app-entry is opportunistic cache warming.
    //   - Does NOT affect fetchUser() — fetchUser has its own error handling.
    // COLD-START FIX: Reduce warmAppEntry timeout from 5s to 3s.
    //
    // The original 5s timeout caused the initial page load to take ~10s on a
    // cold backend (5s warmAppEntry timeout + ~5s fetchUser + compile time).
    // The spinner appeared frozen. warmAppEntry is fire-and-forget cache warming —
    // if it times out, fetchUser runs immediately and the app boots normally.
    // 3s is sufficient for a healthy backend (app-entry responds in ~200-963ms
    // from backend logs) and reduces the cold-start penalty by 2 seconds.
    const WARM_TIMEOUT_MS = 3_000;
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), WARM_TIMEOUT_MS);

    // AS-01: Combine the internal timeout signal with the optional external signal.
    // When the external signal fires (unmount / SIGNED_OUT), the fetch aborts
    // immediately. When only the timeout fires, behavior is identical to before.
    //
    // AbortSignal.any() is available in all modern browsers (Baseline 2024).
    // The conditional fallback preserves exact prior behavior in environments
    // that don't yet expose it — no new risk introduced.
    const combinedSignal: AbortSignal =
      externalSignal != null && typeof AbortSignal.any === 'function'
        ? AbortSignal.any([timeoutController.signal, externalSignal])
        : timeoutController.signal;

    // CORS FIX: Use a relative URL — goes to Next.js dev server (:3000),
    // proxied to backend via next.config.js. Absolute URL would be
    // cross-origin (port 3000 → port 3001) and fail with a CORS error.
    // NEXT_PUBLIC_API_BASE_URL is no longer used here.
    await fetch(`/api/v1/app-entry`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: combinedSignal,
    })
      .then(r => r.text())   // drain body unconditionally — see above
      .catch(() => {})       // network failures (incl. abort) are absorbed; app-entry is cache-warm only
      .finally(() => clearTimeout(timeoutId));
  }, []);

  return { fetchUser, warmAppEntry };
}