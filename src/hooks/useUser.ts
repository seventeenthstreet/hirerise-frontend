/**
 * hooks/useUser.ts
 *
 * Fetches GET /api/v1/users/me — authenticated user profile + routing flags.
 * Called on every app boot; result gates all routing decisions.
 *
 * v3 — Phase 2.5 Final Hardening:
 *  BEFORE: manual useState + useEffect + useCallback — bypasses React Query
 *  cache deduplication, staleTime, and gcTime. Every consumer got its own
 *  in-flight request and its own loading state, causing duplicate /users/me
 *  calls on the same render cycle.
 *
 *  AFTER: useQuery with a stable selector. All consumers share a single
 *  cached result. No more manual fetch orchestration.
 *
 *  MIGRATION NOTE: The return shape is preserved (user, isLoading, isError,
 *  error, refetch) so all existing callers require no changes.
 *
 * FIX 2 — Phase 1 Auth Stabilization:
 *  Added AppContext hydration guard. The query is now blocked until
 *  AppContext has completed its own boot sequence (app-entry → users/me).
 *  This prevents /api/v1/users/me from firing before the app has a valid
 *  authenticated session, eliminating the 401s caused by early execution.
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { isApiClientError } from '@/lib/api/core';
import type { ApiClientError } from '@/lib/api/core';
import { queryKeys } from '@/lib/query';
import { useAppContext } from '@/context/AppContext';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QuotaMap {
  [feature: string]: number;
}

export interface User {
  id: string;
  name?: string;
  email?: string;
  user_type: 'student' | 'professional' | 'market' | null;
  // Onboarding flags
  onboarding_completed: boolean;
  student_onboarding_complete: boolean;
  professional_onboarding_complete: boolean;
  // Feature flags
  resume_uploaded: boolean;
  report_unlocked: boolean;
  // Subscription
  plan?: string;
  tier?: 'free' | 'pro' | 'enterprise';
  // Quota
  credits?: { remainingUses: number };
  quota?: QuotaMap;
  // Profile fields
  targetRole?: string;
  hasSkills?: boolean;
  hasTargetRole?: boolean;
}

/** Raw shape returned by GET /users/me */
interface UserMeResponse {
  user:     User;
  credits?: unknown;
  quota?:   unknown;
}

export interface UseUserOptions {
  /** Skip the fetch until this is true (default: true) */
  enabled?: boolean;
}

export interface UseUserReturn {
  user:      User | null;
  isLoading: boolean;
  isError:   boolean;
  error:     ApiClientError | null;
  /** Re-fetch and return the updated user */
  refetch:   () => void;
}

// ── Selector ──────────────────────────────────────────────────────────────────

/**
 * Stable selector — extracted outside the hook so the function reference never
 * changes between renders. React Query uses referential equality on select
 * functions; an inline arrow would create a new reference every render and
 * defeat the memoization that prevents unnecessary subscriber re-renders.
 *
 * RULE: All select functions must be defined at module level.
 * Inline selectors are forbidden — they break React Query's subscriber memoization.
 */
function selectUser(raw: UserMeResponse): User {
  // Assign envelope fields onto the user object directly rather than spreading.
  // Spreading always produces a new reference, causing React Query to notify
  // all useUser consumers on every background refetch even when data is unchanged.
  //
  // IMPORTANT: raw.user is safe to mutate because apiClient returns a fresh
  // JSON.parse object per response. Do NOT reuse this object across cache layers
  // or memoized stores — mutation here assumes single-owner semantics.
  const user = raw.user as User;
  user.credits = raw.credits as User['credits'];
  user.quota   = raw.quota   as User['quota'];

  // Freeze in development to catch any accidental downstream mutations early.
  // No-op in production — zero runtime cost in the shipped bundle.
  if (process.env.NODE_ENV === 'development') {
    Object.freeze(user);
  }

  return user;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useUser(options: UseUserOptions = {}): UseUserReturn {
  const { enabled = true } = options;

  // FIX 2: Read AppContext hydration state.
  // isHydrated is set to true by AppContext only after its boot sequence
  // (app-entry → users/me raw fetch) has completed. Blocking on isHydrated
  // here ensures this React Query-managed fetch does not race against the
  // AppContext boot fetch, eliminating duplicate in-flight /users/me requests
  // and the 401s they cause when the token is not yet available.
  const { isHydrated } = useAppContext();

  const query = useQuery<UserMeResponse, ApiClientError, User>({
    queryKey: queryKeys.user.me(),
    queryFn:  () => apiClient<UserMeResponse>({ url: '/api/v1/users/me' }),

    // FIX 2: Gate on both the caller-supplied enabled flag AND AppContext
    // hydration. Both must be true for the query to fire.
    // - `enabled`     — caller opt-out (preserved, no behaviour change for
    //                   callers that pass enabled: false explicitly).
    // - `isHydrated`  — AppContext boot gate (new guard, prevents early 401s).
    enabled: enabled && isHydrated,

    select:   selectUser,

    // ── Hydration-owned query governance ──────────────────────────────────
    //
    // useUser is hydration-governed: AppContext seeds the React Query cache via
    // setQueryData() before isHydrated flips true. The settings below document
    // and lock in the ownership boundary so no implicit global default can
    // undermine hydration stability.
    //
    // retry: explicit predicate — do not retry auth or rate_limit failures.
    //   auth (401)       — session expired; retrying sends the same bad token again.
    //   rate_limit (429) — backend signal; retrying causes a 429 storm.
    //   Other transient errors (network, server) get one retry (failureCount < 1).
    //
    // refetchOnWindowFocus: false — hydration-owned, not focus-polled.
    //   Window focus must not re-trigger /users/me outside of an auth event cycle.
    //   AppContext's onAuthStateChange is the authoritative trigger for user re-fetch.
    retry: (failureCount, error) => {
      if (failureCount >= 1) return false;
      if (isApiClientError(error)) {
        if (error.category === 'auth' || error.category === 'rate_limit') return false;
      }
      return true;
    },
    refetchOnWindowFocus: false,
  });

  return {
    user:      query.data  ?? null,
    isLoading: query.isLoading,
    isError:   query.isError,
    error:     query.error ?? null,
    refetch:   () => { void query.refetch(); },
  };
}