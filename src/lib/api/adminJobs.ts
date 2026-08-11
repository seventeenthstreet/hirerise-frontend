/**
 * @file lib/api/adminJobs.ts
 * @description Frontend API wrappers for the Admin Jobs module (WP-ADMIN-COMP-06).
 *
 * Backend contract (certified in WP-ADMIN-COMP-06; upload endpoint added
 * in WP-ADMIN-COMP-06-R2):
 *   GET  /api/v1/admin/jobs             → listAdminJobs
 *   GET  /api/v1/admin/jobs/:id         → getAdminJob
 *   GET  /api/v1/admin/jobs/sync/status → getAdminJobSyncStatus
 *   GET  /api/v1/admin/jobs/sync/logs   → listAdminJobSyncLogs
 *   POST /api/v1/admin/jobs/sync        → triggerAdminJobSync
 *   POST /api/v1/admin/jobs/sync/upload → uploadAdminJobsCsv
 *
 * All routes require authenticate + requireAdmin + requireElevatedSession
 * (enforced server-side at the mount point in server.js) — this module
 * never sends admin identity in the request body; the backend derives it
 * from the JWT.
 *
 * Domain model note: the `jobs` table (see supabase/migrations/
 * 000_initial_schema.sql) has no status/lifecycle field and no single-job
 * write endpoint — only bulk sync writes to it. There is therefore no
 * create/update/delete/publish/unpublish here; only what the backend
 * actually supports (list, detail, sync trigger, sync status, sync
 * history) is exposed. Fields below mirror the real table columns exactly
 * — nothing here is fabricated.
 */

import { apiRequest } from './core';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES — mirror the real "jobs" table columns exactly (job.repository.js)
// ─────────────────────────────────────────────────────────────────────────────

export interface AdminJob {
  id:               string;
  external_id:      string | null;
  title:            string;
  company:          string | null;
  location:         string | null;
  description:      string | null;
  skills:           string[];
  experience_level: string | null;
  salary_min:       number | null;
  salary_max:       number | null;
  salary_currency:  string | null;
  contract_type:    string | null;
  redirect_url:     string | null;
  source:           string;
  country:          string | null;
  posted_at:        string | null;
  fetched_at:       string;
  created_at:       string;
}

/** GET /admin/jobs query params. */
export interface ListAdminJobsParams {
  limit?:  number;
  offset?: number;
  search?: string;
  source?: string;
}

/** GET /admin/jobs response — matches the controller's `{ items, total }` payload. */
export interface ListAdminJobsResponse {
  items: AdminJob[];
  total: number;
}

export type SyncSourceType = 'google_sheets' | 'csv' | 'json';

/** Payload accepted by POST /admin/jobs/sync. */
export interface TriggerJobSyncInput {
  sourceType: SyncSourceType;
  sourceUrl:  string;
  options?: {
    delimiter?:  string;
    skipHeader?: boolean;
    sheetId?:    string;
  };
}

/** Response from POST /admin/jobs/sync. */
export interface TriggerJobSyncResponse {
  total:   number;
  success: number;
  failed:  number;
  errors:  { jobCode: string; message: string }[];
}

/** Optional form fields accepted by POST /admin/jobs/sync/upload alongside the file. */
export interface UploadAdminJobsCsvOptions {
  delimiter?:  string;
  skipHeader?: boolean;
}

/**
 * Response from POST /admin/jobs/sync/upload — same shape as
 * TriggerJobSyncResponse (both endpoints share jobSync.service's
 * ingestion pipeline and controller response envelope).
 */
export type UploadAdminJobsCsvResponse = TriggerJobSyncResponse;

/** GET /admin/jobs/sync/status response — mirrors the "sync_locks" row. */
export interface JobSyncStatus {
  lock_id:     string;
  status:      'idle' | 'running';
  locked_by:   string | null;
  locked_at:   string | null;
  released_at: string | null;
  expires_at?: string | null;
}

/** One row from GET /admin/jobs/sync/logs — mirrors the "sync_logs" table. */
export interface JobSyncLogEntry {
  id:             string;
  type:           string;
  source_type:    string | null;
  source_origin:  string | null;
  total_records:  number;
  success_count:  number;
  fail_count:     number;
  success_rate:   number | null;
  duration_ms:    number | null;
  initiated_by:   string | null;
  created_at:     string;
}

export interface ListJobSyncLogsResponse {
  items: JobSyncLogEntry[];
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = '/api/v1/admin/jobs';

/** List jobs with server-side pagination (offset/limit) and search/source filter. */
export function listAdminJobs(params?: ListAdminJobsParams): Promise<ListAdminJobsResponse> {
  return apiRequest<ListAdminJobsResponse>({
    url:    BASE_URL,
    method: 'GET',
    params: params as Record<string, unknown>,
  });
}

/** Fetch a single job by id (detail view). */
export function getAdminJob(jobId: string): Promise<AdminJob> {
  return apiRequest<AdminJob>({
    url:    `${BASE_URL}/${jobId}`,
    method: 'GET',
  });
}

/** Current sync lock state — used to disable the "Trigger Sync" action while a sync is already running. */
export function getAdminJobSyncStatus(): Promise<JobSyncStatus> {
  return apiRequest<JobSyncStatus>({
    url:    `${BASE_URL}/sync/status`,
    method: 'GET',
  });
}

/** Recent sync history (sync_logs), most recent first. */
export function listAdminJobSyncLogs(limit?: number): Promise<ListJobSyncLogsResponse> {
  return apiRequest<ListJobSyncLogsResponse>({
    url:    `${BASE_URL}/sync/logs`,
    method: 'GET',
    params: limit ? { limit } : undefined,
  });
}

/**
 * Trigger a manual job sync from an admin-supplied source (Google Sheets
 * CSV export, raw CSV, or JSON). Rate-limited server-side to 5 requests
 * per 15 minutes per IP; returns 409 if a sync is already running.
 */
export function triggerAdminJobSync(input: TriggerJobSyncInput): Promise<TriggerJobSyncResponse> {
  return apiRequest<TriggerJobSyncResponse>({
    url:    `${BASE_URL}/sync`,
    method: 'POST',
    data:   input,
  });
}

/**
 * Trigger a manual job sync from an uploaded local CSV file (WP-ADMIN-
 * COMP-06-R2) — same underlying ingestion pipeline and result shape as
 * triggerAdminJobSync() above, just fed from a file instead of a URL.
 * Field name must be 'file' (validated by backend multer config).
 * Same rate limit / already-running-sync (409) behavior as /sync.
 */
export function uploadAdminJobsCsv(
  file: File,
  options?: UploadAdminJobsCsvOptions,
): Promise<UploadAdminJobsCsvResponse> {
  const form = new FormData();
  form.append('file', file);
  if (options?.delimiter !== undefined) form.append('delimiter', options.delimiter);
  if (options?.skipHeader !== undefined) form.append('skipHeader', String(options.skipHeader));

  // No Content-Type header here — apiRequest() detects the FormData body and
  // clears the default JSON header so the browser can set the correct
  // `multipart/form-data; boundary=...` header itself. See the comment in
  // lib/api/core/api-client.ts (apiRequest) for why a manually-set
  // 'multipart/form-data' header breaks the upload.
  return apiRequest<UploadAdminJobsCsvResponse>({
    url:    `${BASE_URL}/sync/upload`,
    method: 'POST',
    data:   form,
  });
}
