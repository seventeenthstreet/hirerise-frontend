/**
 * @file hooks/admin/useAdminJobs.ts
 * @description React Query hooks for the Admin Jobs module (WP-ADMIN-COMP-06).
 *
 * RESPONSIBILITIES:
 *  - Wrap listAdminJobs/getAdminJob/getAdminJobSyncStatus/listAdminJobSyncLogs
 *    in useQuery.
 *  - Wrap triggerAdminJobSync in useMutation, invalidating the job list and
 *    sync status/history on completion so a triggered sync's results show
 *    up without a manual refresh.
 *
 * HARD RULES (mirrors the rest of the hooks layer):
 *  - NO UI logic here — callers (pages/components) own loading/success/error rendering.
 *  - NO direct fetch/axios — always through lib/api/adminJobs.
 *  - Errors surface as ApiClientError — branch on `err.category` in the UI.
 *
 * Architecture position: Hooks layer
 *   API (lib/api/adminJobs) → Hooks (this file) → UI (pages/admin/JobsPage, JobDetailPage)
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listAdminJobs,
  getAdminJob,
  getAdminJobSyncStatus,
  listAdminJobSyncLogs,
  triggerAdminJobSync,
  uploadAdminJobsCsv,
  type AdminJob,
  type ListAdminJobsParams,
  type ListAdminJobsResponse,
  type JobSyncStatus,
  type ListJobSyncLogsResponse,
  type TriggerJobSyncInput,
  type TriggerJobSyncResponse,
  type UploadAdminJobsCsvOptions,
  type UploadAdminJobsCsvResponse,
} from '@/lib/api/adminJobs';
import type { ApiClientError } from '@/lib/api/core';
import { shouldRetry, retryDelay, queryKeys } from '@/lib/query';

// ─────────────────────────────────────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch one page of the jobs list, server-filtered by search/source and
 * server-paginated via offset/limit. Re-fetches automatically whenever
 * `params` changes (new query key).
 */
export function useAdminJobsList(params: ListAdminJobsParams) {
  return useQuery<ListAdminJobsResponse, ApiClientError>({
    queryKey: queryKeys.adminJobs.list(params as Record<string, unknown>),
    queryFn:  () => listAdminJobs(params),
    retry:    (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
    placeholderData: (previousData: ListAdminJobsResponse | undefined) => previousData, // keep old page visible while the next page loads
  });
}

/** Fetch a single job's detail. Disabled until a jobId is provided. */
export function useAdminJobDetail(jobId: string | null) {
  return useQuery<AdminJob, ApiClientError>({
    queryKey: queryKeys.adminJobs.detail(jobId ?? ''),
    queryFn:  () => getAdminJob(jobId as string),
    enabled:  Boolean(jobId),
    retry:    (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
  });
}

/**
 * Current sync lock state — used to disable "Trigger Sync" while a sync is
 * already running elsewhere. Polled lightly (30s) since it's cheap and the
 * lock can be released by a sync triggered from another admin session.
 */
export function useAdminJobSyncStatus() {
  return useQuery<JobSyncStatus, ApiClientError>({
    queryKey: queryKeys.adminJobs.syncStatus(),
    queryFn:  () => getAdminJobSyncStatus(),
    retry:    (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
    refetchInterval: 30_000,
  });
}

/** Recent sync history (sync_logs), most recent first. */
export function useAdminJobSyncLogs(limit = 20) {
  return useQuery<ListJobSyncLogsResponse, ApiClientError>({
    queryKey: queryKeys.adminJobs.syncLogs(limit),
    queryFn:  () => listAdminJobSyncLogs(limit),
    retry:    (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MUTATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trigger a manual job sync. Never auto-retried — a sync is not idempotent
 * from the caller's perspective (it may partially succeed before a
 * transient failure). On success, invalidates the job list and both sync
 * status/history queries so the new jobs and the completed run show up.
 */
export function useTriggerAdminJobSync() {
  const queryClient = useQueryClient();

  return useMutation<TriggerJobSyncResponse, ApiClientError, TriggerJobSyncInput>({
    mutationFn: (input) => triggerAdminJobSync(input),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminJobs.all() });
    },
  });
}

/**
 * Trigger a manual job sync from an uploaded CSV file (WP-ADMIN-COMP-06-R2).
 * Same non-retried, invalidate-on-success behavior as useTriggerAdminJobSync
 * above — shares the backend's ingestion pipeline, just a different input
 * shape (File + options instead of a source URL).
 */
export function useTriggerAdminJobCsvUpload() {
  const queryClient = useQueryClient();

  return useMutation<
    UploadAdminJobsCsvResponse,
    ApiClientError,
    { file: File; options?: UploadAdminJobsCsvOptions }
  >({
    mutationFn: ({ file, options }) => uploadAdminJobsCsv(file, options),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminJobs.all() });
    },
  });
}
