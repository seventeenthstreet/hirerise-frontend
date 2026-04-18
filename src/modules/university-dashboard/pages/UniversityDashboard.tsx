'use client';

/**
 * src/modules/university-dashboard/pages/UniversityDashboard.tsx
 *
 * Main dashboard for university administrators.
 *
 * Layout:
 *   Header (university name + nav)
 *   ├── Stat cards (total programs, total matched students, avg score)
 *   ├── Programs grid (ProgramCard × N)
 *   └── Quick actions (Add Program, View All Matches)
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/components/AuthProvider';
import ProgramCard from '../components/ProgramCard';
import { universityApi, type University, type UniversityAnalytics } from '../services/university.api';

interface Props { universityId: string; }

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <div style={{ ...S.statCard, borderColor: color + '30' }}>
      <div style={{ ...S.statIcon, background: color + '18' }}>{icon}</div>
      <div>
        <div style={S.statValue}>{value}</div>
        <div style={S.statLabel}>{label}</div>
      </div>
    </div>
  );
}

export default function UniversityDashboard({ universityId }: Props) {
  const router = useRouter();
  const { user } = useAuth();

  const [university, setUniversity]   = useState<University | null>(null);
  const [analytics,  setAnalytics]    = useState<UniversityAnalytics | null>(null);
  const [loading,    setLoading]      = useState(true);
  const [error,      setError]        = useState<string | null>(null);

  useEffect(() => {
    if (!universityId) return;
    async function load() {
      try {
        const [uniRes, analyticsRes] = await Promise.all([
          universityApi.getUniversity(universityId),
          universityApi.getAnalytics(universityId),
        ]);
        setUniversity(uniRes.university);
        setAnalytics(analyticsRes);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [universityId]);

  if (loading) {
    return (
      <div style={S.center}>
        <div style={S.spinner} />
        <div style={S.loadingText}>Loading university dashboard…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={S.center}>
        <div style={S.errorText}>{error}</div>
      </div>
    );
  }

  const topProgram = analytics?.programs?.[0] ?? null;

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.uniName}>{university?.university_name ?? 'University Dashboard'}</div>
          <div style={S.uniMeta}>
            {university?.country && <span>{university.country}</span>}
            {university?.website && (
              <a href={university.website} target="_blank" rel="noopener noreferrer" style={S.link}>
                {university.website}
              </a>
            )}
          </div>
        </div>
        <div style={S.navBtns}>
          <button style={S.navBtn} onClick={() => router.push(`/university/${universityId}/programs`)}>
            Manage Programs
          </button>
          <button style={S.navBtn} onClick={() => router.push(`/university/${universityId}/matches`)}>
            Student Matches
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={S.statsRow}>
        <StatCard label="Total Programs"          value={analytics?.total_programs ?? 0}          icon="🎓" color="#3b82f6" />
        <StatCard label="Matched Students"        value={analytics?.total_matched_students ?? 0}  icon="👥" color="#22c55e" />
        <StatCard label="Top Program"             value={topProgram?.program_name ?? '—'}          icon="⭐" color="#f59e0b" />
        <StatCard label="Avg Match Score"
          value={topProgram ? `${topProgram.avg_score}%` : '—'}
          icon="📊" color="#a855f7" />
      </div>

      {/* Programs grid */}
      <div style={S.sectionTitle}>Programs & Student Insights</div>
      {!analytics?.programs?.length ? (
        <div style={S.emptyState}>
          <div style={S.emptyIcon}>🎓</div>
          <div style={S.emptyText}>No programs yet.</div>
          <button
            style={S.primaryBtn}
            onClick={() => router.push(`/university/${universityId}/programs`)}
          >
            Add your first program
          </button>
        </div>
      ) : (
        <div style={S.programGrid}>
          {analytics.programs.map(program => (
            <ProgramCard
              key={program.program_id}
              program={program}
              onViewMatches={programId =>
                router.push(`/university/${universityId}/programs/${programId}/matches`)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0f172a', padding: '32px 24px', fontFamily: 'inherit' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 12 },
  spinner: { width: 36, height: 36, border: '3px solid #334155', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  loadingText: { color: '#64748b', fontSize: 14 },
  errorText: { color: '#f87171', fontSize: 15 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  uniName: { fontSize: 24, fontWeight: 700, color: '#f1f5f9' },
  uniMeta: { display: 'flex', gap: 16, marginTop: 4, fontSize: 13, color: '#64748b' },
  link: { color: '#60a5fa', textDecoration: 'none' },
  navBtns: { display: 'flex', gap: 10 },
  navBtn: { padding: '8px 16px', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#94a3b8', cursor: 'pointer', fontSize: 13 },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 },
  statCard: { display: 'flex', alignItems: 'center', gap: 14, background: '#1e293b', border: '1px solid', borderRadius: 12, padding: '16px 20px' },
  statIcon: { fontSize: 22, width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 20, fontWeight: 700, color: '#f1f5f9' },
  statLabel: { fontSize: 12, color: '#64748b', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: 600, color: '#94a3b8', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' },
  programGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 },
  emptyState: { textAlign: 'center', padding: '48px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: '#64748b', fontSize: 16 },
  primaryBtn: { padding: '10px 22px', background: '#3b82f6', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14 },
};
