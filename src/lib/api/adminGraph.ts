/**
 * @file lib/api/adminGraph.ts
 * @description Frontend API wrappers for the Admin Graph module (WP-ADMIN-COMP-08).
 *
 * Backend contract (verified against core/src/modules/admin/graph/
 * graphAdmin.routes.js, graphAdmin.controller.js, and
 * graphImport.service.js — nothing here is invented):
 *
 *   POST /api/v1/admin/graph/import/:datasetType   → importAdminGraphDataset
 *   POST /api/v1/admin/graph/preview/:datasetType  → previewAdminGraphDataset
 *   GET  /api/v1/admin/graph/metrics               → getAdminGraphMetrics
 *   GET  /api/v1/admin/graph/validate               → validateAdminGraph
 *   GET  /api/v1/admin/graph/dataset-statuses       → getAdminGraphDatasetStatuses
 *   GET  /api/v1/admin/graph/health                 → getAdminGraphHealth
 *   GET  /api/v1/admin/graph/alerts                 → getAdminGraphAlerts
 *   GET  /api/v1/admin/graph/stats                  → getAdminGraphStats
 *   GET  /api/v1/admin/graph/import-logs            → getAdminGraphImportLogs
 *
 * All routes require authenticate + requireAdmin + requireElevatedSession
 * (enforced server-side at the mount point in server.js) — this module
 * never sends admin identity in the request body; the backend derives it
 * from the JWT (req.user.id).
 *
 * Every field below mirrors a real response field produced by
 * graphImport.service.js / graphAdmin.controller.js — nothing here is
 * fabricated. Where the controller's response shape differs slightly from
 * the raw service return value (e.g. `importLogs` normalises legacy column
 * aliases), the TYPE reflects the CONTROLLER's output, since that's what
 * actually crosses the wire.
 */

import { apiRequest } from './core';

// ─────────────────────────────────────────────────────────────────────────────
// SHARED TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Mirrors GRAPH_DATASET_TYPES in graph.constants.js exactly. */
export const GRAPH_DATASET_TYPES = [
  'roles',
  'skills',
  'role_skills',
  'role_transitions',
  'skill_relationships',
  'role_education',
  'role_salary_market',
  'role_market_demand',
] as const;

export type GraphDatasetType = (typeof GRAPH_DATASET_TYPES)[number];

/** Row-level field validation failure (required column missing/empty). */
export interface GraphFieldError {
  row: number;
  field: string;
  type: 'field';
  message: string;
}

/** Row-level duplicate-within-file failure (same natural key twice in one CSV). */
export interface GraphDuplicateError {
  row: number;
  field: string;
  type: 'duplicate';
  message: string;
}

/** Row-level foreign-key violation (referenced id not found in the target table). */
export interface GraphFkError {
  row: number;
  field: string;
  type: 'fk';
  message: string;
}

/** A write failure for one batch during the persist phase (not row-scoped). */
export interface GraphWriteError {
  row: 0;
  type: 'write';
  message: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT / PREVIEW — POST /import/:datasetType, POST /preview/:datasetType
// ─────────────────────────────────────────────────────────────────────────────

export type GraphImportMode = 'append' | 'replace';

export interface ImportGraphDatasetOptions {
  mode?: GraphImportMode;
}

/** Shape returned when preview=true (importGraphDataset short-circuits before writing). */
export interface GraphPreviewResult {
  datasetType: GraphDatasetType;
  processed: number;
  importable: number;
  fieldErrors: GraphFieldError[];
  duplicateErrors: GraphDuplicateError[];
  fkErrors: GraphFkError[];
  errorCount: number;
  /** First 10 importable rows, for a spot-check before committing. */
  preview: Record<string, unknown>[];
}

/** Shape returned when preview=false (rows have actually been written). */
export interface GraphImportResult {
  datasetType: GraphDatasetType;
  processed: number;
  imported: number;
  importable: number;
  skipped: number;
  fieldErrors: GraphFieldError[];
  duplicateErrors: GraphDuplicateError[];
  fkErrors: GraphFkError[];
  writeErrors: GraphWriteError[];
  errorCount: number;
  importedAt: string;
  mode: GraphImportMode;
  adminId: string;
}

const BASE_URL = '/api/v1/admin/graph';

// NOTE: graphAdmin.controller.js#importDataset responds with
// `{ success: true, meta: {...}, data: <GraphImportResult> }`. apiRequest()
// (see lib/api/core/api-parser.ts#parseBackendSuccess) unwraps and returns
// only the `data` field — the sibling `meta` block (duration_ms,
// throughput_rows_per_sec, cache_warmed) is not exposed to callers through
// this client, matching how every other admin API client in this codebase
// (e.g. adminJobs.ts) already treats `meta`. If that block becomes needed
// in the UI, it requires a change to the shared apiRequest unwrap, not a
// per-endpoint workaround here.

/**
 * Commit a CSV import for one dataset type. mode defaults to 'append' on
 * the backend if omitted (see graphAdmin.controller.js#getMode).
 *
 * Returns a 200 on a fully-clean import and a 207 (partial success) when
 * some rows imported and some failed — apiRequest treats both as success
 * responses; the caller inspects `data.errorCount` / `data.skipped` to
 * distinguish full vs. partial success. A wholly-failed request (e.g. bad
 * file, wrong datasetType) surfaces as an ApiClientError instead.
 */
export function importAdminGraphDataset(
  datasetType: GraphDatasetType,
  file: File,
  options?: ImportGraphDatasetOptions,
): Promise<GraphImportResult> {
  const form = new FormData();
  form.append('file', file);
  if (options?.mode) form.append('mode', options.mode);

  // No Content-Type header — apiRequest() detects the FormData body and lets
  // the browser set 'multipart/form-data; boundary=...' itself. See the
  // identical pattern (and rationale) in lib/api/adminJobs.ts#uploadAdminJobsCsv.
  return apiRequest<GraphImportResult>({
    url:    `${BASE_URL}/import/${datasetType}`,
    method: 'POST',
    data:   form,
  });
}

/**
 * Dry-run a CSV import: runs the same field/duplicate/FK validation as a
 * real import but never writes to the database. Used to show the admin a
 * preview + error summary before they commit.
 */
export function previewAdminGraphDataset(
  datasetType: GraphDatasetType,
  file: File,
  options?: ImportGraphDatasetOptions,
): Promise<GraphPreviewResult> {
  const form = new FormData();
  form.append('file', file);
  if (options?.mode) form.append('mode', options.mode);

  return apiRequest<GraphPreviewResult>({
    url:    `${BASE_URL}/preview/${datasetType}`,
    method: 'POST',
    data:   form,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// METRICS — GET /metrics
// ─────────────────────────────────────────────────────────────────────────────

/** Backed by the `graph_metrics` DB view (see graphImport.service.js#getGraphMetrics). */
export interface GraphMetrics {
  total_roles: number;
  total_skills: number;
  total_role_transitions: number;
  total_skill_relationships: number;
  total_role_skills: number;
}

export function getAdminGraphMetrics(): Promise<GraphMetrics> {
  return apiRequest<GraphMetrics>({ url: `${BASE_URL}/metrics`, method: 'GET' });
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION — GET /validate
// ─────────────────────────────────────────────────────────────────────────────

export interface GraphIntegrityOrphanSample {
  id: string | number | null;
  field: string;
  value: unknown;
  missingFrom: string;
}

export interface GraphIntegrityIssue {
  dataset: GraphDatasetType;
  collection: string;
  orphan_count: number;
  sample: GraphIntegrityOrphanSample[];
}

/** GET /admin/graph/validate response (see graphImport.service.js#validateGraphIntegrity). */
export interface GraphIntegrityReport {
  checkedAt: string;
  rowsChecked: number;
  orphanCount: number;
  valid: boolean;
  issues: GraphIntegrityIssue[];
}

export function validateAdminGraph(): Promise<GraphIntegrityReport> {
  return apiRequest<GraphIntegrityReport>({ url: `${BASE_URL}/validate`, method: 'GET' });
}

// ─────────────────────────────────────────────────────────────────────────────
// DATASET STATUSES — GET /dataset-statuses
// ─────────────────────────────────────────────────────────────────────────────

/** One entry per GRAPH_DATASET_TYPES (see graphImport.service.js#getDatasetStatuses). */
export interface GraphDatasetStatus {
  datasetType: GraphDatasetType;
  collection: string;
  /** null only when the row-count query itself failed. */
  rowCount: number | null;
  lastImportedAt: string | null;
  lastImportMode: GraphImportMode | null;
  lastAdminUserId: string | null;
  lastRowsImported: number | null;
  lastRowsFailed: number | null;
}

export function getAdminGraphDatasetStatuses(): Promise<GraphDatasetStatus[]> {
  return apiRequest<GraphDatasetStatus[]>({ url: `${BASE_URL}/dataset-statuses`, method: 'GET' });
}

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH — GET /health
// ─────────────────────────────────────────────────────────────────────────────

export type GraphHealthStatus = 'healthy' | 'degraded' | 'critical';

/** Per-domain component status (WP-ADMIN-COMP-08-R21 health decoupling). */
export type GraphHealthComponentStatus = 'healthy' | 'degraded' | 'critical';

/**
 * GET /admin/graph/health response (see graphImport.service.js#getGraphHealth).
 *
 * WP-ADMIN-COMP-08-R21: `integrity.lookupFailures` and `components` are
 * additive fields — existing consumers reading `status`/`metrics`/
 * `integrity.valid`/`integrity.orphanCount`/`integrity.rowsChecked` are
 * unaffected. `components` makes explicit that this response intentionally
 * combines two domains: the canonical Career Graph (`metrics`) and the
 * Legacy Bulk Graph validation/lookup signal (`integrity`).
 */
export interface GraphHealth {
  status: GraphHealthStatus;
  checkedAt: string;
  /** Career Graph domain — canonical `graph_metrics` counts. */
  metrics: GraphMetrics;
  /** Legacy Bulk Graph domain — FK integrity/validation signal. */
  integrity: {
    valid: boolean;
    orphanCount: number;
    rowsChecked: number;
    /** Count of FK checks whose lookup authority itself was unreachable. */
    lookupFailures: number;
  };
  /** Per-domain breakdown backing the combined `status` above. */
  components: {
    careerGraph: GraphHealthComponentStatus;
    legacyBulkGraph: GraphHealthComponentStatus;
  };
}

export function getAdminGraphHealth(): Promise<GraphHealth> {
  return apiRequest<GraphHealth>({ url: `${BASE_URL}/health`, method: 'GET' });
}

// ─────────────────────────────────────────────────────────────────────────────
// ALERTS — GET /alerts
// ─────────────────────────────────────────────────────────────────────────────

export type GraphAlertSeverity = 'warning' | 'critical';
export type GraphAlertType = 'orphaned_fk' | 'import_failures';

/** One entry from getGraphAlerts() — only the two alert types the backend actually emits. */
export interface GraphAlert {
  severity: GraphAlertSeverity;
  type: GraphAlertType;
  dataset: string | null;
  message: string;
  detectedAt: string | null;
}

export function getAdminGraphAlerts(): Promise<GraphAlert[]> {
  return apiRequest<GraphAlert[]>({ url: `${BASE_URL}/alerts`, method: 'GET' });
}

// ─────────────────────────────────────────────────────────────────────────────
// STATISTICS — GET /stats
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /admin/graph/stats response (see
 * graphImport.service.js#getLegacyBulkGraphStats, renamed in
 * WP-ADMIN-COMP-08-R21 from getCareerGraphStats — this is Legacy Bulk
 * Graph connectivity, computed from `roles`/`role_transitions`, not the
 * canonical career_roles/career_role_transitions).
 */
export interface GraphStats {
  totalRoles: number;
  totalTransitions: number;
  avgTransitionsPerRole: number;
  isolatedRoleCount: number;
  topConnectedRoles: { roleId: string; connections: number }[];
}

export function getAdminGraphStats(): Promise<GraphStats> {
  return apiRequest<GraphStats>({ url: `${BASE_URL}/stats`, method: 'GET' });
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT HISTORY — GET /import-logs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One normalised import_logs row, as shaped by graphAdmin.controller.js's
 * `importLogs` handler (which maps legacy column aliases onto a single
 * canonical field set) — NOT the raw `import_logs` table row.
 */
export interface GraphImportLogEntry {
  id: string;
  dataset_name: string | null;
  entity_type: string | null;
  admin_user_id: string | null;
  imported_at: string | null;
  rows_processed: number;
  rows_imported: number;
  rows_skipped: number;
  rows_failed: number;
  duplicate_errors: number;
  fk_errors: number;
  duration_ms: number | null;
  import_mode: GraphImportMode;
}

export interface GraphImportLogsResponse {
  logs: GraphImportLogEntry[];
  count: number;
}

export interface GetAdminGraphImportLogsParams {
  /** Server clamps to [1, 200]; defaults to 50 if omitted. */
  limit?: number;
}

export function getAdminGraphImportLogs(
  params?: GetAdminGraphImportLogsParams,
): Promise<GraphImportLogsResponse> {
  return apiRequest<GraphImportLogsResponse>({
    url:    `${BASE_URL}/import-logs`,
    method: 'GET',
    params: params as Record<string, unknown> | undefined,
  });
}