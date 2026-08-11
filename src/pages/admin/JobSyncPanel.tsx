/**
 * @file src/pages/admin/JobSyncPanel.tsx
 * @description WP-ADMIN-COMP-06 — Trigger Sync panel used by JobsPage.
 * WP-ADMIN-COMP-06-R2 — added a CSV File Upload source option alongside
 * the existing URL-based sources.
 *
 * Lets an admin trigger a manual job sync from a Google Sheets / CSV /
 * JSON URL, OR from an uploaded local CSV file, shows the current sync
 * lock state, and lists recent sync history (sync_logs). This is the
 * ONLY write action Jobs supports — everything else on JobsPage/
 * JobDetailPage is read-only, matching what the backend actually
 * exposes (POST /admin/jobs/sync and POST /admin/jobs/sync/upload; no
 * single-job write endpoint exists). Both endpoints share the same
 * backend ingestion pipeline and return the same result shape, so this
 * panel renders one shared result/error block for whichever was last
 * triggered.
 */

import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Button, Card, CardHeader, CardContent } from '@/components/ui';
import { StatusBadge } from '@/components/admin-dashboard';
import { useTriggerAdminJobSync, useTriggerAdminJobCsvUpload } from '@/hooks/admin/useAdminJobs';
import type { JobSyncStatus, ListJobSyncLogsResponse, SyncSourceType } from '@/lib/api/adminJobs';
import type { ApiClientError } from '@/lib/api/core';

/** UI-only source option — 'csv_upload' has no URL field and isn't a SyncSourceType (that enum is for the URL-based /sync endpoint only). */
type PanelSourceOption = SyncSourceType | 'csv_upload';

const URL_SOURCE_TYPE_OPTIONS: { value: SyncSourceType; label: string }[] = [
  { value: 'google_sheets', label: 'Google Sheets (published CSV link)' },
  { value: 'csv', label: 'CSV URL' },
  { value: 'json', label: 'JSON URL' },
];

const SOURCE_OPTIONS: { value: PanelSourceOption; label: string }[] = [
  ...URL_SOURCE_TYPE_OPTIONS,
  { value: 'csv_upload', label: 'CSV File Upload' },
];

const MAX_CSV_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB — mirrors the backend's multer limit

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Client-side pre-check only — the backend's multer fileFilter/size limit
 * on POST /sync/upload remains authoritative. This just gives the admin
 * immediate feedback instead of waiting on a round trip for an obviously
 * wrong file.
 */
function validateCsvFile(file: File): string | null {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    return 'Only .csv files are accepted.';
  }
  if (file.size === 0) {
    return 'That file is empty.';
  }
  if (file.size > MAX_CSV_UPLOAD_BYTES) {
    return `File exceeds the maximum size of ${formatFileSize(MAX_CSV_UPLOAD_BYTES)}.`;
  }
  return null;
}

interface JobSyncPanelProps {
  syncStatus: UseQueryResult<JobSyncStatus, ApiClientError>;
  syncLogs: UseQueryResult<ListJobSyncLogsResponse, ApiClientError>;
}

export function JobSyncPanel({ syncStatus, syncLogs }: JobSyncPanelProps) {
  const [sourceOption, setSourceOption] = useState<PanelSourceOption>('json');
  const [sourceUrl, setSourceUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileValidationError, setFileValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerSync = useTriggerAdminJobSync();
  const uploadCsv = useTriggerAdminJobCsvUpload();

  const isUploadMode = sourceOption === 'csv_upload';
  const isRunning = syncStatus.data?.status === 'running';
  const isPending = isUploadMode ? uploadCsv.isPending : triggerSync.isPending;

  // Whichever mutation was last used to submit is the one whose
  // success/error result this panel shows — the two forms are mutually
  // exclusive (only one is visible at a time based on sourceOption).
  const activeResult = isUploadMode ? uploadCsv : triggerSync;

  const canSubmitUrl = sourceUrl.trim().length > 0 && !isRunning && !triggerSync.isPending;
  const canSubmitUpload = Boolean(file) && !fileValidationError && !isRunning && !uploadCsv.isPending;
  const canSubmit = isUploadMode ? canSubmitUpload : canSubmitUrl;

  function handleSourceOptionChange(next: PanelSourceOption) {
    setSourceOption(next);
    // Switching modes clears the other mode's input so a stale file or
    // URL can't be silently submitted under the new mode.
    setSourceUrl('');
    setFile(null);
    setFileValidationError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const next = e.target.files?.[0] ?? null;
    setFile(next);
    setFileValidationError(next ? validateCsvFile(next) : null);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isUploadMode) {
      if (!canSubmitUpload || !file) return;
      uploadCsv.mutate({ file });
    } else {
      if (!canSubmitUrl) return;
      triggerSync.mutate({ sourceType: sourceOption, sourceUrl: sourceUrl.trim() });
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-foreground">Trigger Sync</h2>
        <p className="text-sm text-muted-foreground">
          Manually pull job listings from a Google Sheets, CSV, or JSON
          source — or upload a CSV file directly — into the jobs
          directory above.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="sync-source-type" className="text-xs font-medium text-muted-foreground">
              Source type
            </label>
            <select
              id="sync-source-type"
              value={sourceOption}
              onChange={(e) => handleSourceOptionChange(e.target.value as PanelSourceOption)}
              className="h-10 w-56 rounded-md border border-border bg-background px-3 text-sm text-foreground"
            >
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {isUploadMode ? (
            <div className="flex flex-1 min-w-[240px] flex-col gap-1">
              <label htmlFor="sync-csv-file" className="text-xs font-medium text-muted-foreground">
                CSV file
              </label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose CSV File
                </Button>
                <input
                  ref={fileInputRef}
                  id="sync-csv-file"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="sr-only"
                />
                <span className="text-sm text-muted-foreground">
                  {file ? `Selected file: ${file.name} (${formatFileSize(file.size)})` : 'No file selected'}
                </span>
              </div>
              {fileValidationError && (
                <p className="text-sm text-destructive">{fileValidationError}</p>
              )}
            </div>
          ) : (
            <div className="flex flex-1 min-w-[240px] flex-col gap-1">
              <label htmlFor="sync-source-url" className="text-xs font-medium text-muted-foreground">
                Source URL
              </label>
              <input
                id="sync-source-url"
                type="url"
                required
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://…"
                className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>
          )}

          <Button type="submit" disabled={!canSubmit}>
            {isPending
              ? (isUploadMode ? 'Importing…' : 'Syncing…')
              : isRunning
                ? 'Sync already running'
                : isUploadMode ? 'Import CSV' : 'Trigger Sync'}
          </Button>
        </form>

        {activeResult.isSuccess && (
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
            <p className="font-medium text-foreground">
              {activeResult.data.total} jobs processed — {activeResult.data.success} imported
              {activeResult.data.failed > 0 ? `, ${activeResult.data.failed} failed` : ''}.
            </p>
            {activeResult.data.errors.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                {activeResult.data.errors.slice(0, 5).map((err, i) => (
                  <li key={i}>{err.jobCode}: {err.message}</li>
                ))}
                {activeResult.data.errors.length > 5 && (
                  <li>…and {activeResult.data.errors.length - 5} more</li>
                )}
              </ul>
            )}
          </div>
        )}

        {activeResult.isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <p>{activeResult.error.message || 'Sync failed. Please try again.'}</p>
            {/* The backend's shared sync envelope (sendSyncResult) puts per-record
                validation errors in error.details.errors on a 422 — same shape as
                the success-path data.errors above. Surface them here too, since a
                whole-batch failure (422) is exactly when the admin most needs to
                see WHY each row failed, not just a generic message. */}
            {(() => {
              const details = activeResult.error.details as { errors?: { jobCode: string; message: string }[] } | null;
              const recordErrors = details?.errors;
              if (!recordErrors || recordErrors.length === 0) return null;
              return (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {recordErrors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err.jobCode}: {err.message}</li>
                  ))}
                  {recordErrors.length > 5 && (
                    <li>…and {recordErrors.length - 5} more</li>
                  )}
                </ul>
              );
            })()}
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">Recent syncs</h3>
            {syncStatus.data && (
              <StatusBadge
                variant={isRunning ? 'degraded' : 'healthy'}
                label={isRunning ? 'Running' : 'Idle'}
              />
            )}
          </div>

          {syncLogs.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading history…</p>
          ) : syncLogs.isError ? (
            <p className="text-sm text-muted-foreground">Unable to load sync history.</p>
          ) : (syncLogs.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No syncs have been run yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {syncLogs.data!.items.map((log) => (
                <li key={log.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                  <span className="text-foreground">{log.source_type ?? '—'}</span>
                  <span className="text-muted-foreground">
                    {log.success_count}/{log.total_records} succeeded
                  </span>
                  <span className="text-muted-foreground">{formatDateTime(log.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
