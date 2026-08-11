/**
 * @file hooks/admin/useAdminUsers.ts
 * @description React Query hooks for the Admin User Directory.
 * WP-ADMIN-04 Phase 1B (read-only); first mutation added by WP-ADMIN-04E.
 *
 * RESPONSIBILITIES:
 *  - Wrap listAdminUsers/getAdminUser in useQuery
 *  - Wrap updateAdminUserRole in useMutation, with cache invalidation
 *  - Apply the same retry strategy as the rest of the app (shouldRetry / retryDelay)
 *
 * HARD RULES (mirrors the rest of the hooks layer):
 *  - NO UI logic here — callers (pages/components) own loading/success/error rendering
 *  - NO direct fetch/axios — always through lib/api/adminUsers
 *  - Errors surface as ApiClientError — branch on `err.category` in the UI
 *
 * Copied 1:1 from useAdminCmsSkills.ts's query/mutation shape per that
 * file's own "REUSE NOTE", swapping the API module and query-key leaf.
 * useUpdateAdminUserRole() mirrors useUpdateAdminSkill() exactly: PATCH is
 * idempotent so transient failures retry, and success invalidates both the
 * list (role column shown in the directory table) and that user's detail
 * cache — no manual cache writes, no optimistic update.
 *
 * Architecture position: Hooks layer
 *   API (lib/api/adminUsers) → Hooks (this file) → UI (pages/admin)
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listAdminUsers,
  getAdminUser,
  updateAdminUserRole,
  updateAdminUserProfile,
  updateAdminUserAccountStatus,
  getAdminUserAuditHistory,
  type AdminUserDetail,
  type AdminUserRole,
  type AdminUserAccountAction,
  type AdminUserAuditEvent,
  type ListAdminUsersParams,
  type ListAdminUsersResponse,
  type UpdateAdminUserProfileInput,
} from '@/lib/api/adminUsers';
import type { ApiClientError } from '@/lib/api/core';
import { shouldRetry, retryDelay, queryKeys } from '@/lib/query';

// ─────────────────────────────────────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch one page of the users list, server-filtered by search and
 * server-paginated via offset/limit. Re-fetches automatically whenever
 * `params` changes (new query key).
 */
export function useAdminUsersList(params: ListAdminUsersParams) {
  return useQuery<ListAdminUsersResponse, ApiClientError>({
    queryKey: queryKeys.adminMasterData.users.list(params as Record<string, unknown>),
    queryFn: () => listAdminUsers(params),
    retry: (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
    placeholderData: (previousData: ListAdminUsersResponse | undefined) => previousData, // keep old page visible while the next page loads
  });
}

/** Fetch a single user's detail (User Detail page). Disabled until a userId is provided. */
export function useAdminUserDetail(userId: string | null) {
  return useQuery<AdminUserDetail, ApiClientError>({
    queryKey: queryKeys.adminMasterData.users.detail(userId ?? ''),
    queryFn: () => getAdminUser(userId as string),
    enabled: Boolean(userId),
    retry: (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MUTATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * WP-ADMIN-04E — Update a user's application role. Invalidates both the
 * users list and that user's detail cache on success, mirroring
 * useUpdateAdminSkill() in useAdminCmsSkills.ts.
 */
export function useUpdateAdminUserRole() {
  const queryClient = useQueryClient();

  return useMutation<AdminUserDetail, ApiClientError, { userId: string; role: AdminUserRole }>({
    mutationFn: ({ userId, role }) => updateAdminUserRole(userId, role),
    // PATCH is idempotent — safe to retry transient failures.
    retry: (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminMasterData.users.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminMasterData.users.detail(updated.id) });
    },
  });
}

/**
 * WP-ADMIN-COMP-04 — Edit Profile. Same idempotent-PATCH / dual-invalidate
 * shape as useUpdateAdminUserRole() above.
 */
export function useUpdateAdminUserProfile() {
  const queryClient = useQueryClient();

  return useMutation<AdminUserDetail, ApiClientError, { userId: string; fields: UpdateAdminUserProfileInput }>({
    mutationFn: ({ userId, fields }) => updateAdminUserProfile(userId, fields),
    retry: (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminMasterData.users.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminMasterData.users.detail(updated.id) });
    },
  });
}

/**
 * WP-ADMIN-COMP-04 — Enable/Disable Account. Not idempotent-retried by
 * default the way the PATCH mutations above are — a network-level retry of
 * a status change the server actually already applied is a bigger surprise
 * for a security-sensitive action than for a role/profile edit, so this
 * uses the library default (no automatic retry) rather than shouldRetry().
 */
export function useUpdateAdminUserAccountStatus() {
  const queryClient = useQueryClient();

  return useMutation<AdminUserDetail, ApiClientError, { userId: string; action: AdminUserAccountAction }>({
    mutationFn: ({ userId, action }) => updateAdminUserAccountStatus(userId, action),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminMasterData.users.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminMasterData.users.detail(updated.id) });
    },
  });
}

/**
 * WP-ADMIN-COMP-04 — View User Audit History. Disabled until a userId is
 * provided, same convention as useAdminUserDetail() above.
 */
export function useAdminUserAuditHistory(userId: string | null, limit = 50) {
  return useQuery<{ items: AdminUserAuditEvent[] }, ApiClientError>({
    queryKey: queryKeys.adminMasterData.users.auditHistory(userId ?? '', limit),
    queryFn: () => getAdminUserAuditHistory(userId as string, limit),
    enabled: Boolean(userId),
    retry: (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
  });
}
