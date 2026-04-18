// hooks/admin/useAdminEducationLevels.ts

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { adminService } from '@/services/adminService';
import type {
  CreateEducationLevelDto,
  UpdateEducationLevelDto,
} from '@/types/admin';
import type { CmsQueryParams } from '@/types/api';
import toast from 'react-hot-toast';

// hooks/admin/useAdminEducationLevels.ts

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

export const educationLevelKeys = {
  all: () => ['admin', 'education-levels'] as const,
  list: (params: CmsQueryParams = {}) =>
    [...educationLevelKeys.all(), 'list', normalizeCmsParams(params)] as const,
};

export function useAdminEducationLevels(params: CmsQueryParams = {}) {
  const normalizedParams = normalizeCmsParams(params);

  return useQuery({
    queryKey: educationLevelKeys.list(normalizedParams),
    queryFn: () => adminService.listEducationLevels(normalizedParams),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useCreateEducationLevel() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateEducationLevelDto) =>
      adminService.createEducationLevel(data),
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: educationLevelKeys.all(),
      });
      toast.success('Education level created.');
    },
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, 'Failed to create.')),
  });
}

export function useUpdateEducationLevel() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateEducationLevelDto;
    }) => adminService.updateEducationLevel(id, data),
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: educationLevelKeys.all(),
      });
      toast.success('Education level updated.');
    },
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, 'Failed to update.')),
  });
}

export function useDeleteEducationLevel() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => adminService.deleteEducationLevel(id),
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: educationLevelKeys.all(),
      });
      toast.success('Education level deleted.');
    },
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, 'Failed to delete.')),
  });
}