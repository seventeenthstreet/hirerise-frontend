'use client';

// app/(admin)/admin/dashboard/page.tsx
// Role-aware dashboard:
//   MASTER_ADMIN / admin → full metrics + approval queue summary + quick actions
//   contributor          → submission status + personal stats only

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/components/AuthProvider';
import { AdminTopbar } from '@/components/layout/AdminTopbar';
import { useAdminMetrics } from '@/hooks/admin/useAdminMetrics';
import { usePendingEntries } from '@/hooks/admin/usePending';
import { adminService } from '@/services/adminService';
import { cn } from '@/utils/cn';
import { GraphMonitoringSection } from '@/features/admin/dashboard/GraphMonitoringPanels';

// ─── Shared sub-components ────────────────────────────────────────────────────

function MetricCard({ label, value, sub, icon, accent, href }: {
  label: string; value: number | undefined; sub: string;
  icon: React.ReactNode; accent: string; href: string;
}) {
  return (
    <Link href={href} className="group block rounded-xl border border-surface-100 bg-white p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-surface-400">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-surface-900">
            {value == null
              ? <span className="inline-block h-8 w-14 animate-pulse rounded-md bg-surface-100" />
              : value.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-surface-400">{sub}</p>
        </div>
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', accent)}>{icon}</div>
      </div>
    </Link>
  );
}

function QuickLink({ label, desc, href, badge }: { label: string; desc: string; href: string; badge?: number }) {
  return (
    <Link href={href} className="group flex items-start gap-3 rounded-xl border border-surface-100 bg-white p-4 shadow-card transition-all hover:shadow-card-md">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-hr-50 text-hr-600 transition-colors group-hover:bg-hr-100">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-surface-900">{label}</p>
          {badge != null && badge > 0 && (
            <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{badge}</span>
          )}
        </div>
        <p className="text-xs text-surface-400">{desc}</p>
      </div>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending:  'bg-amber-50 text-amber-700 border-amber-100',
    approved: 'bg-green-50 text-green-700 border-green-100',
    rejected: 'bg-red-50 text-red-600 border-red-100',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', styles[status] ?? 'bg-surface-50 text-surface-500')}>
      {status}
    </span>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
}

const ENTITY_LABELS: Record<string, string> = {
  skill: 'Skill', role: 'Role', jobFamily: 'Job Family',
  educationLevel: 'Education Level', salaryBenchmark: 'Salary Benchmark',
};

// ─── Master/Admin dashboard ───────────────────────────────────────────────────

function AdminDashboardView() {
  const { user, isMasterAdmin } = useAuth();
  const { data: m, isError } = useAdminMetrics();
  const { data: pending } = usePendingEntries({ status: 'pending' });
  const { data: gm } = useQuery({
    queryKey: ['graphMetrics'],
    queryFn:  () => adminService.getGraphMetrics(),
    staleTime: 60_000,
  });

  const pendingCount = pending?.total ?? 0;

  const BOL = 'bg-hr-50 text-hr-600';
  const BVL = 'bg-violet-50 text-violet-600';
  const BEL = 'bg-emerald-50 text-emerald-600';
  const BAL = 'bg-amber-50 text-amber-600';
  const BRL = 'bg-rose-50 text-rose-600';
  const BSL = 'bg-sky-50 text-sky-600';
  const BGL = 'bg-green-50 text-green-600';

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 animate-slide-up">
      <div>
        <h2 className="text-xl font-bold text-surface-900">
          Good {getGreeting()}, {user?.displayName?.split(' ')[0] || 'Admin'} 👋
        </h2>
        <p className="mt-1 text-sm text-surface-500">
          {isMasterAdmin ? 'Master Admin · Full platform control.' : 'Admin · Platform overview.'}
        </p>
      </div>

      {isError && (
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          ⚠ Could not reach metrics endpoint — counts may be stale.
        </div>
      )}

      {/* Approval queue alert */}
      {pendingCount > 0 && (
        <Link href="/admin/approvals" className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 transition-colors hover:bg-amber-100">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-white">
            {pendingCount}
          </span>
          <div>
            <p className="text-sm font-semibold text-amber-900">
              {pendingCount} submission{pendingCount > 1 ? 's' : ''} awaiting approval
            </p>
            <p className="text-xs text-amber-700">Click to review contributor entries</p>
          </div>
          <svg className="ml-auto h-4 w-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </Link>
      )}

      {/* Content metrics */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-surface-400">Content</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Total Skills"    value={m?.totalSkills}        sub="in catalog"    href="/admin/cms/skills"            accent={BOL} icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>} />
          <MetricCard label="Total Roles"     value={m?.totalRoles}         sub="configured"    href="/admin/cms/roles"             accent={BVL} icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
          <MetricCard label="Job Families"    value={m?.totalJobFamilies}   sub="sectors"       href="/admin/cms/job-families"       accent={BEL} icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>} />
          <MetricCard label="Salary Records"  value={m?.totalSalaryRecords} sub="benchmarks"    href="/admin/cms/salary-benchmarks"  accent={BAL} icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Education Levels" value={m?.totalEducationLevels} sub="qual. tiers"   href="/admin/cms/education-levels" accent={BRL} icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 14l9-5-9-5-9 5 9 5zm0 7v-7.5l4-2.222" /></svg>} />
        <MetricCard label="Total Users"      value={m?.totalUsers}           sub="registered"   href="/admin/dashboard"           accent={BSL} icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>} />
        <MetricCard label="Active (30d)"     value={m?.activeUsers30d}       sub="unique users" href="/admin/dashboard"           accent={BGL} icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>} />
      </div>

      {/* Graph intelligence metrics */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-surface-400">Graph Intelligence</p>
          <a href="/admin/graph" className="text-xs font-medium text-hr-600 hover:text-hr-700">Manage →</a>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {[
            { label: 'Roles',        value: gm?.total_roles,               accent: 'bg-blue-50 text-blue-600',    href: '/admin/graph' },
            { label: 'Skills',       value: gm?.total_skills,              accent: 'bg-emerald-50 text-emerald-600', href: '/admin/graph' },
            { label: 'Transitions',  value: gm?.total_role_transitions,    accent: 'bg-blue-50 text-blue-600',    href: '/admin/graph' },
            { label: 'Skill Links',  value: gm?.total_skill_relationships, accent: 'bg-emerald-50 text-emerald-600', href: '/admin/graph' },
            { label: 'Role Skills',  value: gm?.total_role_skills,         accent: 'bg-violet-50 text-violet-600', href: '/admin/graph' },
          ].map(card => (
            <a key={card.label} href={card.href} className="group block rounded-xl border border-surface-100 bg-white p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-md">
              <p className="text-xs font-semibold uppercase tracking-widest text-surface-400">{card.label}</p>
              <p className="mt-1.5 text-2xl font-bold tabular-nums text-surface-900">
                {card.value == null
                  ? <span className="inline-block h-7 w-12 animate-pulse rounded-md bg-surface-100" />
                  : card.value.toLocaleString()}
              </p>
              <div className={cn('mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', card.accent)}>
                Graph
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Career Intelligence Monitoring */}
      <GraphMonitoringSection />

      {/* Quick actions */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-surface-400">Quick actions</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink label="Approval Queue"   desc="Review contributor submissions" href="/admin/approvals"    badge={pendingCount} />
          <QuickLink label="Contributors"     desc="Manage contributor access"      href="/admin/contributors" />
          <QuickLink label="Graph Console"    desc="Manage Career & Skill Graph"    href="/admin/graph"        />
          <QuickLink label="Graph Validator"  desc="Check graph data integrity"     href="/admin/graph"        />
        </div>
      </div>

      {/* Platform info */}
      <div className="rounded-xl border border-surface-100 bg-white p-5 shadow-card">
        <h3 className="mb-3 text-sm font-semibold text-surface-700">Platform info</h3>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
          {[['API','v1'],['Auth','Supabase JWT'],['Database','Supabase'],['Version','v1.4.0']].map(([t,v]) => (
            <div key={t}><dt className="text-xs text-surface-400">{t}</dt><dd className="font-semibold text-surface-800">{v}</dd></div>
          ))}
        </dl>
        {m?.lastImportAt && <p className="mt-3 border-t border-surface-50 pt-3 text-xs text-surface-400">Last import: {new Date(m.lastImportAt).toLocaleString()}</p>}
      </div>
    </div>
  );
}

// ─── Contributor dashboard ────────────────────────────────────────────────────

function ContributorDashboardView() {
  const { user } = useAuth();
  const { data: allEntries } = usePendingEntries();

  const entries = allEntries?.items ?? [];
  const pendingCount  = entries.filter(e => e.status === 'pending').length;
  const approvedCount = entries.filter(e => e.status === 'approved').length;
  const rejectedCount = entries.filter(e => e.status === 'rejected').length;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 animate-slide-up">
      <div>
        <h2 className="text-xl font-bold text-surface-900">
          Good {getGreeting()}, {user?.displayName?.split(' ')[0] || 'Contributor'} 👋
        </h2>
        <p className="mt-1 text-sm text-surface-500">Contributor portal · Submit entries for admin review.</p>
      </div>

      {/* Info banner */}
      <div className="rounded-xl border border-sky-100 bg-sky-50 p-4">
        <p className="text-sm font-semibold text-sky-900">How it works</p>
        <p className="mt-1 text-sm text-sky-700">
          Submit entries using the <strong>Submit Entry</strong> form. A master admin will review and approve or reject your submission. Approved entries go live on the platform immediately.
        </p>
      </div>

      {/* Personal stats */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-surface-400">Your submissions</p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Pending',  value: pendingCount,  color: 'bg-amber-50 text-amber-700',  border: 'border-amber-100' },
            { label: 'Approved', value: approvedCount, color: 'bg-green-50 text-green-700',  border: 'border-green-100' },
            { label: 'Rejected', value: rejectedCount, color: 'bg-red-50 text-red-600',      border: 'border-red-100'   },
          ].map(s => (
            <div key={s.label} className={cn('rounded-xl border p-5 text-center', s.border)}>
              <p className={cn('text-3xl font-bold', s.color.split(' ')[1])}>{s.value}</p>
              <p className="mt-1 text-xs font-semibold text-surface-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent submissions */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-surface-400">Recent submissions</p>
          <Link href="/admin/my-entries" className="text-xs font-medium text-hr-600 hover:text-hr-700">View all →</Link>
        </div>
        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-200 bg-surface-50 py-10 text-center">
            <p className="text-sm text-surface-500">No submissions yet.</p>
            <Link href="/admin/submit" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-hr-600 px-4 py-2 text-sm font-semibold text-white hover:bg-hr-700">
              + Submit your first entry
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.slice(0, 5).map(entry => (
              <div key={entry.id} className="flex items-center justify-between rounded-xl border border-surface-100 bg-white px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-surface-900">{String(entry.payload.name ?? '—')}</p>
                  <p className="text-xs text-surface-400">{ENTITY_LABELS[entry.entityType] ?? entry.entityType} · {new Date(entry.submittedAt).toLocaleDateString()}</p>
                  {entry.rejectionReason && (
                    <p className="mt-1 text-xs text-red-600">Reason: {entry.rejectionReason}</p>
                  )}
                </div>
                <StatusBadge status={entry.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CTA */}
      <Link href="/admin/submit" className="flex items-center justify-center gap-2 rounded-xl border border-hr-200 bg-hr-50 py-4 text-sm font-semibold text-hr-700 transition-colors hover:bg-hr-100">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        Submit a new entry
      </Link>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const { isAdmin, isContributor } = useAuth();

  return (
    <div className="flex h-full flex-col">
      <AdminTopbar title="Dashboard" />
      {isAdmin ? <AdminDashboardView /> : <ContributorDashboardView />}
    </div>
  );
}