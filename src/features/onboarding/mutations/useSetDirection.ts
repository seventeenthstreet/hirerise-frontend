/**
 * @file src/features/onboarding/mutations/useSetDirection.ts
 *
 * PHASE 2 — MUTATION OWNERSHIP CONSOLIDATION
 *
 * Canonical location for the set-direction mutation.
 *
 * OWNERSHIP MOVE:
 *   Previously split across two files:
 *     - hooks/mutations/useSetDirection.ts  (raw useMutation return)
 *     - hooks/useDirection.ts               (legacy wrapper with isLoading/error return)
 *
 *   Both files wrap the same POST /api/v1/users/me/direction call with the
 *   same invalidation strategy and the same rate-limit retry exclusion.
 *   Owning this mutation here eliminates the duplicate mutation path and
 *   makes the canonical implementation findable under the feature module.
 *
 * COMPATIBILITY:
 *   This file contains the implementation. The legacy paths
 *   (hooks/mutations/useSetDirection, hooks/useDirection) are kept as
 *   re-export bridges during the transition period — they import from here.
 *
 * PRESERVED:
 *   ✅ Same API contract: POST /api/v1/users/me/direction
 *   ✅ Same retry predicate (rate_limit excluded)
 *   ✅ Same invalidation: user.me(), dashboard.all(), skillsPriority.all()
 *   ✅ Same synchronous cache patch (user_type from POST response)
 *   ✅ Same retryDelay from lib/query
 *   ✅ Legacy useDirection wrapper (hooks/useDirection.ts) untouched externally
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiClientError } from '@/lib/api/core';
import { isApiClientError } from '@/lib/api/core';
import { retryDelay, queryKeys } from '@/lib/query';
import type { SetDirectionInput, SetDirectionResponse } from '@/features/onboarding/types';

export type { SetDirectionInput, SetDirectionResponse };

// ─────────────────────────────────────────────────────────────────────────────
// RETRY PREDICATE
//
// Rate-limit (429) is excluded from retries for this mutation.
// A 429 on direction selection is a quota/rate gate — the user must see the
// error immediately. Retrying would produce a 429 storm.
// ─────────────────────────────────────────────────────────────────────────────

function shouldRetryDirection(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false;

  if (isApiClientError(error)) {
    switch ((error as ApiClientError).category) {
      case 'auth':
      case 'validation':
      case 'not_found':
      case 'conflict':
      case 'tier_gate':
      case 'rate_limit': // never retry rate_limit — prevents 429 storm
        return false;
      default:
        return true;
    }
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// RAW MUTATION HOOK
//
// Returns the full UseMutationResult — use this when callers need direct
// access to isPending, reset, data, etc. without the legacy isLoading wrapper.
// ─────────────────────────────────────────────────────────────────────────────

export function useSetDirection() {
  const queryClient = useQueryClient();

  return useMutation<SetDirectionResponse, ApiClientError, SetDirectionInput>({
    mutationFn: ({ direction }) =>
      apiClient<SetDirectionResponse>({
        url:    '/api/v1/users/me/direction',
        method: 'POST',
        data:   { direction },
      }),

    retry:      shouldRetryDirection,
    retryDelay: retryDelay,

    onSuccess: (result) => {
      // Synchronously patch user_type in the React Query cache.
      // invalidateQueries triggers an async refetch — the page's router.push
      // fires before that refetch completes, so the destination page's guard
      // (requireDirection checks user?.user_type) would see stale null.
      // Patching synchronously from the POST response's userType field ensures
      // guards on the next page see the correct value before router.push renders.
      if (result?.userType) {
        const current = queryClient.getQueryData<{ user?: Record<string, unknown> }>(
          queryKeys.user.me(),
        );
        if (current?.user) {
          queryClient.setQueryData(queryKeys.user.me(), {
            ...current,
            user: { ...current.user, user_type: result.userType },
          });
        }
      }

      void queryClient.invalidateQueries({ queryKey: queryKeys.user.me() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.skillsPriority.all() });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY WRAPPER — preserves the useDirection() return contract
//
// direction/page.tsx consumes useDirection() which returns { isLoading, error,
// setDirection }. We expose that contract here alongside the raw mutation so
// hooks/useDirection.ts can delegate here without reimplementing the logic.
// ─────────────────────────────────────────────────────────────────────────────

export interface UseDirectionReturn {
  isLoading:    boolean;
  error:        ApiClientError | null;
  setDirection: (direction: SetDirectionInput['direction']) => Promise<SetDirectionResponse>;
}

export function useDirection(): UseDirectionReturn {
  const mutation = useSetDirection();

  return {
    isLoading:    mutation.isPending,
    error:        mutation.error ?? null,
    setDirection: (direction) => mutation.mutateAsync({ direction }),
  };
}
