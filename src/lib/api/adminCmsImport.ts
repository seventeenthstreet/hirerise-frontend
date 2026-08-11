/**
 * @file lib/api/adminCmsImport.ts
 * @description Frontend API wrapper for the Admin CMS bulk Import endpoint (WP-ADMIN-COMP-03).
 *
 * Backend contract (verified against adminCmsImport.routes.js / .service.js):
 *   POST /api/v1/admin/cms/import
 *
 * Restricted to exactly 4 dataset types by the route validator — this is the
 * real, current restriction, not an assumption:
 *   skills | roles | jobFamilies | educationLevels
 * (careerDomains / skillClusters / salaryBenchmarks are NOT importable via
 * this endpoint even though those datasets exist — do not add them here.)
 *
 * Each row accepts only a `name` (max 150 chars) — the service only persists
 * the name via a bulk_import_dataset RPC; no other per-row fields exist.
 *
 * Response is 200/201/207/409/422 depending on outcome. `duplicates`/`errors`
 * are always readable from `data.duplicates`/`data.errors` regardless of
 * success/failure (see the WP-ADMIN-COMP-03 contract fix in the route file).
 */

import { apiRequest, isApiClientError } from './core';

export const IMPORTABLE_DATASET_TYPES = ['skills', 'roles', 'jobFamilies', 'educationLevels'] as const;
export type ImportableDatasetType = (typeof IMPORTABLE_DATASET_TYPES)[number];

export interface ImportRowError {
  index?: number;
  name?: string;
  message: string;
}

export interface ImportResultData {
  total:       number;
  inserted:    number;
  skipped:     number;
  insertedIds: string[];
  duplicates:  Array<{ name: string } | string>;
  errors:      ImportRowError[];
}

export interface RunAdminCmsImportInput {
  datasetType: ImportableDatasetType;
  rows: { name: string }[];
}

const BASE_URL = '/api/v1/admin/cms/import';

/**
 * Runs a bulk import. Unlike other Master Data mutations, this can "fail" in
 * the ApiClientError sense (thrown) while still carrying a useful partial
 * result (e.g. an all-duplicates 409) — the backend now attaches that result
 * to `error.details`, so callers should inspect it before falling back to a
 * generic error message. See ImportPage.tsx for the intended usage pattern.
 */
export function runAdminCmsImport(input: RunAdminCmsImportInput): Promise<ImportResultData> {
  return apiRequest<ImportResultData>({
    url:    BASE_URL,
    method: 'POST',
    data:   input,
  });
}

/** Extracts the partial import result from a thrown error, if the backend attached one. */
export function extractImportResultFromError(err: unknown): ImportResultData | null {
  if (!isApiClientError(err)) return null;
  const details = err.details as { duplicates?: unknown; errors?: unknown } | null | undefined;
  if (!details || (!('duplicates' in details) && !('errors' in details))) return null;
  return {
    total: 0,
    inserted: 0,
    skipped: 0,
    insertedIds: [],
    duplicates: (details.duplicates as ImportResultData['duplicates']) ?? [],
    errors: (details.errors as ImportResultData['errors']) ?? [],
  };
}
