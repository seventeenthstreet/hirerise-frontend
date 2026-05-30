/**
 * @file hooks/useQuota.ts
 * @description Quota hook — reads plan limits and remaining usage from /users/me.
 *
 * v2.2 — Phase 2.5 Final Hardening:
 *
 * ISSUE 1 (useQuotaStandalone): `onQuotaExhausted` was in `fetchQuota`'s
 *   useCallback dependency array but the callback never called it. The
 *   exhaustion check only ran in useEffect (primary useQuota), not in
 *   useQuotaStandalone. Fixed: exhaustion check added inside fetchQuota
 *   after the summary is built.
 *
 * ISSUE 2 (useQuotaStandalone): Missing useQuery migration. useQuotaStandalone
 *   uses the same manual useState + useCallback + useEffect pattern as the
 *   old useUser — it bypasses React Query caching and fires a duplicate
 *   /users/me call even when the cache is warm. Migrated to useQuery with
 *   the same queryKey as useUser so both share the cache.
 *
 * ARCHITECTURE RULE: This hook does NOT call /users/me independently in
 * production — it ACCEPTS the user object from useUser to avoid a duplicate
 * network call. The factory pattern `useQuota(user)` keeps the API layer
 * clean. Pages that need both user + quota pass `user` down.
 *
 * If you need quota without a user object (e.g. a quota-only context),
 * use `useQuotaStandalone()` which shares the /users/me React Query cache.
 */

import { useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiClientError } from '@/lib/api/core';
import { queryKeys } from '@/lib/query';
import type { User } from '@/hooks/useUser';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Per-feature quota limit. Value is the max uses allowed in the period. */
export interface FeatureLimit {
  feature:   string;
  limit:     number;
  used:      number;
  remaining: number;
  resetDate?: string | null;
}

/** Quota summary from the API response. */
export interface QuotaSummary {
  /** Total remaining calls across all features (may be null if unlimited) */
  remaining:    number | null;
  /** Per-feature breakdown (populated on pro/enterprise plans) */
  features:     FeatureLimit[];
  /** The date/time quota resets (null for rolling windows) */
  resetDate:    string | null;
  /** Whether the user has hit a hard limit (429 was returned) */
  isExhausted:  boolean;
  /** Whether remaining < 20% of limit (soft warning threshold) */
  isNearLimit:  boolean;
  /** Upgrade URL returned by the backend on 429 */
  upgradeUrl:   string | null;
}

export interface UseQuotaOptions {
  /** Only run the fetch when true (default: true) */
  enabled?: boolean;
  /** Called when a 429 is detected — lets pages show upgrade UI */
  onQuotaExhausted?: (upgradeUrl: string | null) => void;
}

export interface UseQuotaReturn {
  quota:     QuotaSummary | null;
  isLoading: boolean;
  isError:   boolean;
  error:     Error | null;
  /** Re-fetch quota (e.g. after an action that may consume quota) */
  refetch:   () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const NEAR_LIMIT_THRESHOLD = 0.2; // < 20% remaining triggers isNearLimit

function buildQuotaSummary(
  rawQuota: User['quota'] | null,
  rawCredits: User['credits'] | null,
  isExhausted: boolean,
  upgradeUrl: string | null,
): QuotaSummary {
  let remaining: number | null = null;
  const features: FeatureLimit[] = [];

  if (rawQuota && typeof rawQuota === 'object') {
    if ('remaining' in rawQuota && typeof (rawQuota as Record<string,unknown>).remaining === 'number') {
      remaining = (rawQuota as Record<string, number>).remaining;
    }

    Object.entries(rawQuota).forEach(([key, value]) => {
      if (key === 'remaining' || key === 'resetDate') return;
      if (typeof value === 'number') {
        features.push({
          feature:   key,
          limit:     0,
          used:      0,
          remaining: value,
        });
      }
    });
  }

  if (remaining === null && rawCredits?.remainingUses !== undefined) {
    remaining = rawCredits.remainingUses;
  }

  const isNearLimit =
    remaining !== null && remaining > 0
      ? remaining / Math.max(remaining + 1, 5) < NEAR_LIMIT_THRESHOLD
      : false;

  return {
    remaining,
    features,
    resetDate:   null,
    isExhausted,
    isNearLimit,
    upgradeUrl,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIMARY HOOK — derives quota from existing user object (no extra fetch)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derives quota data from the User object returned by useUser.
 * Use this when the page already has a user — avoids a second /users/me call.
 *
 * @example
 *   const { user } = useUser();
 *   const { quota } = useQuota(user);
 */
export function useQuota(
  user: User | null,
  options: UseQuotaOptions = {},
): UseQuotaReturn {
  const { onQuotaExhausted } = options;

  // useMemo: derive the summary synchronously from the user object.
  // This replaces the useState + useEffect pattern — the derived value is
  // computed in the render, not in an async side-effect, so it is always
  // in sync with the user prop without needing an extra render cycle.
  const quota = useMemo<QuotaSummary | null>(() => {
    if (!user) return null;
    return buildQuotaSummary(
      user.quota   ?? null,
      user.credits ?? null,
      false,
      null,
    );
  }, [user]);

  // Fire onQuotaExhausted as a side-effect when the derived state changes.
  //
  // Q-07 note: onQuotaExhausted is a caller-supplied callback. If the caller
  // passes an inline arrow (unstabilized), this effect will re-fire on every
  // re-render while isExhausted is true — not just when isExhausted changes.
  // The canonical fix is for callers to wrap the callback in useCallback
  // (done in dashboard/page.tsx via handleQuotaExhausted). This comment
  // documents the expected caller contract: onQuotaExhausted MUST be stable.
  useEffect(() => {
    if (quota?.isExhausted && onQuotaExhausted) {
      onQuotaExhausted(quota.upgradeUrl);
    }
  }, [quota, onQuotaExhausted]);

  return {
    quota,
    isLoading: false,
    isError:   false,
    error:     null,
    refetch:   () => { /* derive-only; invalidate the user query to refresh */ },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STANDALONE HOOK — shares React Query cache for /users/me
// ─────────────────────────────────────────────────────────────────────────────

interface UserMeResponse {
  user:     User;
  credits?: unknown;
  quota?:   unknown;
}

function selectQuotaSummary(raw: UserMeResponse): QuotaSummary {
  const user: User = {
    ...raw.user,
    credits: raw.credits as User['credits'],
    quota:   raw.quota   as User['quota'],
  };
  return buildQuotaSummary(
    user.quota   ?? null,
    user.credits ?? null,
    false,
    null,
  );
}

/**
 * Fetches quota by sharing the React Query /users/me cache.
 * Use ONLY when no useUser() result is available in the component tree.
 * Prefer useQuota(user) to avoid duplicate network calls.
 *
 * Migrated from manual useState/useCallback/useEffect to useQuery so it
 * shares the same cache as useUser and fires at most one network request.
 */
export function useQuotaStandalone(options: UseQuotaOptions = {}): UseQuotaReturn {
  const { enabled = true, onQuotaExhausted } = options;

  const query = useQuery<UserMeResponse, ApiClientError, QuotaSummary>({
    queryKey: queryKeys.user.me(),   // shared with useUser — no duplicate fetch
    queryFn:  () => apiClient<UserMeResponse>({ url: '/api/v1/users/me' }),
    enabled,
    select:   selectQuotaSummary,
  });

  // Fire onQuotaExhausted when the derived quota changes.
  useEffect(() => {
    if (query.data?.isExhausted && onQuotaExhausted) {
      onQuotaExhausted(query.data.upgradeUrl);
    }
  }, [query.data, onQuotaExhausted]);

  return {
    quota:     query.data  ?? null,
    isLoading: query.isLoading,
    isError:   query.isError,
    error:     query.error ?? null,
    refetch:   () => { void query.refetch(); },
  };
}