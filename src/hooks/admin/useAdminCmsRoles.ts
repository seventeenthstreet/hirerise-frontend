/**
 * @file hooks/admin/useAdminCmsRoles.ts
 * @description React Query hooks for the Admin CMS Roles module (WP-ADMIN-COMP-03).
 * Shape copied 1:1 from useAdminCmsSkills.ts per its reuse note.
 *
 * No delete hook — the backend has no DELETE route for CMS Roles.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listAdminCmsRoles,
  createAdminCmsRole,
  updateAdminCmsRole,
  type AdminCmsRole,
  type ListAdminCmsRolesParams,
  type ListAdminCmsRolesResponse,
  type CreateAdminCmsRoleInput,
  type UpdateAdminCmsRoleInput,
} from '@/lib/api/adminCmsRoles';
import type { ApiClientError } from '@/lib/api/core';
import { shouldRetry, retryDelay, queryKeys } from '@/lib/query';

export function useAdminCmsRolesList(params: ListAdminCmsRolesParams) {
  return useQuery<ListAdminCmsRolesResponse, ApiClientError>({
    queryKey: queryKeys.adminMasterData.roles.list(params as Record<string, unknown>),
    queryFn:  () => listAdminCmsRoles(params),
    retry:    (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
    placeholderData: (previousData: ListAdminCmsRolesResponse | undefined) => previousData,
  });
}

export function useCreateAdminCmsRole() {
  const queryClient = useQueryClient();
  return useMutation<AdminCmsRole, ApiClientError, CreateAdminCmsRoleInput>({
    mutationFn: (input) => createAdminCmsRole(input),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminMasterData.roles.all() });
    },
  });
}

export function useUpdateAdminCmsRole() {
  const queryClient = useQueryClient();
  return useMutation<AdminCmsRole, ApiClientError, { roleId: string; input: UpdateAdminCmsRoleInput }>({
    mutationFn: ({ roleId, input }) => updateAdminCmsRole(roleId, input),
    retry:      (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminMasterData.roles.all() });
    },
  });
}
