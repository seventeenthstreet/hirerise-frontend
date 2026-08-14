/**
 * @file src/pages/admin/GraphImportPanel.tsx
 * @description WP-ADMIN-COMP-08 — CSV Import + Import History panel used by
 * GraphPage. Lets an admin pick one of the 8 real GRAPH_DATASET_TYPES,
 * optionally preview a CSV (dry-run, no write) before committing, then
 * import it — and shows recent import_logs history below. This is the
 * ONLY write action Graph Administration supports; everything else on
 * GraphPage is read-only, matching what the backend actually exposes
 * (POST /admin/graph/import/:datasetType and /preview/:datasetType; no
 * single-row create/edit/delete endpoint exists — see graphAdmin.routes.js).
 *
 * Modeled directly on JobSyncPanel.tsx's CSV-upload pattern (WP-ADMIN-
 * COMP-06-R2), adapted for: a dataset-type selector instead of a source-
 * type selector, an explicit Preview step (the Jobs sync pipeline has no
 * preview endpoint; Graph's does), and the richer processed/imported/
 * skipped/failed + duplicate/FK error counts Graph's importGraphDataset()
 * actually returns.
 */

import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Button, Card, CardHeader, CardContent } from '@/components/ui';
import {
  useImportAdminGraphDataset,
  usePreviewAdminGraphDataset,
} from '@/hooks/admin/useAdminGraph';
import {
  GRAPH_DATASET_TYPES,
  type GraphDatasetType,
  type GraphImportLogsResponse,
  type GraphImportMode,
} from '@/lib/api/adminGraph';
import type { ApiClientError } from '@/lib/api/core';
import { formatDateTime, formatDuration, formatFileSize, formatDatasetLabel } from './graph.utils';

// Mirrors graphAdmin.controller.js#MAX_FILE_SIZE (5MB) — the authoritative
// limit for a real import/preview request. Multer's own limit is looser
// (10MB, see graphAdmin.routes.js), but requireCSV() rejects anything over
// 5MB before it reaches the import pipeline, so 5MB is what a client-side
// pre-check should actually warn about.
const MAX_CSV_UPLOAD_BYTES = 5 * 1024 * 1024;

const MODE_OPTIONS: { value: GraphImportMode; label: string }[] = [
  { value: 'append', label: 'Append' },
  { value: 'replace', label: 'Replace' },
];

const DATASET_OPTIONS: { value: GraphDatasetType; label: string }[] = GRAPH_DATASET_TYPES.map((dt) => ({
  value: dt,
  label: formatDatasetLabel(dt),
}));

/**
 * Client-side pre-check only — the backend's multer fileFilter/size limit
 * and requireCSV() on POST /import|/preview/:datasetType remain
 * authoritative. This just gives the admin immediate feedback instead of
 * waiting on a round trip for an obviously wrong file.
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

interface GraphImportPanelProps {
  importLogs: UseQueryResult<GraphImportLogsResponse, ApiClientError>;
}

export function GraphImportPanel({ importLogs }: GraphImportPanelProps) {
  const [datasetType, setDatasetType] = useState<GraphDatasetType>('roles');
  const [mode, setMode] = useState<GraphImportMode>('append');
  const [file, setFile] = useState<File | null>(null);
  const [fileValidationError, setFileValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const preview = usePreviewAdminGraphDataset();
  const doImport = useImportAdminGraphDataset();

  const canSubmit = Boolean(file) && !fileValidationError;
  const isBusy = preview.isPending || doImport.isPending;

  function handleDatasetTypeChange(next: GraphDatasetType) {
    setDatasetType(next);
    preview.reset();
    doImport.reset();
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const next = e.target.files?.[0] ?? null;
    setFile(next);
    setFileValidationError(next ? validateCsvFile(next) : null);
    preview.reset();
    doImport.reset();
  }

  function handlePreview(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || !file) return;
    preview.mutate({ datasetType, file, options: { mode } });
  }

  function handleImport() {
    if (!canSubmit || !file) return;
    doImport.mutate({ datasetType, file, options: { mode } });
  }

  function handleReset() {
    setFile(null);
    setFileValidationError(null);
    preview.reset();
    doImport.reset();
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-foreground">CSV Import</h2>
        <p className="text-sm text-muted-foreground">
          Import roles, skills, transitions, and relationships from a CSV file.
          Preview validates field, duplicate, and foreign-key errors without
          writing anything; Import commits the same validation and writes the
          importable rows.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form onSubmit={handlePreview} className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="graph-dataset-type" className="text-xs font-medium text-muted-foreground">
              Dataset
            </label>
            <select
              id="graph-dataset-type"
              value={datasetType}
              onChange={(e) => handleDatasetTypeChange(e.target.value as GraphDatasetType)}
              className="h-10 w-56 rounded-md border border-border bg-background px-3 text-sm text-foreground"
            >
              {DATASET_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="graph-import-mode" className="text-xs font-medium text-muted-foreground">
              Mode
            </label>
            <select
              id="graph-import-mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as GraphImportMode)}
              className="h-10 w-40 rounded-md border border-border bg-background px-3 text-sm text-foreground"
            >
              {MODE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-1 min-w-[240px] flex-col gap-1">
            <label htmlFor="graph-csv-file" className="text-xs font-medium text-muted-foreground">
              CSV file
            </label>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                Choose CSV File
              </Button>
              <input
                ref={fileInputRef}
                id="graph-csv-file"
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="sr-only"
              />
              <span className="text-sm text-muted-foreground">
                {file ? `Selected file: ${file.name} (${formatFileSize(file.size)})` : 'No file selected'}
              </span>
            </div>
            {fileValidationError && <p className="text-sm text-destructive">{fileValidationError}</p>}
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" variant="outline" disabled={!canSubmit || isBusy}>
              {preview.isPending ? 'Previewing…' : 'Preview'}
            </Button>
            <Button type="button" onClick={handleImport} disabled={!canSubmit || isBusy}>
              {doImport.isPending ? 'Importing…' : 'Import'}
            </Button>
            {(file || preview.isSuccess || preview.isError || doImport.isSuccess || doImport.isError) && (
              <Button type="button" variant="ghost" onClick={handleReset} disabled={isBusy}>
                Reset
              </Button>
            )}
          </div>
        </form>

        {preview.isSuccess && (
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
            <p className="font-medium text-foreground">
              Preview: {preview.data.processed} row(s) processed — {preview.data.importable} importable
              {preview.data.errorCount > 0 ? `, ${preview.data.errorCount} error(s)` : ''}.
            </p>
            <ImportErrorSummary
              fieldErrors={preview.data.fieldErrors}
              duplicateErrors={preview.data.duplicateErrors}
              fkErrors={preview.data.fkErrors}
            />
          </div>
        )}

        {preview.isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <p>{preview.error.message || 'Preview failed. Please try again.'}</p>
          </div>
        )}

        {doImport.isSuccess && (
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
            <p className="font-medium text-foreground">
              Import complete: {doImport.data.processed} row(s) processed — {doImport.data.imported} imported,
              {' '}{doImport.data.skipped} skipped
              {doImport.data.errorCount > 0 ? `, ${doImport.data.errorCount} error(s)` : ''}.
            </p>
            <ImportErrorSummary
              fieldErrors={doImport.data.fieldErrors}
              duplicateErrors={doImport.data.duplicateErrors}
              fkErrors={doImport.data.fkErrors}
            />
            {doImport.data.writeErrors.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                {doImport.data.writeErrors.map((err, i) => (
                  <li key={i}>Write failure: {err.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {doImport.isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <p>{doImport.error.message || 'Import failed. Please try again.'}</p>
          </div>
        )}

        <ImportHistorySection importLogs={importLogs} />
      </CardContent>
    </Card>
  );
}

interface ImportErrorSummaryProps {
  fieldErrors: { row: number; field: string; message: string }[];
  duplicateErrors: { row: number; field: string; message: string }[];
  fkErrors: { row: number; field: string; message: string }[];
}

/** Renders up to 5 examples from each error category — mirrors JobSyncPanel's error-list truncation pattern. */
function ImportErrorSummary({ fieldErrors, duplicateErrors, fkErrors }: ImportErrorSummaryProps) {
  const groups: { label: string; errors: ImportErrorSummaryProps['fieldErrors'] }[] = [
    { label: 'Field errors', errors: fieldErrors },
    { label: 'Duplicate errors', errors: duplicateErrors },
    { label: 'FK errors', errors: fkErrors },
  ].filter((g) => g.errors.length > 0);

  if (groups.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-2">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="text-xs font-medium text-muted-foreground">{g.label} ({g.errors.length})</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
            {g.errors.slice(0, 5).map((err, i) => (
              <li key={i}>Row {err.row} ({err.field}): {err.message}</li>
            ))}
            {g.errors.length > 5 && <li>…and {g.errors.length - 5} more</li>}
          </ul>
        </div>
      ))}
    </div>
  );
}

interface ImportHistorySectionProps {
  importLogs: UseQueryResult<GraphImportLogsResponse, ApiClientError>;
}

function ImportHistorySection({ importLogs }: ImportHistorySectionProps) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-foreground">Import History</h3>

      {importLogs.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading import history…</p>
      ) : importLogs.isError ? (
        <p className="text-sm text-muted-foreground">Unable to load import history.</p>
      ) : (importLogs.data?.logs.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">No imports have been run yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {importLogs.data!.logs.map((log) => (
            <li key={log.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="font-medium text-foreground">
                {log.dataset_name ? formatDatasetLabel(log.dataset_name) : '—'}
              </span>
              <span className="text-muted-foreground">{log.import_mode}</span>
              <span className="text-muted-foreground">
                {log.rows_imported}/{log.rows_processed} imported
                {log.rows_skipped > 0 ? `, ${log.rows_skipped} skipped` : ''}
                {log.rows_failed > 0 ? `, ${log.rows_failed} failed` : ''}
              </span>
              <span className="text-muted-foreground">{formatDuration(log.duration_ms)}</span>
              <span className="text-muted-foreground">{formatDateTime(log.imported_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
