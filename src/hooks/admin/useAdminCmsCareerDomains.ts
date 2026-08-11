/**
 * @file hooks/admin/useAdminCmsCareerDomains.ts
 * @description React Query hooks for the Admin CMS Career Domains module (WP-ADMIN-COMP-03).
 * The backend list endpoint returns a plain array with no search/pagination.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listAdminCareerDomains,
  createAdminCareerDomain,
  updateAdminCareerDomain,
  deleteAdminCareerDomain,
  type AdminCareerDomain,
  type CreateAdminCareerDomainInput,
  type UpdateAdminCareerDomainInput,
} from '@/lib/api/adminCmsCareerDomains';
import type { ApiClientError } from '@/lib/api/core';
import { shouldRetry, retryDelay, queryKeys } from '@/lib/query';

/** Fetch every career domain. Small, non-paginated catalog — safe to load in full. */
export function useAdminCareerDomainsList() {
  return useQuery<AdminCareerDomain[], ApiClientError>({
    queryKey: queryKeys.adminMasterData.careerDomains.list(),
    queryFn:  () => listAdminCareerDomains(),
    retry:    (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
  });
}

export function useCreateAdminCareerDomain() {
  const queryClient = useQueryClient();
  return useMutation<AdminCareerDomain, ApiClientError, CreateAdminCareerDomainInput>({
    mutationFn: (input) => createAdminCareerDomain(input),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminMasterData.careerDomains.all() });
    },
  });
}

export function useUpdateAdminCareerDomain() {
  const queryClient = useQueryClient();
  return useMutation<AdminCareerDomain, ApiClientError, { id: string; input: UpdateAdminCareerDomainInput }>({
    mutationFn: ({ id, input }) => updateAdminCareerDomain(id, input),
    retry:      (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminMasterData.careerDomains.all() });
    },
  });
}

export function useDeleteAdminCareerDomain() {
  const queryClient = useQueryClient();
  return useMutation<null, ApiClientError, string>({
    mutationFn: (id) => deleteAdminCareerDomain(id),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminMasterData.careerDomains.all() });
      // Skill Clusters embeds a domainId relationship to Career Domains.
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminMasterData.skillClusters.all() });
    },
  });
}
