// features/admin/cms/skill-clusters/hooks/useSkillClusters.ts
//
// TanStack Query hooks for the Admin Skill Clusters CMS.

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { adminService } from '@/services/adminService';
import type { CreateSkillClusterDto, UpdateSkillClusterDto } from '@/types/admin';
import type { CmsQueryParams } from '@/types/api';
import toast from 'react-hot-toast';

export const skillClusterKeys = {
  all:    () => ['admin', 'skill-clusters'] as const,
  list:   (params: CmsQueryParams) => [...skillClusterKeys.all(), 'list', params] as const,
  detail: (id: string) => [...skillClusterKeys.all(), 'detail', id] as const,
};

export function useAdminSkillClusters(params: CmsQueryParams = {}) {
  return useQuery({
    queryKey:        skillClusterKeys.list(params),
    queryFn:         () => adminService.listSkillClusters(params),
    staleTime:       2 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useAdminSkillCluster(id: string | null) {
  return useQuery({
    queryKey: skillClusterKeys.detail(id ?? ''),
    queryFn:  () => adminService.getSkillCluster(id!),
    enabled:  !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateSkillCluster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSkillClusterDto) => adminService.createSkillCluster(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: skillClusterKeys.all() });
      toast.success('Skill cluster created successfully.');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to create skill cluster.');
    },
  });
}

export function useUpdateSkillCluster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSkillClusterDto }) =>
      adminService.updateSkillCluster(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: skillClusterKeys.all() });
      qc.invalidateQueries({ queryKey: skillClusterKeys.detail(id) });
      toast.success('Skill cluster updated successfully.');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to update skill cluster.');
    },
  });
}

export function useDeleteSkillCluster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminService.deleteSkillCluster(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: skillClusterKeys.all() });
      toast.success('Skill cluster deleted.');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to delete skill cluster.');
    },
  });
}
