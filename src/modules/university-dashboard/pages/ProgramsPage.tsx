'use client';

/**
 * src/modules/university-dashboard/pages/ProgramsPage.tsx
 *
 * University program management — list, add, edit, delete programs.
 */

import React, { useEffect, useState } from 'react';
import { universityApi, type Program } from '../services/university.api';

interface Props { universityId: string; }

const BLANK_FORM = {
  program_name:    '',
  degree_type:     '',
  duration_years:  4,
  tuition_cost:    0,
  streams:         '',
  career_outcomes: '',
};

export default function ProgramsPage({ universityId }: Props) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState(BLANK_FORM);

  async function load() {
    setLoading(true);
    try {
      const res = await universityApi.listPrograms(universityId);
      setPrograms(res.programs);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load programs.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [universityId]);

  async function handleSubmit() {
    if (!form.program_name.trim()) return;
    setSaving(true);
    try {
      await universityApi.createProgram(universityId, {
        program_name:    form.program_name,
        degree_type:     form.degree_type,
        duration_years:  Number(form.duration_years),
        tuition_cost:    Number(form.tuition_cost),
        streams:         form.streams.split(',').map(s => s.trim()).filter(Boolean),
        career_outcomes: form.career_outcomes.split(',').map(s => s.trim()).filter(Boolean),
      });
      setForm(BLANK_FORM);
      setShowForm(false);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create program.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(programId: string) {
    if (!confirm('Delete this program?')) return;
    await universityApi.deleteProgram(universityId, programId);
    setPrograms(p => p.filter(x => x.id !== programId));
  }

  return (
    <div style={S.page}>
      <div style={S.topBar}>
        <div style={S.title}>Programs</div>
        <button style={S.addBtn} onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ Add Program'}
        </button>
      </div>

      {error && <div style={S.error}>{error}</div>}

      {/* Add form */}
      {showForm && (
        <div style={S.form}>
          <div style={S.formTitle}>New Program</div>
          <div style={S.row}>
            <input
              style={S.input} placeholder="Program name *"
              value={form.program_name}
              onChange={e => setForm(f => ({ ...f, program_name: e.target.value }))}
            />
            <input
              style={S.input} placeholder="Degree type (e.g. BTech)"
              value={form.degree_type}
              onChange={e => setForm(f => ({ ...f, degree_type: e.target.value }))}
            />
          </div>
          <div style={S.row}>
            <input
              style={S.input} placeholder="Duration (years)" type="number"
              value={form.duration_years}
              onChange={e => setForm(f => ({ ...f, duration_years: Number(e.target.value) }))}
            />
            <input
              style={S.input} placeholder="Tuition cost (annual)" type="number"
              value={form.tuition_cost}
              onChange={e => setForm(f => ({ ...f, tuition_cost: Number(e.target.value) }))}
            />
          </div>
          <input
            style={S.input} placeholder="Streams (comma-separated: Science, Mathematics)"
            value={form.streams}
            onChange={e => setForm(f => ({ ...f, streams: e.target.value }))}
          />
          <input
            style={S.input} placeholder="Career outcomes (comma-separated: Software Engineer, Data Analyst)"
            value={form.career_outcomes}
            onChange={e => setForm(f => ({ ...f, career_outcomes: e.target.value }))}
          />
          <button style={S.submitBtn} onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : 'Save Program'}
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={S.empty}>Loading…</div>
      ) : programs.length === 0 ? (
        <div style={S.empty}>No programs yet. Add one above.</div>
      ) : (
        <table style={S.table}>
          <thead>
            <tr>
              {['Program', 'Degree', 'Duration', 'Tuition', 'Streams', ''].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {programs.map(p => (
              <tr key={p.id} style={S.tr}>
                <td style={S.td}>{p.program_name}</td>
                <td style={S.td}>{p.degree_type || '—'}</td>
                <td style={S.td}>{p.duration_years}y</td>
                <td style={S.td}>{p.tuition_cost ? `$${p.tuition_cost.toLocaleString()}` : '—'}</td>
                <td style={S.td}>{p.streams?.join(', ') || '—'}</td>
                <td style={S.td}>
                  <button style={S.deleteBtn} onClick={() => handleDelete(p.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page:      { padding: '28px 24px', background: '#0f172a', minHeight: '100vh' },
  topBar:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title:     { fontSize: 20, fontWeight: 700, color: '#f1f5f9' },
  addBtn:    { padding: '8px 16px', background: '#3b82f6', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, cursor: 'pointer' },
  error:     { background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '10px 14px', color: '#fca5a5', marginBottom: 16, fontSize: 14 },
  form:      { background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 20, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 },
  formTitle: { fontSize: 15, fontWeight: 600, color: '#94a3b8' },
  row:       { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  input:     { padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', fontSize: 14, outline: 'none' },
  submitBtn: { padding: '10px 20px', background: '#3b82f6', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14, alignSelf: 'flex-start' },
  table:     { width: '100%', borderCollapse: 'collapse' },
  th:        { padding: '10px 12px', fontSize: 12, color: '#64748b', textAlign: 'left', borderBottom: '1px solid #1e293b', textTransform: 'uppercase', letterSpacing: '0.05em' },
  tr:        { borderBottom: '1px solid #1e293b' },
  td:        { padding: '12px 12px', fontSize: 14, color: '#e2e8f0' },
  deleteBtn: { background: 'none', border: '1px solid #7f1d1d', borderRadius: 6, color: '#f87171', cursor: 'pointer', padding: '4px 10px', fontSize: 12 },
  empty:     { color: '#475569', padding: '32px 0', textAlign: 'center' },
};
