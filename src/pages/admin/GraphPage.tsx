/**
 * @file src/pages/admin/GraphPage.tsx
 * @description WP-ADMIN-COMP-08 — Graph Administration.
 *
 * Route: /admin/graph
 *
 * Replaces the stub left after the Graph backend was completed (see the
 * WP-ADMIN-COMP-08 repository-audit completion report). Built on the same
 * shell/section conventions as JobsPage.tsx, with the CSV import + import
 * history split out into GraphImportPanel.tsx (mirroring JobsPage/
 * JobSyncPanel's split).
 *
 * Capabilities implemented here — every one backed by a real, verified
 * endpoint (see lib/api/adminGraph.ts's header comment for the full route
 * list; nothing below is fabricated):
 *   - Overview        — canonical Career Graph health status, key metrics, alerts
 *   - Dataset Administration — Legacy Bulk Graph/import per-dataset row counts + last import
 *   - Validation      — Legacy Bulk Graph FK integrity report, re-runnable on demand
 *   - Statistics       — Legacy Bulk Graph connectivity stats (see graphImport.service.js#getLegacyBulkGraphStats)
 *   - CSV Import       — preview + import, per-dataset, with error summaries
 *   - Import History   — recent import_logs entries
 *
 * WP-ADMIN-COMP-08-R21: Overview/health represent the canonical Career
 * Graph; Dataset Administration, Validation, and Statistics represent the
 * Legacy Bulk Graph/import domain. A difference between the two is not,
 * by itself, a defect — see graphImport.service.js#getGraphHealth for how
 * the two domains combine into a single health status without either one
 * masking the other.
 *
 * NOT implemented (no backend support exists for these — see the graph
 * admin route/controller/service; there is no single-row create/edit/
 * delete endpoint, only bulk CSV import):
 *   - Create/Edit/Delete a single role, skill, transition, etc.
 *   - Interactive graph visualization / node-link exploration (that's the
 *     separate, unrelated /admin/graph-intelligence surface — out of scope
 *     for this WP; see graphIntelligence.routes.js)
 */

import type { UseQueryResult } from '@tanstack/react-query';
import { PageShell, Card, CardHeader, CardContent } from '@/components/ui';
import { StatusBadge, type StatusBadgeVariant } from '@/components/admin-dashboard';
import {
  useAdminGraphMetrics,
  useAdminGraphValidation,
  useAdminGraphDatasetStatuses,
  useAdminGraphHealth,
  useAdminGraphAlerts,
  useAdminGraphStats,
  useAdminGraphImportLogs,
} from '@/hooks/admin/useAdminGraph';
import type {
  GraphHealth,
  GraphHealthStatus,
  GraphMetrics,
  GraphAlert,
  GraphIntegrityReport,
  GraphDatasetStatus,
  GraphStats,
} from '@/lib/api/adminGraph';
import type { ApiClientError } from '@/lib/api/core';
import { formatDateTime, formatDatasetLabel } from './graph.utils';
import { GraphImportPanel } from './GraphImportPanel';

const HEALTH_STATUS_TO_BADGE: Record<GraphHealthStatus, StatusBadgeVariant> = {
  healthy:  'healthy',
  degraded: 'degraded',
  critical: 'down',
};

export default function GraphPage() {
  const metrics = useAdminGraphMetrics();
  const validation = useAdminGraphValidation();
  const datasetStatuses = useAdminGraphDatasetStatuses();
  const health = useAdminGraphHealth();
  const alerts = useAdminGraphAlerts();
  const stats = useAdminGraphStats();
  const importLogs = useAdminGraphImportLogs(20);

  return (
    <PageShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Graph</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Career graph administration — roles, skills, transitions, and
            relationships. Read-only except for CSV import below; there is
            no single-row create/edit/delete workflow.
          </p>
        </div>

        <OverviewSection health={health} metrics={metrics} alerts={alerts} />
        <DatasetAdministrationSection datasetStatuses={datasetStatuses} />
        <ValidationSection validation={validation} />
        <StatisticsSection stats={stats} />
        <GraphImportPanel importLogs={importLogs} />
      </div>
    </PageShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERVIEW — health + metrics + alerts
// ─────────────────────────────────────────────────────────────────────────────

interface OverviewSectionProps {
  health: UseQueryResult<GraphHealth, ApiClientError>;
  metrics: UseQueryResult<GraphMetrics, ApiClientError>;
  alerts: UseQueryResult<GraphAlert[], ApiClientError>;
}

function OverviewSection({ health, metrics, alerts }: OverviewSectionProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Career Graph Overview</h2>
          <p className="text-xs text-muted-foreground">Canonical Career Graph metrics (graph_metrics).</p>
        </div>
        {health.data && (
          <StatusBadge
            variant={HEALTH_STATUS_TO_BADGE[health.data.status]}
            label={health.data.status.charAt(0).toUpperCase() + health.data.status.slice(1)}
          />
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {health.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading health…</p>
        ) : health.isError ? (
          <p className="text-sm text-muted-foreground">Unable to load graph health.</p>
        ) : null}

        <MetricsGrid metrics={metrics} />
        <AlertsList alerts={alerts} />
      </CardContent>
    </Card>
  );
}

function MetricsGrid({ metrics }: { metrics: UseQueryResult<GraphMetrics, ApiClientError> }) {
  if (metrics.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading metrics…</p>;
  }
  if (metrics.isError) {
    return <p className="text-sm text-muted-foreground">Unable to load graph metrics.</p>;
  }
  if (!metrics.data) return null;

  const entries: { label: string; value: number }[] = [
    { label: 'Roles', value: metrics.data.total_roles },
    { label: 'Skills', value: metrics.data.total_skills },
    { label: 'Role Transitions', value: metrics.data.total_role_transitions },
    { label: 'Skill Relationships', value: metrics.data.total_skill_relationships },
    { label: 'Role Skills', value: metrics.data.total_role_skills },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {entries.map((entry) => (
        <div key={entry.label} className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">{entry.label}</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{entry.value}</p>
        </div>
      ))}
    </div>
  );
}

function AlertsList({ alerts }: { alerts: UseQueryResult<GraphAlert[], ApiClientError> }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-foreground">Alerts</h3>
      {alerts.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading alerts…</p>
      ) : alerts.isError ? (
        <p className="text-sm text-muted-foreground">Unable to load alerts.</p>
      ) : (alerts.data?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">No active alerts.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {alerts.data!.map((alert, i) => (
            <li
              key={i}
              className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <div>
                <p className="text-foreground">{alert.message}</p>
                <p className="text-xs text-muted-foreground">
                  {alert.dataset ? formatDatasetLabel(alert.dataset) : '—'} · {formatDateTime(alert.detectedAt)}
                </p>
              </div>
              <StatusBadge variant={alert.severity === 'critical' ? 'down' : 'degraded'} label={alert.severity} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DATASET ADMINISTRATION — per-dataset row counts + last import
// ─────────────────────────────────────────────────────────────────────────────

interface DatasetAdministrationSectionProps {
  datasetStatuses: UseQueryResult<GraphDatasetStatus[], ApiClientError>;
}

function DatasetAdministrationSection({ datasetStatuses }: DatasetAdministrationSectionProps) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold text-foreground">Dataset Administration</h2>
        <p className="text-xs text-muted-foreground">
          Legacy Bulk Graph / import datasets — separate from the canonical Career Graph shown above.
        </p>
      </CardHeader>
      <CardContent>
        {datasetStatuses.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading dataset statuses…</p>
        ) : datasetStatuses.isError ? (
          <p className="text-sm text-muted-foreground">Unable to load dataset statuses.</p>
        ) : (datasetStatuses.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No datasets found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Dataset</th>
                  <th className="py-2 pr-4 font-medium">Rows</th>
                  <th className="py-2 pr-4 font-medium">Last Import</th>
                  <th className="py-2 pr-4 font-medium">Last Result</th>
                </tr>
              </thead>
              <tbody>
                {datasetStatuses.data!.map((row) => (
                  <tr key={row.datasetType} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4 text-foreground">{formatDatasetLabel(row.datasetType)}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{row.rowCount ?? '—'}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{formatDateTime(row.lastImportedAt)}</td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {row.lastImportedAt
                        ? `${row.lastRowsImported ?? 0} imported${row.lastRowsFailed ? `, ${row.lastRowsFailed} failed` : ''}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION — FK integrity report
// ─────────────────────────────────────────────────────────────────────────────

interface ValidationSectionProps {
  validation: UseQueryResult<GraphIntegrityReport, ApiClientError>;
}

function ValidationSection({ validation }: ValidationSectionProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Validation</h2>
          <p className="text-xs text-muted-foreground">
            Legacy Bulk Graph / import integrity — findings here do not indicate canonical Career Graph corruption.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void validation.refetch()}
          disabled={validation.isFetching}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          {validation.isFetching ? 'Validating…' : 'Run validation'}
        </button>
      </CardHeader>
      <CardContent>
        {validation.isLoading ? (
          <p className="text-sm text-muted-foreground">Running validation…</p>
        ) : validation.isError ? (
          <p className="text-sm text-muted-foreground">Unable to run validation.</p>
        ) : !validation.data ? null : validation.data.valid ? (
          <p className="text-sm text-foreground">
            No FK integrity issues found across {validation.data.rowsChecked} row(s) checked
            (as of {formatDateTime(validation.data.checkedAt)}).
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-foreground">
              {validation.data.orphanCount} FK issue(s) found across {validation.data.rowsChecked} row(s) checked
              (as of {formatDateTime(validation.data.checkedAt)}).
            </p>
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {validation.data.issues.map((issue) => (
                <li key={issue.dataset} className="px-4 py-3 text-sm">
                  <p className="text-foreground">
                    {formatDatasetLabel(issue.dataset)} — {issue.orphan_count} orphaned reference(s)
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                    {issue.sample.slice(0, 5).map((sample, i) => (
                      <li key={i}>
                        {sample.field}="{String(sample.value)}" not found in {sample.missingFrom}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STATISTICS — career graph connectivity
// ─────────────────────────────────────────────────────────────────────────────

interface StatisticsSectionProps {
  stats: UseQueryResult<GraphStats, ApiClientError>;
}

function StatisticsSection({ stats }: StatisticsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold text-foreground">Statistics</h2>
        <p className="text-xs text-muted-foreground">
          Legacy Bulk Graph connectivity (roles / role_transitions) — not the canonical Career Graph.
        </p>
      </CardHeader>
      <CardContent>
        {stats.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading statistics…</p>
        ) : stats.isError ? (
          <p className="text-sm text-muted-foreground">Unable to load statistics.</p>
        ) : !stats.data ? null : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Legacy Roles</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{stats.data.totalRoles}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Legacy Transitions</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{stats.data.totalTransitions}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Avg Transitions / Role</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{stats.data.avgTransitionsPerRole}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Isolated Roles</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{stats.data.isolatedRoleCount}</p>
              </div>
            </div>

            {stats.data.topConnectedRoles.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-foreground">Most Connected Roles</h3>
                <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                  {stats.data.topConnectedRoles.map((role) => (
                    <li key={role.roleId} className="flex items-center justify-between px-4 py-2 text-sm">
                      <span className="text-foreground">{role.roleId}</span>
                      <span className="text-muted-foreground">{role.connections} connection(s)</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}