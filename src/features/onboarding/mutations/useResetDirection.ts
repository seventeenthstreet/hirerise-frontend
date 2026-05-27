/**
 * @file src/features/onboarding/mutations/useResetDirection.ts
 *
 * PHASE 2 — MUTATION OWNERSHIP CONSOLIDATION
 *
 * Canonical location for the reset-direction mutation.
 *
 * OWNERSHIP MOVE:
 *   Previously at: hooks/mutations/useResetDirection.ts
 *   Now owned by:  features/onboarding/mutations/useResetDirection.ts
 *
 * COMPATIBILITY:
 *   hooks/mutations/useResetDirection.ts is kept as a re-export bridge.
 *   All existing consumers continue to import from '@/hooks/mutations'
 *   without any change.
 *
 * PRESERVED:
 *   ✅ Same API contract: DELETE /api/v1/users/me/direction
 *   ✅ retry: false (DELETE is not idempotent from a UX perspective)
 *   ✅ Empty onSuccess intentionally — see inline comment for the race
 *      condition rationale (refreshUser() is the authoritative update path)
 *   ✅ Same ResetDirectionResponse type shape
 */

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiClientError } from '@/lib/api/core';
import type { ResetDirectionResponse } from '@/features/onboarding/types';

export type { ResetDirectionResponse };

export function useResetDirection() {
  return useMutation<ResetDirectionResponse, ApiClientError, void>({
    mutationFn: () =>
      apiClient<ResetDirectionResponse>({
        url:    '/api/v1/users/me/direction',
        method: 'DELETE',
      }),

    // Do not retry a DELETE — it is not idempotent from a UX perspective.
    // A failed reset should surface the error immediately.
    retry: false,

    onSuccess: () => {
      // Intentionally empty — see hooks/mutations/useResetDirection.ts for
      // the full rationale. In brief:
      //
      // The onboarding page calls refreshUser() immediately after mutateAsync()
      // resolves. refreshUser() → fetchUser() → GET /users/me → setUser() in
      // AppContext. That is the authoritative update path.
      //
      // Adding invalidateQueries(['user','me']) here would fire a second
      // concurrent GET /users/me. Whichever response arrives second would
      // overwrite the first. In the worst case the stale response (with
      // user_type still set) would arrive after refreshUser's response,
      // re-populating user_type in the cache and triggering a re-render that
      // sets alreadyHasDirection=true on /direction — showing the spinner forever.
    },
  });
}
