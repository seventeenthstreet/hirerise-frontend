/**
 * @file hooks/admin/useAdminCmsSkills.ts
 * @description React Query hooks for the Admin CMS Skills module (WP-ADMIN-02A).
 *
 * RESPONSIBILITIES:
 *  - Wrap listAdminSkills/getAdminSkill in useQuery
 *  - Wrap create/update/delete in useMutation, with cache invalidation
 *  - Apply the same retry strategy as the rest of the app (shouldRetry / retryDelay)
 *
 * HARD RULES (mirrors the rest of the hooks layer):
 *  - NO UI logic here — callers (pages/components) own loading/success/error rendering
 *  - NO direct fetch/axios — always through lib/api/adminCmsSkills
 *  - Errors surface as ApiClientError — branch on `err.category` in the UI
 *
 * REUSE NOTE: this is the reference hook set for WP-ADMIN-02A. Roles / Career
 * Domains / Skill Clusters (WP-ADMIN-02B/C/D) should copy this file's shape
 * 1:1, swapping the API module and query-key leaf.
 *
 * Architecture position: Hooks layer
 *   API (lib/api/adminCmsSkills) → Hooks (this file) → UI (pages/master-data)
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listAdminSkills,
  getAdminSkill,
  createAdminSkill,
  updateAdminSkill,
  deleteAdminSkill,
  type AdminSkill,
  type ListAdminSkillsParams,
  type ListAdminSkillsResponse,
  type CreateAdminSkillInput,
  type UpdateAdminSkillInput,
  type DeleteAdminSkillResponse,
} from '@/lib/api/adminCmsSkills';
import type { ApiClientError } from '@/lib/api/core';
import { shouldRetry, retryDelay, queryKeys } from '@/lib/query';

// ─────────────────────────────────────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch one page of the skills list, server-filtered by search/category and
 * server-paginated via offset/limit. Re-fetches automatically whenever
 * `params` changes (new query key).
 */
export function useAdminSkillsList(params: ListAdminSkillsParams) {
  return useQuery<ListAdminSkillsResponse, ApiClientError>({
    queryKey: queryKeys.adminMasterData.skills.list(params as Record<string, unknown>),
    queryFn:  () => listAdminSkills(params),
    retry:    (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
    placeholderData: (previousData: ListAdminSkillsResponse | undefined) => previousData, // keep old page visible while the next page loads
  });
}

/** Fetch a single skill's detail (view/edit drawer). Disabled until a skillId is provided. */
export function useAdminSkillDetail(skillId: string | null) {
  return useQuery<AdminSkill, ApiClientError>({
    queryKey: queryKeys.adminMasterData.skills.detail(skillId ?? ''),
    queryFn:  () => getAdminSkill(skillId as string),
    enabled:  Boolean(skillId),
    retry:    (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MUTATIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Create a skill. Invalidates the list so the new row appears on next render. */
export function useCreateAdminSkill() {
  const queryClient = useQueryClient();

  return useMutation<AdminSkill, ApiClientError, CreateAdminSkillInput>({
    mutationFn: (input) => createAdminSkill(input),
    // Non-idempotent (creates a new row) — never auto-retry.
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminMasterData.skills.all() });
    },
  });
}

/** Update a skill. Invalidates both the list and that skill's detail cache. */
export function useUpdateAdminSkill() {
  const queryClient = useQueryClient();

  return useMutation<AdminSkill, ApiClientError, { skillId: string; input: UpdateAdminSkillInput }>({
    mutationFn: ({ skillId, input }) => updateAdminSkill(skillId, input),
    // PATCH is idempotent — safe to retry transient failures.
    retry:      (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminMasterData.skills.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminMasterData.skills.detail(updated.id) });
    },
  });
}

/** Archive (soft delete) a skill. Invalidates the list so the row drops out. */
export function useDeleteAdminSkill() {
  const queryClient = useQueryClient();

  return useMutation<DeleteAdminSkillResponse, ApiClientError, string>({
    mutationFn: (skillId) => deleteAdminSkill(skillId),
    retry: false, // deleting an already-archived record 404s — don't retry blindly
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminMasterData.skills.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminMasterData.skills.detail(result.skillId) });
    },
  });
}