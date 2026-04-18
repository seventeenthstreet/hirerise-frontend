'use client';

/**
 * src/modules/university-dashboard/pages/StudentMatchesPage.tsx
 *
 * Shows aggregated student match insights for each university program.
 * No PII is displayed — aggregated streams and skills only.
 */

import React, { useEffect, useState } from 'react';
import { universityApi, type Program, type StudentMatchInsights } from '../services/university.api';
import StudentMatchTable from '../components/StudentMatchTable';

interface Props { universityId: string; programId?: string; }

export default function StudentMatchesPage({ universityId, programId }: Props) {
  const [programs,  setPrograms]  = useState<Program[]>([]);
  const [selected,  setSelected]  = useState<string | null>(programId ?? null);
  const [insights,  setInsights]  = useState<StudentMatchInsights | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    universityApi.listPrograms(universityId)
      .then(res => {
        setPrograms(res.programs);
        if (!selected && res.programs.length) setSelected(res.programs[0].id);
      })
      .catch(err => setError(err.message));
  }, [universityId]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    setInsights(null);
    universityApi.getProgramMatches(universityId, selected)
      .then(data => setInsights(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [selected, universityId]);

  const selectedProgram = programs.find(p => p.id === selected);

  return (
    <div style={S.page}>
      <div style={S.title}>Student Match Insights</div>

      {error && <div style={S.error}>{error}</div>}

      {/* Program selector */}
      <div style={S.tabs}>
        {programs.map(p => (
          <button
            key={p.id}
            style={{ ...S.tab, ...(selected === p.id ? S.tabActive : {}) }}
            onClick={() => setSelected(p.id)}
          >
            {p.program_name}
          </button>
        ))}
      </div>

      {/* Insights panel */}
      {loading ? (
        <div style={S.empty}>Loading insights…</div>
      ) : insights ? (
        <>
          <div style={S.programLabel}>
            {selectedProgram?.program_name} — {selectedProgram?.degree_type}
          </div>
          <StudentMatchTable insights={insights} />
        </>
      ) : (
        <div style={S.empty}>Select a program to view matched student insights.</div>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page:         { padding: '28px 24px', background: '#0f172a', minHeight: '100vh' },
  title:        { fontSize: 20, fontWeight: 700, color: '#f1f5f9', marginBottom: 20 },
  error:        { background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '10px 14px', color: '#fca5a5', marginBottom: 16, fontSize: 14 },
  tabs:         { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 },
  tab:          { padding: '8px 16px', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#94a3b8', cursor: 'pointer', fontSize: 13 },
  tabActive:    { background: '#1d4ed820', border: '1px solid #3b82f6', color: '#60a5fa' },
  programLabel: { fontSize: 15, fontWeight: 600, color: '#f1f5f9', marginBottom: 16 },
  empty:        { color: '#475569', padding: '32px 0', textAlign: 'center' },
};
