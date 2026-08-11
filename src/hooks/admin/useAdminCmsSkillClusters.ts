/**
 * @file hooks/admin/useAdminCmsSkillClusters.ts
 * @description React Query hooks for the Admin CMS Skill Clusters module (WP-ADMIN-COMP-03).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listAdminSkillClusters,
  createAdminSkillCluster,
  updateAdminSkillCluster,
  deleteAdminSkillCluster,
  type AdminSkillCluster,
  type ListAdminSkillClustersParams,
  type ListAdminSkillClustersResponse,
  type CreateAdminSkillClusterInput,
  type UpdateAdminSkillClusterInput,
} from '@/lib/api/adminCmsSkillClusters';
import type { ApiClientError } from '@/lib/api/core';
import { shouldRetry, retryDelay, queryKeys } from '@/lib/query';

export function useAdminSkillClustersList(params: ListAdminSkillClustersParams) {
  return useQuery<ListAdminSkillClustersResponse, ApiClientError>({
    queryKey: queryKeys.adminMasterData.skillClusters.list(params as Record<string, unknown>),
    queryFn:  () => listAdminSkillClusters(params),
    retry:    (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
    placeholderData: (previousData: ListAdminSkillClustersResponse | undefined) => previousData,
  });
}

export function useCreateAdminSkillCluster() {
  const queryClient = useQueryClient();
  return useMutation<AdminSkillCluster, ApiClientError, CreateAdminSkillClusterInput>({
    mutationFn: (input) => createAdminSkillCluster(input),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminMasterData.skillClusters.all() });
    },
  });
}

export function useUpdateAdminSkillCluster() {
  const queryClient = useQueryClient();
  return useMutation<AdminSkillCluster, ApiClientError, { id: string; input: UpdateAdminSkillClusterInput }>({
    mutationFn: ({ id, input }) => updateAdminSkillCluster(id, input),
    retry:      (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminMasterData.skillClusters.all() });
    },
  });
}

export function useDeleteAdminSkillCluster() {
  const queryClient = useQueryClient();
  return useMutation<null, ApiClientError, string>({
    mutationFn: (id) => deleteAdminSkillCluster(id),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminMasterData.skillClusters.all() });
    },
  });
}
