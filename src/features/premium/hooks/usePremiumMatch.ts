/**
 * @file src/features/premium/hooks/usePremiumMatch.ts
 * @description TanStack Query hook for the WP-13B Premium Match feature.
 *
 * RESPONSIBILITIES:
 *  - Expose a mutation (triggerMatch) for running a new premium match
 *  - Expose a query (latestMatch) for reading the most recent result
 *  - Manage loading, error, and caching states
 *  - Invalidate the latest-match query after a successful mutation
 *
 * HARD RULES:
 *  - NO UI logic — pure data + state management
 *  - NO direct fetch/axios — only through premiumMatch.api.ts
 *  - Errors surface as ApiClientError instances — never raw
 *  - No mock data, no hardcoded values
 */

import { useCallback, useState }      from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { triggerPremiumMatch, getLatestMatch }   from '../api/premiumMatch.api';
import type { MatchResult }                      from '../types';
import type { ApiClientError }                   from '@/lib/api/core';

// ─────────────────────────────────────────────────────────────────────────────
// QUERY KEYS
// Scoped to the premium feature. Follows the same hierarchy as queryKeys.ts.
//
//   ['premium', 'match', 'latest', resumeId]
// ─────────────────────────────────────────────────────────────────────────────

export const premiumQueryKeys = {
  all:    ()          => ['premium', 'match'] as const,
  latest: (resumeId: string) => ['premium', 'match', 'latest', resumeId] as const,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// HOOK RETURN TYPE
// ─────────────────────────────────────────────────────────────────────────────

export interface UsePremiumMatchReturn {
  /** Trigger a new premium match analysis. Deducts credits. */
  triggerMatch: (resumeId: string) => Promise<MatchResult>;
  /** True while the mutation is in flight. */
  isRunning:    boolean;
  /** Error from the most recent mutation attempt. */
  triggerError: ApiClientError | null;
  /** Result from the most recent successful mutation. */
  matchResult:  MatchResult | null;

  /** Latest persisted match result for a given resumeId. */
  latestMatch:       MatchResult | undefined;
  isLoadingLatest:   boolean;
  latestError:       ApiClientError | null;
  /** Load the latest analysis for a specific resumeId. */
  fetchLatest:       (resumeId: string) => void;
  /** Currently watched resumeId for latest query. */
  watchedResumeId:   string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// STALE TIME
// Latest result is considered fresh for 5 minutes.
// A new triggerMatch always invalidates it.
// ─────────────────────────────────────────────────────────────────────────────

const LATEST_STALE_TIME = 5 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function usePremiumMatch(): UsePremiumMatchReturn {
  const queryClient = useQueryClient();
  const [watchedResumeId, setWatchedResumeId] = useState<string | null>(null);

  // ── Mutation: trigger a new analysis ──────────────────────────────────────
  const mutation = useMutation<MatchResult, ApiClientError, string>({
    mutationFn: (resumeId: string) => triggerPremiumMatch({ resumeId }),
    onSuccess: (data) => {
      // Cache the result immediately under the latest key
      queryClient.setQueryData(
        premiumQueryKeys.latest(data.resumeId),
        data,
      );
      // Invalidate so the query refetches on next mount if needed
      queryClient.invalidateQueries({
        queryKey: premiumQueryKeys.latest(data.resumeId),
      });
    },
  });

  const triggerMatch = useCallback(
    (resumeId: string): Promise<MatchResult> => {
      setWatchedResumeId(resumeId);
      return mutation.mutateAsync(resumeId);
    },
    [mutation],
  );

  // ── Query: latest analysis ─────────────────────────────────────────────────
  const latestQuery = useQuery<MatchResult, ApiClientError>({
    queryKey:    watchedResumeId ? premiumQueryKeys.latest(watchedResumeId) : ['premium', 'match', 'latest', '__none__'],
    queryFn:     ({ queryKey, signal }) => {
      const resumeId = queryKey[3] as string;
      return getLatestMatch(resumeId, signal);
    },
    enabled:     !!watchedResumeId,
    staleTime:   LATEST_STALE_TIME,
    retry:       (failureCount, error) => {
      // Don't retry 404 (no analysis yet) or 402 (payment required)
      const status = (error as ApiClientError)?.status;
      if (status === 404 || status === 402) return false;
      return failureCount < 2;
    },
  });

  const fetchLatest = useCallback((resumeId: string) => {
    setWatchedResumeId(resumeId);
  }, []);

  return {
    // Mutation
    triggerMatch,
    isRunning:    mutation.isPending,
    triggerError: mutation.error ?? null,
    matchResult:  mutation.data ?? null,

    // Latest query
    latestMatch:       latestQuery.data,
    isLoadingLatest:   latestQuery.isLoading,
    latestError:       latestQuery.error ?? null,
    fetchLatest,
    watchedResumeId,
  };
}
