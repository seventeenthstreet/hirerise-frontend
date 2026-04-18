// features/admin/cms/skills/hooks/useSkills.ts
//
// TanStack Query hooks for the Admin Skills CMS.
// Uses the /admin/cms/skills channel (full CRUD visibility for admins).

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { adminService } from '@/services/adminService';
import type { CreateSkillDto, UpdateSkillDto } from '@/types/skills';
import type { CmsQueryParams } from '@/types/api';
import toast from 'react-hot-toast';

export const skillKeys = {
  all:    () => ['admin', 'skills'] as const,
  list:   (params: CmsQueryParams) => [...skillKeys.all(), 'list', params] as const,
  detail: (id: string) => [...skillKeys.all(), 'detail', id] as const,
};

// ─── List ─────────────────────────────────────────────────────────────────────

export function useAdminSkills(params: CmsQueryParams = {}) {
  return useQuery({
    queryKey:        skillKeys.list(params),
    queryFn:         () => adminService.listSkills(params),
    staleTime:       2 * 60 * 1000, // 2 minutes
    placeholderData: keepPreviousData, // keep previous page visible during pagination
  });
}

// ─── Single ───────────────────────────────────────────────────────────────────

export function useAdminSkill(id: string | null) {
  return useQuery({
    queryKey: skillKeys.detail(id ?? ''),
    queryFn:  () => adminService.getSkill(id!),
    enabled:  !!id,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Create ───────────────────────────────────────────────────────────────────

export function useCreateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSkillDto) => adminService.createSkill(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: skillKeys.all() });
      toast.success('Skill created successfully.');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to create skill.');
    },
  });
}

// ─── Update ───────────────────────────────────────────────────────────────────

export function useUpdateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSkillDto }) =>
      adminService.updateSkill(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: skillKeys.all() });
      qc.invalidateQueries({ queryKey: skillKeys.detail(id) });
      toast.success('Skill updated successfully.');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to update skill.');
    },
  });
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export function useDeleteSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminService.deleteSkill(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: skillKeys.all() });
      toast.success('Skill deleted.');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to delete skill.');
    },
  });
}
