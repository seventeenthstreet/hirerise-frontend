// hooks/admin/useAdminJobFamilies.ts

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { adminService } from '@/services/adminService';
import type {
  CreateJobFamilyDto,
  UpdateJobFamilyDto,
} from '@/types/admin';
import type { CmsQueryParams } from '@/types/api';
import toast from 'react-hot-toast';

function normalizeCmsParams(params: CmsQueryParams = {}) {
  return Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null)
      .sort(([a], [b]) => a.localeCompare(b))
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return fallback;
}

export const jobFamilyKeys = {
  all: () => ['admin', 'job-families'] as const,
  list: (params: CmsQueryParams = {}) =>
    [...jobFamilyKeys.all(), 'list', normalizeCmsParams(params)] as const,
  detail: (id: string) =>
    [...jobFamilyKeys.all(), 'detail', id] as const,
};

export function useAdminJobFamilies(params: CmsQueryParams = {}) {
  const normalizedParams = normalizeCmsParams(params);

  return useQuery({
    queryKey: jobFamilyKeys.list(normalizedParams),
    queryFn: () => adminService.listJobFamilies(normalizedParams),
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useCreateJobFamily() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateJobFamilyDto) =>
      adminService.createJobFamily(data),

    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: jobFamilyKeys.all(),
      });
      toast.success('Job family created.');
    },

    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, 'Failed to create job family.')),
  });
}

export function useUpdateJobFamily() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateJobFamilyDto;
    }) => adminService.updateJobFamily(id, data),

    onSuccess: async (_, { id }) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: jobFamilyKeys.all() }),
        qc.invalidateQueries({ queryKey: jobFamilyKeys.detail(id) }),
      ]);

      toast.success('Job family updated.');
    },

    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, 'Failed to update job family.')),
  });
}

export function useDeleteJobFamily() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      adminService.deleteJobFamily(id),

    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: jobFamilyKeys.all(),
      });
      toast.success('Job family deleted.');
    },

    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, 'Failed to delete job family.')),
  });
}