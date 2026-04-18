// hooks/admin/useAdminRoles.ts
// TanStack Query hooks for Admin Roles CMS — full CRUD.

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { adminService } from '@/services/adminService';
import type { CreateRoleDto, UpdateRoleDto } from '@/types/admin';
import type { CmsQueryParams } from '@/types/api';
import toast from 'react-hot-toast';

export const roleKeys = {
  all:    () => ['admin', 'roles'] as const,
  list:   (p: CmsQueryParams) => [...roleKeys.all(), 'list', p] as const,
  detail: (id: string)        => [...roleKeys.all(), 'detail', id] as const,
};

export function useAdminRoles(params: CmsQueryParams = {}) {
  return useQuery({
    queryKey:        roleKeys.list(params),
    queryFn:         () => adminService.listRoles(params),
    staleTime:       2 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useAdminRole(id: string | null) {
  return useQuery({
    queryKey: roleKeys.detail(id ?? ''),
    queryFn:  () => adminService.getRole(id!),
    enabled:  !!id,
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRoleDto) => adminService.createRole(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: roleKeys.all() }); toast.success('Role created.'); },
    onError:   (e: Error) => toast.error(e.message ?? 'Failed to create role.'),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRoleDto }) => adminService.updateRole(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: roleKeys.all() });
      qc.invalidateQueries({ queryKey: roleKeys.detail(id) });
      toast.success('Role updated.');
    },
    onError: (e: Error) => toast.error(e.message ?? 'Failed to update role.'),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminService.deleteRole(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: roleKeys.all() }); toast.success('Role deleted.'); },
    onError:   (e: Error) => toast.error(e.message ?? 'Failed to delete role.'),
  });
}