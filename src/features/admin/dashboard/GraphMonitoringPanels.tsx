'use client';

/**
 * GraphMonitoringPanels.tsx
 *
 * Four Career Intelligence monitoring panels for the Admin Dashboard:
 *   1. Graph Health Panel        — coverage % per dataset
 *   2. Dataset Status Panel      — loaded / partial / missing per collection
 *   3. Graph Alerts Panel        — automatic issue detection
 *   4. Career Graph Statistics   — path depth, longest/shortest path
 */

import { useQuery } from '@tanstack/react-query';
import { adminService } from '@/services/adminService';
import { cn } from '@/utils/cn';
import type { GraphHealth, GraphAlert, CareerGraphStats, DatasetStatusEntry, GraphDatasetType } from '@/types/admin';
import Link from 'next/link';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pctColor(pct: number) {
  if (pct >= 80) return 'text-emerald-600';
  if (pct >= 40) return 'text-amber-600';
  return 'text-red-500';
}

function pctBarColor(pct: number) {
  if (pct >= 80) return 'bg-emerald-500';
  if (pct >= 40) return 'bg-amber-400';
  return 'bg-red-400';
}

function PanelShell({ title, subtitle, action, children, className }: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-xl border border-surface-100 bg-white shadow-card overflow-hidden', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-surface-50 px-5 py-4">
        <div>
          <h3 className="text-sm font-bold text-surface-900">{title}</h3>
          {subtitle && <p className="text-[11px] text-surface-400 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-surface-100', className)} />;
}

// ─── 1. Graph Health Panel ────────────────────────────────────────────────────

export function GraphHealthPanel() {
  const { data, isLoading } = useQuery({
    queryKey:  ['graphHealth'],
    queryFn:   () => adminService.getGraphHealth(),
    staleTime: 60_000,
  });

  const metrics: { label: string; pct: number; count: number }[] = data
    ? [
        { label: 'Roles with Skills',       pct: data.roles_with_skills_pct,      count: data.roles_with_skills },
        { label: 'Roles with Transitions',  pct: data.roles_with_transitions_pct, count: data.roles_with_transitions },
        { label: 'Roles with Education',    pct: data.roles_with_education_pct,   count: data.roles_with_education },
        { label: 'Roles with Salary',       pct: data.roles_with_salary_pct,      count: data.roles_with_salary },
      ]
    : [];

  const overallHealth = metrics.length
    ? Math.round(metrics.reduce((s, m) => s + m.pct, 0) / metrics.length)
    : 0;

  return (
    <PanelShell
      title="Graph Health"
      subtitle="Coverage of critical graph datasets"
      action={
        data && (
          <div className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold',
            overallHealth >= 80 ? 'bg-emerald-50 text-emerald-700' :
            overallHealth >= 40 ? 'bg-amber-50 text-amber-700' :
                                  'bg-red-50 text-red-600'
          )}>
            <span className={cn('h-1.5 w-1.5 rounded-full',
              overallHealth >= 80 ? 'bg-emerald-500' :
              overallHealth >= 40 ? 'bg-amber-400' : 'bg-red-500'
            )} />
            {overallHealth}% overall
          </div>
        )
      }
    >
      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
      ) : !data || data.total_roles === 0 ? (
        <div className="py-4 text-center">
          <p className="text-sm font-semibold text-surface-400">No roles loaded</p>
          <Link href="/admin/import-center" className="mt-1.5 inline-block text-xs text-hr-600 hover:underline">
            Import roles dataset →
          </Link>
        </div>
      ) : (
        <div className="space-y-3.5">
          {metrics.map(m => (
            <div key={m.label}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-surface-700">{m.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-surface-400 tabular-nums">{m.count.toLocaleString()} roles</span>
                  <span className={cn('text-xs font-bold tabular-nums w-9 text-right', pctColor(m.pct))}>{m.pct}%</span>
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-surface-100">
                <div
                  className={cn('h-1.5 rounded-full transition-all duration-700', pctBarColor(m.pct))}
                  style={{ width: `${m.pct}%` }}
                />
              </div>
            </div>
          ))}
          <p className="pt-1 text-[10px] text-surface-300">
            Based on {data.total_roles.toLocaleString()} total roles · checked {new Date(data.checked_at).toLocaleTimeString()}
          </p>
        </div>
      )}
    </PanelShell>
  );
}

// ─── 2. Dataset Status Panel ──────────────────────────────────────────────────

const DATASET_LABELS: Record<GraphDatasetType, string> = {
  roles:               'Roles',
  skills:              'Skills',
  role_skills:         'Role Skills',
  role_transitions:    'Transitions',
  skill_relationships: 'Skill Relationships',
  role_education:      'Education Mapping',
  role_salary_market:  'Salary Benchmarks',
};

const STATUS_CONFIG = {
  loaded:  { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: '✓', label: 'Loaded' },
  partial: { dot: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700 border-amber-200',       icon: '~', label: 'Partial' },
  missing: { dot: 'bg-red-500',     badge: 'bg-red-50 text-red-600 border-red-200',             icon: '✗', label: 'Missing' },
};

export function DatasetStatusPanel() {
  const { data: statuses, isLoading } = useQuery({
    queryKey:  ['datasetStatuses'],
    queryFn:   () => adminService.getDatasetStatuses(),
    staleTime: 60_000,
  });

  const loaded  = statuses?.filter(s => s.status === 'loaded').length  ?? 0;
  const partial = statuses?.filter(s => s.status === 'partial').length ?? 0;
  const missing = statuses?.filter(s => s.status === 'missing').length ?? 0;

  return (
    <PanelShell
      title="Dataset Status"
      subtitle="Live status of each graph collection"
      action={
        statuses && (
          <div className="flex items-center gap-1.5">
            {missing > 0 && <span className="rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-600">{missing} missing</span>}
            {partial > 0 && <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700">{partial} partial</span>}
            {loaded > 0  && <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{loaded} loaded</span>}
          </div>
        )
      }
    >
      {isLoading ? (
        <div className="space-y-2.5">
          {[1,2,3,4,5,6,7].map(i => <Skeleton key={i} className="h-7 w-full" />)}
        </div>
      ) : (
        <div className="space-y-1.5">
          {(statuses ?? []).map((entry: DatasetStatusEntry) => {
            const cfg = STATUS_CONFIG[entry.status];
            return (
              <div key={entry.dataset} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-surface-50">
                <div className="flex items-center gap-2.5">
                  <span className={cn('h-2 w-2 rounded-full flex-shrink-0', cfg.dot)} />
                  <span className="text-sm font-medium text-surface-800">{DATASET_LABELS[entry.dataset] ?? entry.dataset}</span>
                </div>
                <div className="flex items-center gap-3">
                  {entry.count > 0 && (
                    <span className="text-[11px] tabular-nums text-surface-400">{entry.count.toLocaleString()}</span>
                  )}
                  <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold', cfg.badge)}>
                    <span>{cfg.icon}</span> {cfg.label}
                  </span>
                </div>
              </div>
            );
          })}
          <div className="pt-2">
            <Link href="/admin/import-center" className="block w-full rounded-lg border border-surface-100 py-2 text-center text-xs font-medium text-hr-600 hover:bg-hr-50 transition-colors">
              Manage Datasets →
            </Link>
          </div>
        </div>
      )}
    </PanelShell>
  );
}

// ─── 3. Graph Alerts Panel ────────────────────────────────────────────────────

const ALERT_CONFIG = {
  critical: { bg: 'bg-red-50 border-red-200',    icon: '🔴', text: 'text-red-700',   badge: 'bg-red-100 text-red-700' },
  warn:     { bg: 'bg-amber-50 border-amber-200', icon: '⚠',  text: 'text-amber-800', badge: 'bg-amber-100 text-amber-700' },
  info:     { bg: 'bg-blue-50 border-blue-200',   icon: 'ℹ',  text: 'text-blue-800',  badge: 'bg-blue-100 text-blue-700' },
};

export function GraphAlertsPanel() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey:  ['graphAlerts'],
    queryFn:   () => adminService.getGraphAlerts(),
    staleTime: 120_000,
  });

  return (
    <PanelShell
      title="Graph Alerts"
      subtitle="Automatically detected graph issues"
      action={
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="rounded-lg border border-surface-200 px-3 py-1.5 text-[11px] font-medium text-surface-600 hover:bg-surface-50 disabled:opacity-50 transition-colors"
        >
          {isFetching ? 'Checking…' : '↻ Refresh'}
        </button>
      }
    >
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : !data?.alerts.length ? (
        <div className="flex flex-col items-center gap-2 py-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-xl">✓</div>
          <p className="text-sm font-semibold text-emerald-700">No graph issues detected</p>
          <p className="text-xs text-surface-400">All datasets are healthy</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.alerts.map((alert: GraphAlert, i: number) => {
            const cfg = ALERT_CONFIG[alert.type] ?? ALERT_CONFIG.info;
            return (
              <div key={i} className={cn('flex items-start gap-3 rounded-lg border p-3', cfg.bg)}>
                <span className="mt-0.5 text-sm flex-shrink-0">{cfg.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-xs font-semibold', cfg.text)}>{alert.message}</p>
                  <p className="text-[10px] text-surface-400 mt-0.5 font-mono">{alert.code}</p>
                </div>
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold flex-shrink-0', cfg.badge)}>
                  {alert.count.toLocaleString()}
                </span>
              </div>
            );
          })}
          <p className="pt-1 text-[10px] text-surface-300">
            Checked {data?.checked_at ? new Date(data.checked_at).toLocaleTimeString() : '—'}
          </p>
        </div>
      )}
    </PanelShell>
  );
}

// ─── 4. Career Graph Statistics Panel ────────────────────────────────────────

export function CareerGraphStatsPanel() {
  const { data, isLoading } = useQuery({
    queryKey:  ['careerGraphStats'],
    queryFn:   () => adminService.getCareerGraphStats(),
    staleTime: 300_000,
  });

  const stats: { label: string; value: string | number; sub: string; color: string }[] = data
    ? [
        { label: 'Avg Path Depth',    value: data.avg_path_depth,    sub: 'hops avg',       color: 'text-hr-600' },
        { label: 'Longest Path',      value: data.longest_path,      sub: 'max depth',      color: 'text-violet-600' },
        { label: 'Shortest Path',     value: data.shortest_path,     sub: 'min depth',      color: 'text-emerald-600' },
        { label: 'Total Transitions', value: data.total_transitions,  sub: 'graph edges',    color: 'text-surface-700' },
      ]
    : [];

  return (
    <PanelShell
      title="Career Graph Statistics"
      subtitle="Structural analysis of role transition graph"
    >
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : !data || data.total_transitions === 0 ? (
        <div className="py-4 text-center">
          <p className="text-sm font-semibold text-surface-400">No transition data</p>
          <Link href="/admin/import-center" className="mt-1.5 inline-block text-xs text-hr-600 hover:underline">
            Import role_transitions →
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {stats.map(s => (
              <div key={s.label} className="rounded-xl border border-surface-100 bg-surface-50 p-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-400">{s.label}</p>
                <p className={cn('mt-1 text-2xl font-bold tabular-nums', s.color)}>
                  {typeof s.value === 'number' ? s.value.toLocaleString() : s.value}
                </p>
                <p className="text-[10px] text-surface-400">{s.sub}</p>
              </div>
            ))}
          </div>
          {data.sampled_roles && data.sampled_roles < data.total_roles && (
            <p className="mt-3 text-[10px] text-surface-300">
              * Path depth sampled from {data.sampled_roles} of {data.total_roles} roles for performance
            </p>
          )}
        </>
      )}
    </PanelShell>
  );
}

// ─── Combined export for easy dashboard inclusion ─────────────────────────────

export function GraphMonitoringSection() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-surface-400">Career Intelligence</p>
        <Link href="/admin/import-center" className="text-xs font-medium text-hr-600 hover:text-hr-700">
          Import Center →
        </Link>
      </div>

      {/* Row 1: Health + Status side by side */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GraphHealthPanel />
        <DatasetStatusPanel />
      </div>

      {/* Row 2: Alerts + Stats side by side */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GraphAlertsPanel />
        <CareerGraphStatsPanel />
      </div>
    </div>
  );
}