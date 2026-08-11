/**
 * @file hooks/admin/useAdminCmsSalaryBenchmarks.ts
 * @description React Query hooks for the Admin CMS Salary Benchmarks module (WP-ADMIN-COMP-03).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listAdminSalaryBenchmarks,
  createAdminSalaryBenchmark,
  updateAdminSalaryBenchmark,
  deleteAdminSalaryBenchmark,
  type AdminSalaryBenchmark,
  type ListAdminSalaryBenchmarksParams,
  type ListAdminSalaryBenchmarksResponse,
  type CreateAdminSalaryBenchmarkInput,
  type UpdateAdminSalaryBenchmarkInput,
} from '@/lib/api/adminCmsSalaryBenchmarks';
import type { ApiClientError } from '@/lib/api/core';
import { shouldRetry, retryDelay, queryKeys } from '@/lib/query';

export function useAdminSalaryBenchmarksList(params: ListAdminSalaryBenchmarksParams) {
  return useQuery<ListAdminSalaryBenchmarksResponse, ApiClientError>({
    queryKey: queryKeys.adminMasterData.salaryBenchmarks.list(params as Record<string, unknown>),
    queryFn:  () => listAdminSalaryBenchmarks(params),
    retry:    (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
    placeholderData: (previousData: ListAdminSalaryBenchmarksResponse | undefined) => previousData,
  });
}

export function useCreateAdminSalaryBenchmark() {
  const queryClient = useQueryClient();
  return useMutation<AdminSalaryBenchmark, ApiClientError, CreateAdminSalaryBenchmarkInput>({
    mutationFn: (input) => createAdminSalaryBenchmark(input),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminMasterData.salaryBenchmarks.all() });
    },
  });
}

export function useUpdateAdminSalaryBenchmark() {
  const queryClient = useQueryClient();
  return useMutation<AdminSalaryBenchmark, ApiClientError, { id: string; input: UpdateAdminSalaryBenchmarkInput }>({
    mutationFn: ({ id, input }) => updateAdminSalaryBenchmark(id, input),
    retry:      (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminMasterData.salaryBenchmarks.all() });
    },
  });
}

export function useDeleteAdminSalaryBenchmark() {
  const queryClient = useQueryClient();
  return useMutation<null, ApiClientError, string>({
    mutationFn: (id) => deleteAdminSalaryBenchmark(id),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminMasterData.salaryBenchmarks.all() });
    },
  });
}
