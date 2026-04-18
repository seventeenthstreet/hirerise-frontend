// hooks/admin/useAdminSalaryBenchmarks.ts

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { adminService } from '@/services/adminService';
import type { CreateSalaryBenchmarkDto, UpdateSalaryBenchmarkDto } from '@/types/admin';
import type { CmsQueryParams } from '@/types/api';
import toast from 'react-hot-toast';

export const salaryBenchmarkKeys = {
  all:  () => ['admin', 'salary-benchmarks'] as const,
  list: (p: CmsQueryParams) => [...salaryBenchmarkKeys.all(), 'list', p] as const,
};

export function useAdminSalaryBenchmarks(params: CmsQueryParams = {}) {
  return useQuery({
    queryKey:        salaryBenchmarkKeys.list(params),
    queryFn:         () => adminService.listSalaryBenchmarks(params),
    staleTime:       2 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useCreateSalaryBenchmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSalaryBenchmarkDto) => adminService.createSalaryBenchmark(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: salaryBenchmarkKeys.all() }); toast.success('Benchmark created.'); },
    onError:   (e: Error) => toast.error(e.message ?? 'Failed to create.'),
  });
}

export function useUpdateSalaryBenchmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSalaryBenchmarkDto }) => adminService.updateSalaryBenchmark(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: salaryBenchmarkKeys.all() }); toast.success('Benchmark updated.'); },
    onError:   (e: Error) => toast.error(e.message ?? 'Failed to update.'),
  });
}

export function useDeleteSalaryBenchmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminService.deleteSalaryBenchmark(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: salaryBenchmarkKeys.all() }); toast.success('Benchmark deleted.'); },
    onError:   (e: Error) => toast.error(e.message ?? 'Failed to delete.'),
  });
}