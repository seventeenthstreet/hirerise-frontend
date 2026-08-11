/**
 * @file hooks/admin/useAdminCmsImport.ts
 * @description React Query mutation for the Admin CMS Import module (WP-ADMIN-COMP-03).
 * Invalidates the relevant Master Data list on any inserted>0 result so a
 * subsequent visit to that dataset's page reflects the import immediately.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { runAdminCmsImport, type ImportResultData, type RunAdminCmsImportInput } from '@/lib/api/adminCmsImport';
import type { ApiClientError } from '@/lib/api/core';
import { queryKeys } from '@/lib/query';

export function useRunAdminCmsImport() {
  const queryClient = useQueryClient();
  return useMutation<ImportResultData, ApiClientError, RunAdminCmsImportInput>({
    mutationFn: (input) => runAdminCmsImport(input),
    retry: false,
    onSuccess: (_data, variables) => {
      const key =
        variables.datasetType === 'skills'          ? queryKeys.adminMasterData.skills.all() :
        variables.datasetType === 'roles'            ? queryKeys.adminMasterData.roles.all() :
        variables.datasetType === 'jobFamilies'      ? queryKeys.adminMasterData.jobFamilies.all() :
        variables.datasetType === 'educationLevels'  ? queryKeys.adminMasterData.educationLevels.all() :
        undefined;
      if (key) void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
