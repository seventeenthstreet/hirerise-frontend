/**
 * @file hooks/admin/useAdminCmsJobFamilies.ts
 * @description React Query hooks for the Admin CMS Job Families module (WP-ADMIN-COMP-03).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listAdminJobFamilies,
  createAdminJobFamily,
  updateAdminJobFamily,
  deleteAdminJobFamily,
  type AdminJobFamily,
  type ListAdminJobFamiliesParams,
  type ListAdminJobFamiliesResponse,
  type CreateAdminJobFamilyInput,
  type UpdateAdminJobFamilyInput,
} from '@/lib/api/adminCmsJobFamilies';
import type { ApiClientError } from '@/lib/api/core';
import { shouldRetry, retryDelay, queryKeys } from '@/lib/query';

export function useAdminJobFamiliesList(params: ListAdminJobFamiliesParams) {
  return useQuery<ListAdminJobFamiliesResponse, ApiClientError>({
    queryKey: queryKeys.adminMasterData.jobFamilies.list(params as Record<string, unknown>),
    queryFn:  () => listAdminJobFamilies(params),
    retry:    (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
    placeholderData: (previousData: ListAdminJobFamiliesResponse | undefined) => previousData,
  });
}

export function useCreateAdminJobFamily() {
  const queryClient = useQueryClient();
  return useMutation<AdminJobFamily, ApiClientError, CreateAdminJobFamilyInput>({
    mutationFn: (input) => createAdminJobFamily(input),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminMasterData.jobFamilies.all() });
    },
  });
}

export function useUpdateAdminJobFamily() {
  const queryClient = useQueryClient();
  return useMutation<AdminJobFamily, ApiClientError, { id: string; input: UpdateAdminJobFamilyInput }>({
    mutationFn: ({ id, input }) => updateAdminJobFamily(id, input),
    retry:      (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminMasterData.jobFamilies.all() });
    },
  });
}

export function useDeleteAdminJobFamily() {
  const queryClient = useQueryClient();
  return useMutation<null, ApiClientError, string>({
    mutationFn: (id) => deleteAdminJobFamily(id),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminMasterData.jobFamilies.all() });
    },
  });
}
