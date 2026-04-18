'use client';

/**
 * src/modules/employer-dashboard/pages/TalentPipelinePage.tsx
 *
 * Full talent pipeline view — all roles with skill gap analysis,
 * stream distribution, and salary ranges.
 *
 * Includes role management (add / deactivate roles).
 */

import React, { useEffect, useState } from 'react';
import TalentTable from '../components/TalentTable';
import SkillTrendChart from '../components/SkillTrendChart';
import { employerApi, type TalentPipeline, type RoleMatchInsights } from '../services/employer.api';

interface Props { employerId: string; }

const BLANK_ROLE = {
  role_name:       '',
  required_skills: '',
  salary_min:      '',
  salary_max:      '',
  streams:         '',
  exp_min:         0,
  exp_max:         5,
};

export default function TalentPipelinePage({ employerId }: Props) {
  const [pipeline,    setPipeline]    = useState<TalentPipeline | null>(null);
  const [selected,    setSelected]    = useState<RoleMatchInsights | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [form,        setForm]        = useState(BLANK_ROLE);
  const [error,       setError]       = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await employerApi.getTalentPipeline(employerId);
      setPipeline(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load pipeline.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [employerId]);

  async function handleAddRole() {
    if (!form.role_name.trim()) return;
    setSaving(true);
    try {
      await employerApi.createJobRole(employerId, {
        role_name:       form.role_name,
        required_skills: form.required_skills.split(',').map(s => s.trim()).filter(Boolean),
        salary_min:      form.salary_min ? Number(form.salary_min) : undefined,
        salary_max:      form.salary_max ? Number(form.salary_max) : undefined,
        streams:         form.streams.split(',').map(s => s.trim()).filter(Boolean),
        exp_min:         Number(form.exp_min),
        exp_max:         Number(form.exp_max),
      });
      setForm(BLANK_ROLE);
      setShowForm(false);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create role.');
    } finally {
      setSaving(false);
    }
  }

  async function handleViewRole(roleId: string) {
    try {
      const data = await employerApi.getRoleMatches(employerId, roleId);
      setSelected(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load role matches.');
    }
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.topBar}>
        <div style={S.title}>Talent Pipeline</div>
        <button style={S.addBtn} onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ Add Job Role'}
        </button>
      </div>

      {error && <div style={S.error}>{error}</div>}

      {/* Add Role Form */}
      {showForm && (
        <div style={S.form}>
          <div style={S.formTitle}>New Job Role</div>
          <div style={S.row}>
            <input style={S.input} placeholder="Role name *"
              value={form.role_name}
              onChange={e => setForm(f => ({ ...f, role_name: e.target.value }))} />
            <input style={S.input} placeholder="Required skills (comma-separated)"
              value={form.required_skills}
              onChange={e => setForm(f => ({ ...f, required_skills: e.target.value }))} />
          </div>
          <div style={S.row}>
            <input style={S.input} placeholder="Salary min" type="number"
              value={form.salary_min}
              onChange={e => setForm(f => ({ ...f, salary_min: e.target.value }))} />
            <input style={S.input} placeholder="Salary max" type="number"
              value={form.salary_max}
              onChange={e => setForm(f => ({ ...f, salary_max: e.target.value }))} />
          </div>
          <div style={S.row}>
            <input style={S.input} placeholder="Target streams (comma-separated)"
              value={form.streams}
              onChange={e => setForm(f => ({ ...f, streams: e.target.value }))} />
            <div style={S.inlineGroup}>
              <input style={{ ...S.input, flex: 1 }} placeholder="Exp min (yrs)" type="number"
                value={form.exp_min}
                onChange={e => setForm(f => ({ ...f, exp_min: Number(e.target.value) }))} />
              <input style={{ ...S.input, flex: 1 }} placeholder="Exp max (yrs)" type="number"
                value={form.exp_max}
                onChange={e => setForm(f => ({ ...f, exp_max: Number(e.target.value) }))} />
            </div>
          </div>
          <button style={S.submitBtn} onClick={handleAddRole} disabled={saving}>
            {saving ? 'Saving…' : 'Save Role'}
          </button>
        </div>
      )}

      {loading ? (
        <div style={S.empty}>Loading pipeline data…</div>
      ) : (
        <div style={S.twoSection}>
          {/* Full role table */}
          <div>
            <div style={S.sectionTitle}>All Roles — Pipeline Overview</div>
            <div style={S.tableWrap}>
              <TalentTable
                roles={pipeline?.roles ?? []}
                onViewRole={handleViewRole}
              />
            </div>
          </div>

          {/* Skill trends */}
          <div>
            <div style={S.sectionTitle}>Skill Demand Trends</div>
            <SkillTrendChart trends={pipeline?.skill_trends ?? []} />
          </div>
        </div>
      )}

      {/* Role drill-down panel */}
      {selected && (
        <div style={S.drilldown}>
          <div style={S.drillHeader}>
            <div style={S.drillTitle}>{selected.role_name} — Detailed Insights</div>
            <button style={S.closeBtn} onClick={() => setSelected(null)}>✕ Close</button>
          </div>

          <div style={S.drillStats}>
            <div style={S.drillStat}>
              <div style={S.drillVal}>{selected.total_pipeline}</div>
              <div style={S.drillLabel}>Students in pipeline</div>
            </div>
            <div style={S.drillStat}>
              <div style={S.drillVal}>{selected.avg_match_score}%</div>
              <div style={S.drillLabel}>Avg match score</div>
            </div>
          </div>

          <div style={S.drillCols}>
            {/* Skill gap */}
            <div style={S.drillSection}>
              <div style={S.drillSectionTitle}>Skill Gap Analysis</div>
              {selected.skill_gap_analysis.map(gap => (
                <div key={gap.skill} style={S.gapRow}>
                  <div style={S.gapLabel}>{gap.skill}</div>
                  <div style={S.gapBar}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      width: `${gap.coverage_percent}%`,
                      background: gap.coverage_percent >= 60 ? '#22c55e'
                        : gap.coverage_percent >= 30 ? '#f59e0b' : '#ef4444',
                    }} />
                  </div>
                  <div style={S.gapPct}>{gap.coverage_percent}%</div>
                </div>
              ))}
            </div>

            {/* Stream distribution */}
            <div style={S.drillSection}>
              <div style={S.drillSectionTitle}>Stream Distribution</div>
              {selected.stream_distribution.map(s => (
                <div key={s.stream} style={S.streamRow}>
                  <div style={S.streamName}>{s.stream || 'Unknown'}</div>
                  <div style={S.streamCount}>{s.count} students</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page:             { padding: '28px 24px', background: '#0f172a', minHeight: '100vh' },
  topBar:           { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title:            { fontSize: 20, fontWeight: 700, color: '#f1f5f9' },
  addBtn:           { padding: '8px 16px', background: '#3b82f6', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, cursor: 'pointer' },
  error:            { background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '10px 14px', color: '#fca5a5', marginBottom: 16, fontSize: 14 },
  form:             { background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 20, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 },
  formTitle:        { fontSize: 15, fontWeight: 600, color: '#94a3b8' },
  row:              { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  inlineGroup:      { display: 'flex', gap: 8 },
  input:            { padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', fontSize: 14, outline: 'none' },
  submitBtn:        { padding: '10px 20px', background: '#3b82f6', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14, alignSelf: 'flex-start' },
  twoSection:       { display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24 },
  sectionTitle:     { fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' },
  tableWrap:        { background: '#1e293b', border: '1px solid #334155', borderRadius: 12, overflow: 'hidden' },
  empty:            { color: '#475569', padding: '32px 0', textAlign: 'center' },
  drilldown:        { marginTop: 28, background: '#1e293b', border: '1px solid #3b82f6', borderRadius: 12, padding: 24 },
  drillHeader:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  drillTitle:       { fontSize: 16, fontWeight: 700, color: '#f1f5f9' },
  closeBtn:         { background: 'none', border: '1px solid #334155', borderRadius: 6, color: '#64748b', cursor: 'pointer', padding: '5px 12px', fontSize: 12 },
  drillStats:       { display: 'flex', gap: 20, marginBottom: 20 },
  drillStat:        { background: '#0f172a', borderRadius: 8, padding: '12px 20px', textAlign: 'center', flex: 1 },
  drillVal:         { fontSize: 28, fontWeight: 700, color: '#60a5fa' },
  drillLabel:       { fontSize: 12, color: '#64748b', marginTop: 2 },
  drillCols:        { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  drillSection:     { background: '#0f172a', borderRadius: 8, padding: 16 },
  drillSectionTitle:{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' },
  gapRow:           { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  gapLabel:         { width: 120, fontSize: 12, color: '#cbd5e1', flexShrink: 0 },
  gapBar:           { flex: 1, background: '#1e293b', borderRadius: 3, height: 6, overflow: 'hidden' },
  gapPct:           { width: 36, fontSize: 11, color: '#64748b', textAlign: 'right' },
  streamRow:        { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #1e293b', fontSize: 13 },
  streamName:       { color: '#e2e8f0' },
  streamCount:      { color: '#60a5fa', fontWeight: 500 },
};
