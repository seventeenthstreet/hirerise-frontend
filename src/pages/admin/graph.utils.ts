/**
 * @file src/pages/admin/graph.utils.ts
 * @description WP-ADMIN-COMP-08 — small formatting helpers shared between
 * GraphPage.tsx and GraphImportPanel.tsx. Mirrors the local formatDateTime
 * helpers already duplicated per-page elsewhere in admin (e.g.
 * JobSyncPanel.tsx, JobDetailPage.tsx) — pulled into one file here only
 * because GraphPage and GraphImportPanel both need the identical formatting
 * and live in the same module.
 */

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(ms: number | null): string {
  if (ms === null || Number.isNaN(ms)) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Human-readable label for a GRAPH_DATASET_TYPES value, e.g. "role_transitions" → "Role Transitions". */
export function formatDatasetLabel(datasetType: string): string {
  return datasetType
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
