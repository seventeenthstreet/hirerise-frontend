'use client';

/**
 * src/modules/school-dashboard/pages/SchoolDashboard.tsx
 *
 * Main dashboard for school administrators and counselors.
 *
 * Layout:
 *   Header (school name + role badge + nav)
 *   ├── Stat cards row (total students, assessed, rate, top stream)
 *   ├── Two-column charts (StreamDistribution | CareerTrends)
 *   └── Quick-action bar (Import CSV, View Students, Add Counselor)
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth }   from '@/features/auth/components/AuthProvider';
import StreamDistributionChart from '../components/StreamDistributionChart';
import CareerTrendChart        from '../components/CareerTrendChart';
import { schoolApi, type School, type SchoolAnalytics } from '../services/school.api';

interface SchoolDashboardProps {
  schoolId: string;
}

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  sub?:  string;
  color: string;
  icon:  string;
}

function StatCard({ label, value, sub, color, icon }: StatCardProps) {
  return (
    <div style={{ ...S.statCard, borderColor: color + '30' }}>
      <div style={{ ...S.statIcon, background: color + '18' }}>{icon}</div>
      <div style={S.statBody}>
        <div style={S.statValue}>{value}</div>
        <div style={S.statLabel}>{label}</div>
        {sub && <div style={S.statSub}>{sub}</div>}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SchoolDashboard({ schoolId }: SchoolDashboardProps) {
  const router     = useRouter();
  const { user }   = useAuth();

  const [school,    setSchool]    = useState<School | null>(null);
  const [analytics, setAnalytics] = useState<SchoolAnalytics | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    async function load() {
      try {
        const [schoolRes, analyticsRes] = await Promise.all([
          schoolApi.getSchool(schoolId),
          schoolApi.getAnalytics(schoolId),
        ]);
        setSchool(schoolRes.school);
        setAnalytics(analyticsRes);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [schoolId]);

  const topStream = analytics?.stream_distribution?.sort((a, b) => b.percent - a.percent)[0] || null;

  return (
    <>
      <style>{GLOBAL_CSS}</style>

      <div style={S.root}>
        {/* ── Header ──────────────────────────────────────────────────── */}
        <header style={S.header}>
          <div style={S.headerInner}>
            <div style={S.headerLeft}>
              <span style={S.brand}>🎓 Career Intelligence</span>
              <span style={S.sep}>·</span>
              <span style={S.schoolName}>
                {loading ? 'Loading…' : school?.school_name || 'School Dashboard'}
              </span>
            </div>
            <nav style={S.nav}>
              <button style={{ ...S.navBtn, ...S.navActive }}>Overview</button>
              <button style={S.navBtn} onClick={() => router.push(`/school/students?schoolId=${schoolId}`)}>Students</button>
              <button style={S.navBtn} onClick={() => router.push(`/school/settings?schoolId=${schoolId}`)}>Settings</button>
            </nav>
          </div>
        </header>

        {/* ── Page content ────────────────────────────────────────────── */}
        <main style={S.main}>

          {error && (
            <div style={S.errorBanner}>{error}</div>
          )}

          {/* Stat cards */}
          <div style={S.statsRow}>
            <StatCard
              icon="👥" label="Total Students"
              value={loading ? '—' : analytics?.total_students ?? 0}
              color="#4f46e5"
            />
            <StatCard
              icon="✅" label="Assessed"
              value={loading ? '—' : analytics?.students_assessed ?? 0}
              sub={analytics ? `${analytics.assessment_rate}% completion` : undefined}
              color="#059669"
            />
            <StatCard
              icon="⏳" label="Pending Assessment"
              value={loading ? '—' : (analytics ? analytics.total_students - analytics.students_assessed : 0)}
              color="#d97706"
            />
            <StatCard
              icon="🏆" label="Top Stream"
              value={loading ? '—' : topStream ? topStream.label : 'N/A'}
              sub={topStream ? `${topStream.percent}% of assessed` : undefined}
              color="#7c3aed"
            />
          </div>

          {/* Charts */}
          <div style={S.chartsRow}>
            <div style={S.chartCol}>
              <StreamDistributionChart
                distribution={analytics?.stream_distribution || []}
                isLoading={loading}
              />
            </div>
            <div style={S.chartCol}>
              <CareerTrendChart
                careers={analytics?.top_careers || []}
                isLoading={loading}
                totalAssessed={analytics?.students_assessed || 0}
              />
            </div>
          </div>

          {/* Quick actions */}
          <div style={S.quickActions}>
            <div style={S.qaTitle}>Quick Actions</div>
            <div style={S.qaRow}>
              <button style={{ ...S.qaBtn, ...S.qaBtnPrimary }} onClick={() => router.push(`/school/students?schoolId=${schoolId}`)}>
                <span>👥</span> Manage Students
              </button>
              <button style={S.qaBtn} onClick={() => router.push(`/school/import?schoolId=${schoolId}`)}>
                <span>📥</span> Import CSV
              </button>
              <button style={S.qaBtn} onClick={() => router.push(`/school/counselors?schoolId=${schoolId}`)}>
                <span>👤</span> Manage Counselors
              </button>
            </div>
          </div>

        </main>
      </div>
    </>
  );
}

// ─── Global CSS ────────────────────────────────────────────────────────────────

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @keyframes shimmer {
    0%   { opacity: 0.5; }
    50%  { opacity: 1;   }
    100% { opacity: 0.5; }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0);   }
  }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.10); border-radius: 10px; }
  button:hover { opacity: 0.85; }
`;

// ─── Styles ────────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  root:      { minHeight: '100vh', background: '#080c14', fontFamily: "'DM Sans', sans-serif", color: '#f9fafb' },

  header:    { background: '#0d1117', borderBottom: '1px solid #1f2937', position: 'sticky', top: 0, zIndex: 50 },
  headerInner:{ maxWidth: 1200, margin: '0 auto', padding: '13px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft:{ display: 'flex', alignItems: 'center', gap: 10 },
  brand:     { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: '#f9fafb' },
  sep:       { color: '#374151' },
  schoolName:{ fontSize: 13.5, fontWeight: 600, color: '#94a3b8' },

  nav:       { display: 'flex', gap: 4 },
  navBtn:    { background: 'transparent', border: 'none', borderRadius: 8, color: '#6b7280', fontSize: 13, fontWeight: 600, padding: '6px 14px', cursor: 'pointer' },
  navActive: { background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' },

  main:      { maxWidth: 1200, margin: '0 auto', padding: '32px 24px 60px', display: 'flex', flexDirection: 'column', gap: 28 },

  errorBanner:{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '12px 16px', fontSize: 13.5, color: '#fca5a5' },

  statsRow:  { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 },
  statCard:  { background: 'rgba(255,255,255,0.03)', border: '1px solid', borderRadius: 14, padding: '20px 18px', display: 'flex', alignItems: 'flex-start', gap: 14, animation: 'fadeIn 0.4s ease' },
  statIcon:  { width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 },
  statBody:  { flex: 1 },
  statValue: { fontSize: 26, fontWeight: 800, color: '#f9fafb', lineHeight: 1.1 },
  statLabel: { fontSize: 12, fontWeight: 600, color: '#64748b', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' },
  statSub:   { fontSize: 11.5, color: '#475569', marginTop: 3 },

  chartsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  chartCol:  { minWidth: 0 },

  quickActions:{ display: 'flex', flexDirection: 'column', gap: 12 },
  qaTitle:   { fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' },
  qaRow:     { display: 'flex', gap: 12, flexWrap: 'wrap' },
  qaBtn:     { display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, color: '#94a3b8', fontSize: 13.5, fontWeight: 600, padding: '11px 18px', cursor: 'pointer', transition: 'all 0.15s' },
  qaBtnPrimary:{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', border: '1px solid transparent', color: '#fff' },
};
