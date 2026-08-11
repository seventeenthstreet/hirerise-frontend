/**
 * pages/admin/master-data/ImportPage.tsx
 *
 * WP-ADMIN-COMP-03 — CMS bulk Import. Deliberately minimal per the WP: input,
 * submit, loading state, success result, validation/error result. No Import
 * History/Logs page — the backend has no read-back endpoint for past imports.
 *
 * Not built on the generic Master Data table/form components (there's no
 * list/edit/delete concept here) — it's a single-purpose submit-and-show-result
 * screen, reusing MasterDataStatusBanner for consistency.
 */

import { useMemo, useState } from 'react';
import { MasterDataStatusBanner, type MasterDataStatus } from '@/components/master-data';
import { PageShell } from '@/components/ui';
import { isApiClientError } from '@/lib/api/core';
import {
  IMPORTABLE_DATASET_TYPES,
  extractImportResultFromError,
  type ImportableDatasetType,
  type ImportResultData,
} from '@/lib/api/adminCmsImport';
import { useRunAdminCmsImport } from '@/hooks/admin/useAdminCmsImport';

const DATASET_LABELS: Record<ImportableDatasetType, string> = {
  skills: 'Skills',
  roles: 'Roles',
  jobFamilies: 'Job Families',
  educationLevels: 'Education Levels',
};

function parseRows(raw: string): { name: string }[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((name) => ({ name }));
}

export default function ImportPage() {
  const [datasetType, setDatasetType] = useState<ImportableDatasetType>('skills');
  const [rawInput, setRawInput] = useState('');
  const [status, setStatus] = useState<MasterDataStatus | null>(null);
  const [result, setResult] = useState<ImportResultData | null>(null);

  const runImport = useRunAdminCmsImport();

  const rows = useMemo(() => parseRows(rawInput), [rawInput]);
  const canSubmit = rows.length > 0 && rows.length <= 1000 && !runImport.isPending;

  function handleSubmit() {
    setStatus(null);
    setResult(null);
    runImport.mutate(
      { datasetType, rows },
      {
        onSuccess: (data) => {
          setResult(data);
          const message =
            data.duplicates.length > 0
              ? `Imported ${data.inserted} of ${data.total} — ${data.duplicates.length} duplicate(s) skipped.`
              : `Imported ${data.inserted} of ${data.total}.`;
          setStatus({ kind: 'success', message });
        },
        onError: (err) => {
          const partial = extractImportResultFromError(err);
          if (partial) setResult(partial);
          const message = isApiClientError(err) ? err.message : 'Import failed. Please try again.';
          setStatus({ kind: 'error', message });
        },
      },
    );
  }

  return (
    <PageShell>
      <div className="flex flex-col gap-6 max-w-2xl">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Import</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bulk-create records by name. One name per line, up to 1000 rows.
          </p>
        </div>

        <MasterDataStatusBanner status={status} onDismiss={() => setStatus(null)} />

        <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
          <div>
            <label htmlFor="import-dataset-type" className="block text-sm font-medium text-foreground mb-1">
              Dataset
            </label>
            <select
              id="import-dataset-type"
              value={datasetType}
              onChange={(e) => setDatasetType(e.target.value as ImportableDatasetType)}
              disabled={runImport.isPending}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {IMPORTABLE_DATASET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {DATASET_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="import-rows" className="block text-sm font-medium text-foreground mb-1">
              Names (one per line)
            </label>
            <textarea
              id="import-rows"
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              disabled={runImport.isPending}
              rows={10}
              placeholder={'e.g.\nPython\nKubernetes\nProject Management'}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {rows.length} row{rows.length === 1 ? '' : 's'} detected
              {rows.length > 1000 ? ' — exceeds the 1000-row limit' : ''}.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {runImport.isPending ? 'Importing…' : 'Run import'}
            </button>
          </div>
        </div>

        {result && (
          <div className="rounded-xl border border-border p-4">
            <h2 className="text-sm font-semibold text-foreground mb-2">Result</h2>
            <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div><dt className="text-muted-foreground">Total</dt><dd className="font-medium">{result.total}</dd></div>
              <div><dt className="text-muted-foreground">Inserted</dt><dd className="font-medium">{result.inserted}</dd></div>
              <div><dt className="text-muted-foreground">Skipped</dt><dd className="font-medium">{result.skipped}</dd></div>
              <div><dt className="text-muted-foreground">Duplicates</dt><dd className="font-medium">{result.duplicates.length}</dd></div>
            </dl>

            {result.errors.length > 0 && (
              <div className="mt-3">
                <h3 className="text-xs font-semibold text-destructive mb-1">Row errors</h3>
                <ul className="max-h-40 overflow-y-auto text-xs text-muted-foreground list-disc pl-4">
                  {result.errors.map((e, i) => (
                    <li key={i}>{e.name ? `${e.name}: ` : ''}{e.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.duplicates.length > 0 && (
              <div className="mt-3">
                <h3 className="text-xs font-semibold text-foreground mb-1">Duplicates skipped</h3>
                <ul className="max-h-40 overflow-y-auto text-xs text-muted-foreground list-disc pl-4">
                  {result.duplicates.map((d, i) => (
                    <li key={i}>{typeof d === 'string' ? d : d.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}
