/**
 * @file src/hooks/mutations/useUpdateUser.ts
 * @description Mutation hook for PATCH /api/v1/users/me (user profile updates).
 *
 * v2.2 — Phase 2.5 Final Hardening:
 *  BEFORE: method: 'POST' — incorrect HTTP verb for a partial update.
 *    POST implies creating a new resource; PATCH is the correct semantic
 *    for a partial update to an existing resource. If the backend currently
 *    accepts POST, this is a latent contract bug — verify with the API owner
 *    and update the backend route to PATCH if needed.
 *
 *  AFTER: method: 'PATCH' — semantically correct for profile updates.
 *    If the backend is not yet accepting PATCH, coordinate the change.
 *    Do NOT route around this with POST — the contract matters for
 *    cache proxy behavior, logging, and idempotency guarantees.
 *
 * RESPONSIBILITIES:
 *  - Wrap user profile update in useMutation
 *  - Invalidate all affected queries on success
 *  - Apply consistent retry strategy (shouldRetry / retryDelay from queryClient.ts)
 *  - Surface structured ApiClientError to callers
 *
 * HARD RULES:
 *  - NO UI logic — callers handle loading / success / error states
 *  - NO direct fetch / axios — always through apiClient
 *  - Errors are ApiClientError instances — never rethrow as raw
 *
 * INVALIDATION STRATEGY:
 *  Updating the user profile may affect:
 *    1. queryKeys.user.me()             — profile fields change
 *    2. queryKeys.dashboard.all()       — hasTargetRole / hasSkills flags may flip
 *    3. queryKeys.careerHealth.all()    — CHI depends on target role + skills set
 *    4. queryKeys.skillsPriority.all()  — priority engine input changes when targetRole
 *                                        or skills update
 *    5. queryKeys.opportunities.all()   — opportunity matching is profile-driven
 *
 * Architecture position: Hooks layer (second tier)
 *   API → Hooks → UI → Pages → Guards → Context
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiClientError } from '@/lib/api/core';
import { shouldRetry, retryDelay, queryKeys } from '@/lib/query';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** All fields are optional — callers send only the fields they want to update. */
export interface UpdateUserInput {
  displayName?:  string;
  targetRoleId?: string;
  skills?:       string[];
  [key: string]: unknown;
}

export interface UpdateUserResponse {
  userId:    string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation<UpdateUserResponse, ApiClientError, UpdateUserInput>({
    mutationFn: (data) =>
      apiClient<UpdateUserResponse>({
        url:    '/api/v1/users/me',
        method: 'PATCH',  // ← was 'POST'; PATCH is correct for partial updates
        data,
      }),

    // PATCH is idempotent — retrying on transient failure is safe.
    // Explicit cap (2) prevents drift if the shouldRetry default ever changes.
    retry:      (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay: retryDelay,

    onSuccess: () => {
      // Current user record.
      void queryClient.invalidateQueries({ queryKey: queryKeys.user.me() });
      // Dashboard flags (hasTargetRole, hasSkills) depend on profile state.
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
      // CHI score depends on target role + skills being set.
      void queryClient.invalidateQueries({ queryKey: queryKeys.careerHealth.all() });
      // Skills priority engine uses targetRole + skills as primary inputs.
      void queryClient.invalidateQueries({ queryKey: queryKeys.skillsPriority.all() });
      // Opportunity matching is profile-driven (targetRole, skills, tier).
      void queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.all() });
    },
  });
}