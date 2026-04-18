'use client';

/**
 * src/modules/employer-dashboard/pages/EmployerDashboard.tsx
 *
 * Main dashboard for employer HR teams.
 *
 * Layout:
 *   Header (company name + industry + nav)
 *   ├── Stat cards (total roles, total pipeline, top skill)
 *   ├── SkillTrendChart (demand across all roles)
 *   └── Quick TalentTable preview (top 5 roles)
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/components/AuthProvider';
import SkillTrendChart from '../components/SkillTrendChart';
import TalentTable from '../components/TalentTable';
import { employerApi, type Employer, type TalentPipeline } from '../services/employer.api';

interface Props { employerId: string; }

function StatCard({ label, value, icon, color, sub }: {
  label: string; value: string | number; icon: string; color: string; sub?: string;
}) {
  return (
    <div style={{ ...S.statCard, borderColor: color + '30' }}>
      <div style={{ ...S.statIcon, background: color + '18' }}>{icon}</div>
      <div>
        <div style={S.statValue}>{value}</div>
        <div style={S.statLabel}>{label}</div>
        {sub && <div style={S.statSub}>{sub}</div>}
      </div>
    </div>
  );
}

export default function EmployerDashboard({ employerId }: Props) {
  const router   = useRouter();
  const { user } = useAuth();

  const [employer,  setEmployer]  = useState<Employer | null>(null);
  const [pipeline,  setPipeline]  = useState<TalentPipeline | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!employerId) return;
    async function load() {
      try {
        const [empRes, pipelineRes] = await Promise.all([
          employerApi.getEmployer(employerId),
          employerApi.getTalentPipeline(employerId),
        ]);
        setEmployer(empRes.employer);
        setPipeline(pipelineRes);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [employerId]);

  if (loading) {
    return (
      <div style={S.center}>
        <div style={S.spinner} />
        <div style={S.loadingText}>Loading employer dashboard…</div>
      </div>
    );
  }

  if (error) {
    return <div style={S.center}><div style={S.errorText}>{error}</div></div>;
  }

  const topSkill = pipeline?.skill_trends?.[0]?.skill ?? '—';
  const topRole  = pipeline?.roles?.[0];

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.companyName}>{employer?.company_name ?? 'Employer Dashboard'}</div>
          <div style={S.meta}>
            {employer?.industry && <span style={S.industryBadge}>{employer.industry}</span>}
            {employer?.website  && (
              <a href={employer.website} target="_blank" rel="noopener noreferrer" style={S.link}>
                {employer.website}
              </a>
            )}
          </div>
        </div>
        <div style={S.navBtns}>
          <button style={S.navBtn} onClick={() => router.push(`/employer/${employerId}/pipeline`)}>
            Talent Pipeline
          </button>
          <button style={S.navBtnPrimary} onClick={() => router.push(`/employer/${employerId}/roles`)}>
            + Add Role
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={S.statsRow}>
        <StatCard label="Active Roles"     value={pipeline?.total_roles  ?? 0}   icon="💼" color="#3b82f6" />
        <StatCard label="Talent Pipeline"  value={pipeline?.total_talent ?? 0}   icon="👥" color="#22c55e"
          sub="matched students" />
        <StatCard label="Top Skill Demand" value={topSkill}                       icon="⚡" color="#f59e0b" />
        <StatCard label="Top Role Pipeline"
          value={topRole ? topRole.pipeline_count : '—'}
          icon="🎯" color="#a855f7"
          sub={topRole?.role_name} />
      </div>

      {/* Two-column layout: chart + table preview */}
      <div style={S.twoCol}>
        {/* Skill trends */}
        <div>
          <div style={S.sectionTitle}>Skill Demand Across Roles</div>
          <SkillTrendChart trends={pipeline?.skill_trends ?? []} />
        </div>

        {/* Top roles pipeline preview */}
        <div>
          <div style={S.sectionTitle}>Pipeline by Role</div>
          <div style={S.tableWrap}>
            <TalentTable
              roles={pipeline?.roles?.slice(0, 5) ?? []}
              onViewRole={roleId => router.push(`/employer/${employerId}/pipeline?role=${roleId}`)}
            />
          </div>
          {(pipeline?.roles?.length ?? 0) > 5 && (
            <button
              style={S.viewAll}
              onClick={() => router.push(`/employer/${employerId}/pipeline`)}
            >
              View all {pipeline!.roles.length} roles →
            </button>
          )}
        </div>
      </div>

      {/* Privacy notice */}
      <div style={S.privacyBar}>
        🔒 All talent data is aggregated and anonymised. Student identities are never shared.
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page:          { minHeight: '100vh', background: '#0f172a', padding: '32px 24px', fontFamily: 'inherit' },
  center:        { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 12 },
  spinner:       { width: 36, height: 36, border: '3px solid #334155', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  loadingText:   { color: '#64748b', fontSize: 14 },
  errorText:     { color: '#f87171', fontSize: 15 },
  header:        { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  companyName:   { fontSize: 24, fontWeight: 700, color: '#f1f5f9' },
  meta:          { display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 },
  industryBadge: { padding: '3px 10px', background: '#713f1220', border: '1px solid #92400e', borderRadius: 20, fontSize: 12, color: '#fbbf24', fontWeight: 500 },
  link:          { color: '#60a5fa', textDecoration: 'none', fontSize: 13 },
  navBtns:       { display: 'flex', gap: 10, alignItems: 'center' },
  navBtn:        { padding: '8px 16px', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#94a3b8', cursor: 'pointer', fontSize: 13 },
  navBtnPrimary: { padding: '8px 16px', background: '#3b82f6', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 },
  statsRow:      { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 },
  statCard:      { display: 'flex', alignItems: 'center', gap: 14, background: '#1e293b', border: '1px solid', borderRadius: 12, padding: '16px 20px' },
  statIcon:      { fontSize: 22, width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statValue:     { fontSize: 20, fontWeight: 700, color: '#f1f5f9' },
  statLabel:     { fontSize: 12, color: '#64748b', marginTop: 2 },
  statSub:       { fontSize: 11, color: '#475569', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 },
  twoCol:        { display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 24, marginBottom: 24 },
  sectionTitle:  { fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' },
  tableWrap:     { background: '#1e293b', border: '1px solid #334155', borderRadius: 12, overflow: 'hidden' },
  viewAll:       { marginTop: 12, background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 13, padding: 0 },
  privacyBar:    { background: '#0c1a2e', border: '1px solid #1e3a5f', borderRadius: 8, padding: '10px 16px', color: '#475569', fontSize: 12, marginTop: 8 },
};
