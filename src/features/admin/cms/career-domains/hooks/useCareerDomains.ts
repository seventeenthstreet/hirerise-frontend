// src/features/admin/cms/career-domains/hooks/useCareerDomains.ts
//
// TanStack Query hooks for admin CMS career domains.
// Supabase-safe, backend-aligned, and optimized for Next.js App Router.

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { adminService } from '@/services/adminService';
import type {
  CreateCareerDomainDto,
  UpdateCareerDomainDto,
} from '@/types/admin';
import type { CmsQueryParams } from '@/types/api';

export const careerDomainKeys = {
  all: () => ['admin', 'career-domains'] as const,

  list: (params: CmsQueryParams = {}) =>
    [
      ...careerDomainKeys.all(),
      'list',
      JSON.stringify(params),
    ] as const,

  detail: (id: string) =>
    [...careerDomainKeys.all(), 'detail', id] as const,
};

// ─────────────────────────────────────────────
// List
// ─────────────────────────────────────────────

export function useAdminCareerDomains(
  params: CmsQueryParams = {}
) {
  return useQuery({
    queryKey: careerDomainKeys.list(params),
    queryFn: () =>
      adminService.listCareerDomains(params),
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

// ─────────────────────────────────────────────
// Single
// ─────────────────────────────────────────────

export function useAdminCareerDomain(
  id: string | null
) {
  return useQuery({
    queryKey: careerDomainKeys.detail(id ?? ''),
    queryFn: async () => {
      if (!id) {
        throw new Error(
          'Career domain ID is required.'
        );
      }

      return adminService.getCareerDomain(id);
    },
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
  });
}

// ─────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────

export function useCreateCareerDomain() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCareerDomainDto) =>
      adminService.createCareerDomain(data),

    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: careerDomainKeys.all(),
      });

      toast.success(
        'Career domain created successfully.'
      );
    },

    onError: (err: unknown) => {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Failed to create career domain.'
      );
    },
  });
}

// ─────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────

export function useUpdateCareerDomain() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateCareerDomainDto;
    }) => adminService.updateCareerDomain(id, data),

    onSuccess: async (_, { id }) => {
      await Promise.all([
        qc.invalidateQueries({
          queryKey: careerDomainKeys.all(),
        }),
        qc.invalidateQueries({
          queryKey: careerDomainKeys.detail(id),
        }),
      ]);

      toast.success(
        'Career domain updated successfully.'
      );
    },

    onError: (err: unknown) => {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Failed to update career domain.'
      );
    },
  });
}

// ─────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────

export function useDeleteCareerDomain() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      adminService.deleteCareerDomain(id),

    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: careerDomainKeys.all(),
      });

      toast.success('Career domain deleted.');
    },

    onError: (err: unknown) => {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Failed to delete career domain.'
      );
    },
  });
}