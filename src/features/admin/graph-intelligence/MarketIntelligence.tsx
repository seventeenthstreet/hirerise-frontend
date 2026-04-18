'use client';

/**
 * MarketIntelligence.tsx
 *
 * Admin panel for the Career Opportunity Engine — Labor Market Intelligence.
 * Displays top growing, top demand, and top salary roles from role_market_demand.
 *
 * Data: GET /api/v1/admin/graph-intelligence/market-intelligence?country=
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminService } from '@/services/adminService';
import { cn } from '@/utils/cn';
import type { MarketIntelligenceData, MarketRoleEntry } from '@/types/admin';

// ─── Demand Badge ─────────────────────────────────────────────────────────────

const DEMAND_COLORS: Record<string, string> = {
  'Very High': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'High':      'bg-blue-50 text-blue-700 border-blue-200',
  'Moderate':  'bg-amber-50 text-amber-700 border-amber-200',
  'Low':       'bg-surface-100 text-surface-500 border-surface-200',
  'Very Low':  'bg-red-50 text-red-600 border-red-200',
};

function DemandBadge({ label }: { label: string }) {
  return (
    <span className={cn(
      'text-[10px] font-semibold border rounded-full px-2 py-0.5 uppercase tracking-wide',
      DEMAND_COLORS[label] ?? DEMAND_COLORS['Moderate']
    )}>
      {label}
    </span>
  );
}

// ─── Stat Bar ─────────────────────────────────────────────────────────────────

function StatBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(Math.round((value / max) * 100), 100);
  return (
    <div className="w-16 h-1.5 rounded-full bg-surface-100 overflow-hidden">
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Role Row ─────────────────────────────────────────────────────────────────

function RoleRow({
  rank, name, family, badge, metric, metricLabel, metricSuffix = '', barValue, barMax, barColor,
}: {
  rank: number;
  name: string;
  family?: string | null;
  badge?: string;
  metric: string | number;
  metricLabel: string;
  metricSuffix?: string;
  barValue?: number;
  barMax?: number;
  barColor?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-surface-50 last:border-0">
      <span className="text-[11px] font-bold text-surface-300 w-4 tabular-nums flex-shrink-0">
        {rank}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-surface-800 truncate">{name}</p>
        {family && <p className="text-[10px] text-surface-400 truncate">{family}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {badge && <DemandBadge label={badge} />}
        <div className="text-right">
          <p className="text-xs font-bold text-surface-800 tabular-nums">
            {typeof metric === 'number' ? metric.toLocaleString() : metric}{metricSuffix}
          </p>
          <p className="text-[10px] text-surface-400">{metricLabel}</p>
        </div>
        {barValue != null && barMax && barColor && (
          <StatBar value={barValue} max={barMax} color={barColor} />
        )}
      </div>
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  title, icon, count, children, accentColor,
}: {
  title: string;
  icon: React.ReactNode;
  count?: number;
  children: React.ReactNode;
  accentColor: string;
}) {
  return (
    <div className="rounded-xl border border-surface-100 bg-white overflow-hidden">
      <div className={cn('px-4 py-3 border-b border-surface-50 flex items-center gap-2.5', accentColor)}>
        <span className="opacity-70">{icon}</span>
        <h3 className="text-xs font-bold text-surface-800 uppercase tracking-wider">{title}</h3>
        {count != null && (
          <span className="ml-auto text-[10px] font-bold bg-white/60 text-surface-600 rounded-full px-2 py-0.5">
            {count}
          </span>
        )}
      </div>
      <div className="px-4">{children}</div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-8 text-center">
      <svg className="h-8 w-8 mx-auto mb-2 text-surface-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <p className="text-xs text-surface-400">{message}</p>
    </div>
  );
}

// ─── Summary Stats Bar ────────────────────────────────────────────────────────

function SummaryStats({ data }: { data: MarketIntelligenceData }) {
  const maxGrowth    = Math.max(...(data.top_growing_roles.map(r => r.growth_rate ?? 0)), 1);
  const topGrowthRole = data.top_growing_roles[0];
  const topDemandRole = data.top_demand_roles[0];
  const topSalaryRole = data.top_salary_roles[0];

  const stats = [
    {
      label: 'Fastest Growing',
      value: topGrowthRole ? `${topGrowthRole.growth_rate}% YoY` : '—',
      sub:   topGrowthRole?.role_name ?? 'No data',
      color: 'text-emerald-600',
      bg:    'bg-emerald-50',
    },
    {
      label: 'Highest Demand',
      value: topDemandRole ? topDemandRole.demand_label : '—',
      sub:   topDemandRole?.role_name ?? 'No data',
      color: 'text-blue-600',
      bg:    'bg-blue-50',
    },
    {
      label: 'Top Salary',
      value: topSalaryRole?.median_salary
        ? `${topSalaryRole.median_salary.toLocaleString()}`
        : '—',
      sub:   topSalaryRole?.role_name ?? 'No data',
      color: 'text-amber-600',
      bg:    'bg-amber-50',
    },
    {
      label: 'Roles Tracked',
      value: data.total_records?.toLocaleString() ?? '0',
      sub:   data.country ?? 'Global',
      color: 'text-surface-600',
      bg:    'bg-surface-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-6">
      {stats.map(s => (
        <div key={s.label} className={cn('rounded-xl p-4 border border-surface-100', s.bg)}>
          <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-1">{s.label}</p>
          <p className={cn('text-lg font-bold tabular-nums', s.color)}>{s.value}</p>
          <p className="text-[11px] text-surface-500 mt-0.5 truncate">{s.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MarketIntelligence() {
  const [country, setCountry] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey:  ['marketIntelligence', country],
    queryFn:   () => adminService.getMarketIntelligence(country || null),
    staleTime: 5 * 60_000, // 5 minutes
  });

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-surface-900">Market Intelligence</h2>
            <p className="text-xs text-surface-500 mt-0.5">
              Labor market demand analysis from <code className="text-[10px] bg-surface-100 rounded px-1">role_market_demand</code>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <input
                type="text"
                placeholder="Filter by country…"
                value={country}
                onChange={e => setCountry(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs border border-surface-200 rounded-lg bg-surface-50 focus:outline-none focus:ring-1 focus:ring-hr-400 text-surface-900 w-44"
              />
            </div>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-surface-200 rounded-lg text-surface-600 hover:bg-surface-50 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="rounded-xl border border-surface-100 bg-white p-12 flex items-center justify-center">
            <div className="text-center">
              <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-hr-500 border-t-transparent mb-3" />
              <p className="text-sm text-surface-500">Loading market data…</p>
            </div>
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-600 text-sm">
            Failed to load market intelligence. Make sure the{' '}
            <code className="text-xs bg-red-100 rounded px-1">role_market_demand</code> collection has data.
          </div>
        )}

        {/* No data */}
        {!isLoading && !isError && data && data.total_records === 0 && (
          <div className="rounded-xl border border-dashed border-surface-200 bg-surface-50 p-12 text-center">
            <svg className="h-12 w-12 mx-auto mb-3 text-surface-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-sm font-medium text-surface-500">No market data yet</p>
            <p className="text-xs text-surface-400 mt-1">
              Import a <code className="text-[11px] bg-surface-100 rounded px-1">role_market_demand</code> CSV via the Import Center to populate this panel.
            </p>
          </div>
        )}

        {/* Data panels */}
        {!isLoading && !isError && data && data.total_records > 0 && (
          <>
            <SummaryStats data={data} />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

              {/* Top Growing Roles */}
              <SectionCard
                title="Top Growing Roles"
                accentColor="bg-emerald-50"
                count={data.top_growing_roles.length}
                icon={
                  <svg className="h-4 w-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                }
              >
                {data.top_growing_roles.length === 0
                  ? <EmptyState message="No growth data available" />
                  : data.top_growing_roles.map((role, i) => (
                      <RoleRow
                        key={role.role_id}
                        rank={i + 1}
                        name={role.role_name}
                        family={role.role_family}
                        badge={role.demand_label}
                        metric={role.growth_rate ?? 0}
                        metricSuffix="% YoY"
                        metricLabel="growth"
                        barValue={role.growth_rate ?? 0}
                        barMax={50}
                        barColor="bg-emerald-400"
                      />
                    ))
                }
              </SectionCard>

              {/* Top Demand Roles */}
              <SectionCard
                title="Highest Demand Roles"
                accentColor="bg-blue-50"
                count={data.top_demand_roles.length}
                icon={
                  <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
              >
                {data.top_demand_roles.length === 0
                  ? <EmptyState message="No demand data available" />
                  : data.top_demand_roles.map((role, i) => (
                      <RoleRow
                        key={role.role_id}
                        rank={i + 1}
                        name={role.role_name}
                        family={role.role_family}
                        badge={role.demand_label}
                        metric={role.demand_score ?? 0}
                        metricLabel="demand score"
                        barValue={role.demand_score ?? 0}
                        barMax={100}
                        barColor="bg-blue-400"
                      />
                    ))
                }
              </SectionCard>

              {/* Top Salary Roles */}
              <SectionCard
                title="Highest Salary Roles"
                accentColor="bg-amber-50"
                count={data.top_salary_roles.length}
                icon={
                  <svg className="h-4 w-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              >
                {data.top_salary_roles.length === 0
                  ? <EmptyState message="No salary data available — import role_salary_market first" />
                  : data.top_salary_roles.map((role, i) => {
                      const maxSalary = Math.max(...data.top_salary_roles.map(r => r.median_salary ?? 0), 1);
                      return (
                        <RoleRow
                          key={role.role_id}
                          rank={i + 1}
                          name={role.role_name}
                          family={role.role_family}
                          badge={role.demand_label}
                          metric={role.median_salary?.toLocaleString() ?? '—'}
                          metricLabel="median salary"
                          barValue={role.median_salary ?? 0}
                          barMax={maxSalary}
                          barColor="bg-amber-400"
                        />
                      );
                    })
                }
              </SectionCard>
            </div>

            {/* Footer */}
            <div className="text-right text-[10px] text-surface-300">
              {data.country !== 'Global' && `Filtered: ${data.country} · `}
              {data.generated_at && `Updated ${new Date(data.generated_at).toLocaleTimeString()}`}
            </div>
          </>
        )}
      </div>
    </div>
  );
}