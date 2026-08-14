/**
 * @file hooks/admin/useAdminGraph.ts
 * @description React Query hooks for the Admin Graph module (WP-ADMIN-COMP-08).
 *
 * RESPONSIBILITIES:
 *  - Wrap getAdminGraphMetrics/validateAdminGraph/getAdminGraphDatasetStatuses/
 *    getAdminGraphHealth/getAdminGraphAlerts/getAdminGraphStats/
 *    getAdminGraphImportLogs in useQuery.
 *  - Wrap importAdminGraphDataset and previewAdminGraphDataset in useMutation.
 *  - On a successful import, invalidate every admin-graph query — the
 *    backend's own cache-warm step already targets specific Redis keys
 *    (graph:career / graph:skills) for the read-only graph-intelligence
 *    endpoints, but every read exposed on THIS page (metrics, dataset
 *    statuses, health, alerts, stats, import history) can shift after an
 *    import, so a broad invalidation is correct here — not over-invalidation.
 *
 * HARD RULES (mirrors the rest of the hooks layer, e.g. useAdminJobs.ts):
 *  - NO UI logic here — callers (pages/components) own loading/success/error rendering.
 *  - NO direct fetch/axios — always through lib/api/adminGraph.
 *  - Errors surface as ApiClientError — branch on `err.category` in the UI.
 *  - previewAdminGraphDataset is NOT cached as a query — every preview is a
 *    fresh POST with the currently-selected file, so it's exposed as a
 *    mutation, not a useQuery keyed by file (files aren't stable query keys).
 *
 * Architecture position: Hooks layer
 *   API (lib/api/adminGraph) → Hooks (this file) → UI (pages/admin/GraphPage, GraphImportPanel)
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAdminGraphMetrics,
  validateAdminGraph,
  getAdminGraphDatasetStatuses,
  getAdminGraphHealth,
  getAdminGraphAlerts,
  getAdminGraphStats,
  getAdminGraphImportLogs,
  importAdminGraphDataset,
  previewAdminGraphDataset,
  type GraphMetrics,
  type GraphIntegrityReport,
  type GraphDatasetStatus,
  type GraphHealth,
  type GraphAlert,
  type GraphStats,
  type GraphImportLogsResponse,
  type GraphImportResult,
  type GraphPreviewResult,
  type GraphDatasetType,
  type ImportGraphDatasetOptions,
} from '@/lib/api/adminGraph';
import type { ApiClientError } from '@/lib/api/core';
import { shouldRetry, retryDelay, queryKeys } from '@/lib/query';

// ─────────────────────────────────────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────────────────────────────────────

export function useAdminGraphMetrics() {
  return useQuery<GraphMetrics, ApiClientError>({
    queryKey: queryKeys.adminGraph.metrics(),
    queryFn:  () => getAdminGraphMetrics(),
    retry:    (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
  });
}

/**
 * FK integrity validation. Not run automatically on every page load in a
 * tight loop — this is a full-table scan on the backend (see
 * validateGraphIntegrity: up to 20,000 rows per dataset) — but is fetched
 * once on page mount like the other overview queries, and can be re-run
 * on demand via refetch() from the Validation panel's "Run validation" button.
 */
export function useAdminGraphValidation() {
  return useQuery<GraphIntegrityReport, ApiClientError>({
    queryKey: queryKeys.adminGraph.validate(),
    queryFn:  () => validateAdminGraph(),
    retry:    (failureCount, error) => shouldRetry(failureCount, error, 1),
    retryDelay,
  });
}

export function useAdminGraphDatasetStatuses() {
  return useQuery<GraphDatasetStatus[], ApiClientError>({
    queryKey: queryKeys.adminGraph.datasetStatuses(),
    queryFn:  () => getAdminGraphDatasetStatuses(),
    retry:    (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
  });
}

export function useAdminGraphHealth() {
  return useQuery<GraphHealth, ApiClientError>({
    queryKey: queryKeys.adminGraph.health(),
    queryFn:  () => getAdminGraphHealth(),
    retry:    (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
  });
}

export function useAdminGraphAlerts() {
  return useQuery<GraphAlert[], ApiClientError>({
    queryKey: queryKeys.adminGraph.alerts(),
    queryFn:  () => getAdminGraphAlerts(),
    retry:    (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
  });
}

export function useAdminGraphStats() {
  return useQuery<GraphStats, ApiClientError>({
    queryKey: queryKeys.adminGraph.stats(),
    queryFn:  () => getAdminGraphStats(),
    retry:    (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
  });
}

/** Recent import history (import_logs, graph dataset types only). */
export function useAdminGraphImportLogs(limit = 20) {
  return useQuery<GraphImportLogsResponse, ApiClientError>({
    queryKey: queryKeys.adminGraph.importLogs(limit),
    queryFn:  () => getAdminGraphImportLogs({ limit }),
    retry:    (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MUTATIONS
// ─────────────────────────────────────────────────────────────────────────────

interface ImportMutationInput {
  datasetType: GraphDatasetType;
  file: File;
  options?: ImportGraphDatasetOptions;
}

/**
 * Commit a CSV import for one dataset type. Never auto-retried — like job
 * sync, an import is not safely idempotent from the caller's perspective
 * (partial success is possible). On success, invalidates every admin-graph
 * query so metrics/dataset status/health/alerts/stats/import-history all
 * reflect the new data without a manual refresh.
 */
export function useImportAdminGraphDataset() {
  const queryClient = useQueryClient();

  return useMutation<GraphImportResult, ApiClientError, ImportMutationInput>({
    mutationFn: ({ datasetType, file, options }) =>
      importAdminGraphDataset(datasetType, file, options),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminGraph.all() });
    },
  });
}

/**
 * Dry-run a CSV import. Read-only on the backend (never writes), so no
 * cache invalidation is needed on success.
 */
export function usePreviewAdminGraphDataset() {
  return useMutation<GraphPreviewResult, ApiClientError, ImportMutationInput>({
    mutationFn: ({ datasetType, file, options }) =>
      previewAdminGraphDataset(datasetType, file, options),
    retry: false,
  });
}
