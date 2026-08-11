/**
 * @file hooks/admin/useAdministrators.ts
 * @description React Query hooks for Enterprise Administrator Management (WP-ADMIN-05A).
 *
 * RESPONSIBILITIES:
 *  - Wrap listAdministrators/getAdministrator in useQuery
 *  - Wrap grant/suspend/reactivate/revoke in useMutation, with cache invalidation
 *  - Apply the same retry strategy as the rest of the app (shouldRetry / retryDelay)
 *
 * HARD RULES (mirrors hooks/admin/useAdminUsers.ts):
 *  - NO lifecycle logic here — every mutation is a pass-through to
 *    lib/api/administrators.ts, which calls the backend's Administrator
 *    Management API, which itself only ever calls the certified
 *    Administrator Lifecycle repository.
 *  - NO direct fetch/axios — always through lib/api/administrators
 *  - Errors surface as ApiClientError — branch on `err.category` in the UI
 *
 * Mutations are NOT retried automatically (unlike the idempotent PATCH in
 * useAdminUsers.ts's useUpdateAdminUserRole): grant/suspend/reactivate/revoke
 * are lifecycle transitions guarded by the certified state machine, and a
 * transient-looking failure could just as easily be an already-applied
 * transition — silently retrying could double-fire an audit event for no
 * behavioural gain. The UI surfaces the error and lets the admin retry
 * deliberately instead.
 *
 * Architecture position: Hooks layer
 *   API (lib/api/administrators) → Hooks (this file) → UI (pages/admin)
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listAdministrators,
  getAdministrator,
  grantAdministrator,
  suspendAdministrator,
  reactivateAdministrator,
  revokeAdministrator,
  type AdministratorDetail,
  type AdministratorRole,
  type ListAdministratorsParams,
  type ListAdministratorsResponse,
} from '@/lib/api/administrators';
import type { ApiClientError } from '@/lib/api/core';
import { shouldRetry, retryDelay, queryKeys } from '@/lib/query';

// ─────────────────────────────────────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch one page of the Administrator directory, server-filtered by
 * search/status and server-paginated via offset/limit.
 */
export function useAdministratorsList(params: ListAdministratorsParams) {
  return useQuery<ListAdministratorsResponse, ApiClientError>({
    queryKey: queryKeys.adminAdministrators.list(params as Record<string, unknown>),
    queryFn: () => listAdministrators(params),
    retry: (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
    placeholderData: (previousData: ListAdministratorsResponse | undefined) => previousData,
  });
}

/** Fetch one Administrator's detail (identity, lifecycle, audit history). Disabled until a uid is provided. */
export function useAdministratorDetail(uid: string | null) {
  return useQuery<AdministratorDetail, ApiClientError>({
    queryKey: queryKeys.adminAdministrators.detail(uid ?? ''),
    queryFn: () => getAdministrator(uid as string),
    enabled: Boolean(uid),
    retry: (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MUTATIONS
// ─────────────────────────────────────────────────────────────────────────────

function invalidateAdministrator(queryClient: ReturnType<typeof useQueryClient>, uid: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.adminAdministrators.all() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.adminAdministrators.detail(uid) });
}

/** Grant Administrator access — creates a new principal or re-activates an existing one. */
export function useGrantAdministrator() {
  const queryClient = useQueryClient();

  return useMutation<AdministratorDetail, ApiClientError, { uid: string; role: AdministratorRole }>({
    mutationFn: ({ uid, role }) => grantAdministrator(uid, role),
    onSuccess: (updated) => invalidateAdministrator(queryClient, updated.uid),
  });
}

/** Suspend an active Administrator (reversible via reactivate). */
export function useSuspendAdministrator() {
  const queryClient = useQueryClient();

  return useMutation<AdministratorDetail, ApiClientError, { uid: string; reason?: string }>({
    mutationFn: ({ uid, reason }) => suspendAdministrator(uid, reason),
    onSuccess: (updated) => invalidateAdministrator(queryClient, updated.uid),
  });
}

/** Reactivate a suspended Administrator. */
export function useReactivateAdministrator() {
  const queryClient = useQueryClient();

  return useMutation<AdministratorDetail, ApiClientError, { uid: string }>({
    mutationFn: ({ uid }) => reactivateAdministrator(uid),
    onSuccess: (updated) => invalidateAdministrator(queryClient, updated.uid),
  });
}

/** Revoke an Administrator's access permanently (terminal). */
export function useRevokeAdministrator() {
  const queryClient = useQueryClient();

  return useMutation<AdministratorDetail, ApiClientError, { uid: string }>({
    mutationFn: ({ uid }) => revokeAdministrator(uid),
    onSuccess: (updated) => invalidateAdministrator(queryClient, updated.uid),
  });
}
