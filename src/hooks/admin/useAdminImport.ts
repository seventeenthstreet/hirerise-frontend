// hooks/admin/useAdminImport.ts

import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { adminService } from '@/services/adminService';
import type { ImportEntity } from '@/types/admin';
import { ADMIN_METRICS_KEY } from './useAdminMetrics';
import toast from 'react-hot-toast';

export const IMPORT_STATUS_KEY = ['admin', 'import', 'status'] as const;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return fallback;
}

export function useImportStatus() {
  return useQuery({
    queryKey: IMPORT_STATUS_KEY,
    queryFn: () => adminService.getImportStatus(),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const data = query.state.data as
        | { inProgress?: boolean }
        | undefined;

      return data?.inProgress ? 3000 : false;
    },
  });
}

export function useAdminImport() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entity,
      file,
    }: {
      entity: ImportEntity;
      file: File;
    }) => {
      if (!file) {
        throw new Error('CSV file is required.');
      }

      return adminService.importCsv(entity, file);
    },

    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: IMPORT_STATUS_KEY }),
        qc.invalidateQueries({ queryKey: ADMIN_METRICS_KEY }),
        qc.invalidateQueries({ queryKey: ['admin'] }),
      ]);

      toast.success('Import started successfully.');
    },

    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Import failed.'));
    },
  });
}