/**
 * hooks/useAppEntry.ts
 *
 * Calls GET /api/v1/app-entry on every authenticated app boot.
 * Purpose: seeds user profile, syncs display fields, warms Redis cache
 * (profile + CHI). Must resolve BEFORE any routing decision is made.
 *
 * Called once — result is not stored; the side-effect (cache warm) is
 * what matters. Page layer waits on isLoading before proceeding.
 *
 * ARCHITECTURE NOTE:
 *  AppContext already fires /app-entry via raw fetch during its boot sequence
 *  (before the React tree mounts). useAppEntry exists for components that need
 *  to re-trigger the side-effect after mount — e.g. after a user re-authenticates.
 *  If AppContext is the sole caller, this hook is a no-op (the cache has a fresh
 *  result and React Query will not fire a duplicate request within staleTime).
 *
 * v2 — React Query migration:
 *  Manual useEffect + useState replaced with useQuery.
 *  staleTime: 0  — always treat as stale so the side-effect fires on every mount.
 *  gcTime: 5 min — retain in cache long enough to deduplicate concurrent callers
 *                  in the same render cycle; avoids duplicate in-flight requests.
 *  retry: false  — a boot error should surface immediately without silent retries.
 *
 * DEDUP FIX — Hydration guard consolidation:
 *  Replaced the previous independent Supabase onAuthStateChange subscription +
 *  getSession() guard with a single isHydrated read from AppContext.
 *
 *  WHY THIS IS SAFER:
 *   - The old guard added a THIRD onAuthStateChange subscriber (AppContext has one,
 *     AuthListenerMount had one — now removed from layout). Every auth event
 *     (INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED) caused setHasSession(true) to
 *     flip the query's `enabled` flag, which re-triggered the queryFn even when
 *     AppContext had already called /app-entry moments earlier.
 *   - isHydrated is only set to true AFTER AppContext's full boot sequence
 *     (app-entry fetch → fetchUser → setQueryData) completes. Gating on it here
 *     means this query never races against AppContext and never fires a duplicate
 *     request at startup.
 *   - Token safety is preserved: isHydrated cannot become true unless
 *     AppContext confirmed a valid session and successfully called the backend.
 *
 *  SIGN-OUT CORRECTNESS:
 *   When the user signs out, AppContext sets isHydrated=true (with user=null and
 *   no session). This hook will fire a /app-entry request at that point, which
 *   the backend will reject with 401. retry: false means the error surfaces
 *   immediately and is not retried. The UI handles the 401 via isError.
 *   If that is undesirable, callers can pass { enabled: !!user } where user
 *   comes from useAppContext().
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { queryKeys } from '@/lib/query';
import { useAppContext } from '@/context/AppContext';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UseAppEntryReturn {
  isLoading: boolean;
  isError:   boolean;
  error:     Error | null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAppEntry(): UseAppEntryReturn {
  // Gate on AppContext hydration — the single canonical source of session truth.
  // This replaces the previous independent getSession() + onAuthStateChange()
  // guard which created a redundant third auth listener and caused the query to
  // re-enable (and re-fetch) on every Supabase auth event during boot.
  //
  // isHydrated is set to true only after AppContext completes its full boot
  // sequence: session confirmed → /app-entry fetched → /users/me fetched →
  // React Query cache seeded. Gating here ensures this hook is always a no-op
  // during the initial boot cycle when AppContext already handled everything.
  //
  // Additionally gate on user being non-null so a signed-out state (isHydrated
  // true but user null) does not fire an unauthenticated /app-entry request.
  const { isHydrated, user } = useAppContext();

  // ── Query ─────────────────────────────────────────────────────────────────
  const query = useQuery({
    queryKey: queryKeys.appEntry.all(),
    queryFn:  () => apiClient<void>({ url: '/api/v1/app-entry' }),

    // Only run after AppContext has fully hydrated AND a user profile exists.
    // This is equivalent to the old hasSession guard but without the side-effect
    // of creating an independent auth listener that fires on every auth event.
    enabled: isHydrated && user !== null,

    // Treat as stale only after gcTime (5 min) — not immediately (staleTime:0).
    //
    // WHY THIS CHANGES FROM staleTime:0:
    //   staleTime:0 means React Query considers the data stale the moment it
    //   arrives. Combined with refetchOnMount:true (the global default), this
    //   causes a new /app-entry request on EVERY component mount — including
    //   navigating back to a page that already fired it. This produced the
    //   duplicate [Auth] Verified path="/app-entry" entries in backend logs.
    //
    //   AppContext already fires /app-entry synchronously as a fire-and-forget
    //   during boot. useAppEntry exists for components that need to re-trigger
    //   the side-effect AFTER mount. With staleTime matching gcTime (5 min),
    //   the cache entry is fresh for the full retention window — no duplicate
    //   request fires within the same boot session.
    //
    //   The side-effect (Redis cache warm) fires once per boot via AppContext.
    //   Re-firing it on every page navigation provides no additional value and
    //   generates backend auth verification noise.
    staleTime: 5 * 60 * 1_000, // 5 min — matches gcTime; no refetch within session

    // Keep in cache for 5 minutes so concurrent callers in the same render cycle
    // share the single in-flight request rather than each firing their own.
    gcTime: 5 * 60 * 1_000,

    // Do not retry on failure — a boot error should surface immediately.
    retry: false,

    // Disable focus-triggered refetch. The app-entry endpoint is a boot
    // side-effect, not a polling target.
    refetchOnWindowFocus: false,
  });

  return {
    isLoading: query.isLoading,
    isError:   query.isError,
    error:     query.error as Error | null,
  };
}