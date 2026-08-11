/**
 * @file hooks/admin/useAdminCmsEducationLevels.ts
 * @description React Query hooks for the Admin CMS Education Levels module (WP-ADMIN-COMP-03).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listAdminEducationLevels,
  createAdminEducationLevel,
  updateAdminEducationLevel,
  deleteAdminEducationLevel,
  type AdminEducationLevel,
  type ListAdminEducationLevelsParams,
  type ListAdminEducationLevelsResponse,
  type CreateAdminEducationLevelInput,
  type UpdateAdminEducationLevelInput,
} from '@/lib/api/adminCmsEducationLevels';
import type { ApiClientError } from '@/lib/api/core';
import { shouldRetry, retryDelay, queryKeys } from '@/lib/query';

export function useAdminEducationLevelsList(params: ListAdminEducationLevelsParams) {
  return useQuery<ListAdminEducationLevelsResponse, ApiClientError>({
    queryKey: queryKeys.adminMasterData.educationLevels.list(params as Record<string, unknown>),
    queryFn:  () => listAdminEducationLevels(params),
    retry:    (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
    placeholderData: (previousData: ListAdminEducationLevelsResponse | undefined) => previousData,
  });
}

export function useCreateAdminEducationLevel() {
  const queryClient = useQueryClient();
  return useMutation<AdminEducationLevel, ApiClientError, CreateAdminEducationLevelInput>({
    mutationFn: (input) => createAdminEducationLevel(input),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminMasterData.educationLevels.all() });
    },
  });
}

export function useUpdateAdminEducationLevel() {
  const queryClient = useQueryClient();
  return useMutation<AdminEducationLevel, ApiClientError, { id: string; input: UpdateAdminEducationLevelInput }>({
    mutationFn: ({ id, input }) => updateAdminEducationLevel(id, input),
    retry:      (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminMasterData.educationLevels.all() });
    },
  });
}

export function useDeleteAdminEducationLevel() {
  const queryClient = useQueryClient();
  return useMutation<null, ApiClientError, string>({
    mutationFn: (id) => deleteAdminEducationLevel(id),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminMasterData.educationLevels.all() });
    },
  });
}
