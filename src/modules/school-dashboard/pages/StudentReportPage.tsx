'use client';

/**
 * src/modules/school-dashboard/pages/StudentReportPage.tsx
 *
 * Full AI career report for a student, viewed by school admin/counselor.
 *
 * Sections:
 *   ① Student header (name, class, section)
 *   ② Stream Analysis — recommended stream + confidence + rationale
 *   ③ Cognitive Profile — 5-dimension score bars
 *   ④ Career Predictions — top 10 with probability bars
 *   ⑤ Education ROI — ranked education paths
 *   ⑥ Career Simulations — salary projections table
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { schoolApi, type StudentReport } from '../services/school.api';

interface StudentReportPageProps {
  schoolId:  string;
  studentId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(n: unknown): string {
  if (n == null || isNaN(Number(n))) return '—';
  return `${Math.round(Number(n))}%`;
}

function lpa(n: unknown): string {
  if (n == null || isNaN(Number(n))) return '—';
  return `₹${(Number(n) / 100000).toFixed(1)} LPA`;
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={S.section}>
      <div style={S.sectionHeader}>
        <span style={S.sectionIcon}>{icon}</span>
        <h2 style={S.sectionTitle}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value, color = '#4f46e5', label }: { value: number; color?: string; label: string }) {
  return (
    <div style={S.progRow}>
      <div style={S.progLabel}>{label}</div>
      <div style={S.progTrack}>
        <div style={{ ...S.progFill, width: `${Math.min(100, value)}%`, background: color }} />
      </div>
      <div style={S.progValue}>{pct(value)}</div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StudentReportPage({ schoolId, studentId }: StudentReportPageProps) {
  const router  = useRouter();
  const [report, setReport] = useState<StudentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId || !studentId) return;
    schoolApi.getStudentReport(schoolId, studentId)
      .then(r => setReport(r))
      .catch(err => setError(err?.message || 'Failed to load report.'))
      .finally(() => setLoading(false));
  }, [schoolId, studentId]);

  const student  = report?.student  as Record<string, unknown> | null;
  const stream   = report?.stream_analysis  as Record<string, unknown> | null;
  const cog      = report?.cognitive_profile as Record<string, unknown> | null;
  const careers  = (report?.career_predictions || []) as Record<string, unknown>[];
  const roi      = (report?.education_roi      || []) as Record<string, unknown>[];
  const sims     = (report?.career_simulations || []) as Record<string, unknown>[];

  const STREAM_COLORS: Record<string, string> = {
    engineering: '#6366f1', medical: '#10b981', commerce: '#f59e0b', humanities: '#ec4899',
  };

  return (
    <>
      <style>{CSS}</style>
      <div style={S.root}>

        {/* Header */}
        <header style={S.header}>
          <div style={S.headerInner}>
            <div style={S.left}>
              <button style={S.backBtn} onClick={() => router.push(`/school/students?schoolId=${schoolId}`)}>← Students</button>
              <span style={S.sep}>·</span>
              <span style={S.pageTitle}>Student Career Report</span>
            </div>
            <div style={S.genAt}>
              {report?.generated_at ? `Generated ${new Date(report.generated_at).toLocaleString('en-IN')}` : ''}
            </div>
          </div>
        </header>

        <main style={S.main}>

          {/* Loading */}
          {loading && (
            <div style={S.loadWrap}>
              <div style={S.spinner} />
              <p style={S.loadText}>Loading report…</p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div style={S.errorBox}>{error}</div>
          )}

          {/* Report */}
          {!loading && report && (
            <>
              {/* ① Student Header */}
              <div style={S.studentCard}>
                <div style={S.studentAvatar}>
                  {(String(student?.name || 'S'))[0].toUpperCase()}
                </div>
                <div style={S.studentInfo}>
                  <div style={S.studentName}>{String(student?.name || 'Student')}</div>
                  <div style={S.studentMeta}>{String(student?.email || '')}</div>
                  <div style={S.studentMeta}>
                    Education: {String(student?.education_level || '—').replace('_', ' ')}
                  </div>
                </div>
                {stream && (
                  <div style={{
                    ...S.streamPill,
                    background: (STREAM_COLORS[String(stream.recommended_stream)] || '#4f46e5') + '22',
                    color:      STREAM_COLORS[String(stream.recommended_stream)] || '#a5b4fc',
                  }}>
                    ✦ {String(stream.recommended_label || stream.recommended_stream || 'N/A')}
                  </div>
                )}
              </div>

              {/* ② Stream Analysis */}
              {stream && (
                <Section title="Stream Analysis" icon="🎯">
                  <div style={S.streamGrid}>
                    <div style={S.streamStat}>
                      <div style={S.streamStatVal}>{String(stream.recommended_label || '—')}</div>
                      <div style={S.streamStatLabel}>Recommended Stream</div>
                    </div>
                    <div style={S.streamStat}>
                      <div style={S.streamStatVal}>{pct(stream.confidence as number)}</div>
                      <div style={S.streamStatLabel}>Confidence</div>
                    </div>
                    {!!stream.alternative_label && (
                      <div style={S.streamStat}>
                        <div style={S.streamStatVal}>{String(stream.alternative_label)}</div>
                        <div style={S.streamStatLabel}>Alternative Stream</div>
                      </div>
                    )}
                  </div>
                  {!!stream.rationale && (
                    <div style={S.rationale}>{String(stream.rationale)}</div>
                  )}
                  {!!(stream.stream_scores) && (
                    <div style={S.scoreGrid}>
                      {Object.entries(stream.stream_scores as Record<string, number>).map(([s, v]) => (
                        <ProgressBar key={s} label={s.charAt(0).toUpperCase() + s.slice(1)} value={v} color={STREAM_COLORS[s] || '#4f46e5'} />
                      ))}
                    </div>
                  )}
                </Section>
              )}

              {/* ③ Cognitive Profile */}
              {cog && (
                <Section title="Cognitive Profile" icon="🧠">
                  <div style={S.scoreGrid}>
                    {[
                      { key: 'analytical_score',    label: 'Analytical',    color: '#6366f1' },
                      { key: 'logical_score',        label: 'Logical',       color: '#10b981' },
                      { key: 'memory_score',         label: 'Memory',        color: '#f59e0b' },
                      { key: 'communication_score',  label: 'Communication', color: '#ec4899' },
                      { key: 'creativity_score',     label: 'Creativity',    color: '#8b5cf6' },
                    ].map(({ key, label, color }) => (
                      <ProgressBar key={key} label={label} value={Number(cog[key]) || 0} color={color} />
                    ))}
                  </div>
                </Section>
              )}

              {/* ④ Career Predictions */}
              {careers.length > 0 && (
                <Section title="Career Predictions" icon="🚀">
                  <div style={S.careerList}>
                    {careers.map((c, i) => (
                      <div key={i} style={S.careerRow}>
                        <div style={S.careerRank}>{i + 1}</div>
                        <div style={S.careerName}>{String(c.career_name || c.career || '—')}</div>
                        <div style={S.careerBar}>
                          <div style={{ ...S.careerBarFill, width: `${Number(c.success_probability || c.probability) || 0}%` }} />
                        </div>
                        <div style={S.careerPct}>{pct(Number(c.success_probability || c.probability))}</div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* ⑤ Education ROI */}
              {roi.length > 0 && (
                <Section title="Education ROI" icon="🎓">
                  <div style={S.roiGrid}>
                    {roi.map((r, i) => {
                      const level  = String(r.roi_level || '');
                      const roiColor = level === 'Very High' ? '#6ee7b7'
                        : level === 'High' ? '#a5b4fc'
                        : level === 'Moderate' ? '#fcd34d' : '#94a3b8';
                      return (
                        <div key={i} style={S.roiCard}>
                          <div style={S.roiPath}>{String(r.education_path || r.path || '—')}</div>
                          <div style={S.roiRow}><span style={S.roiKey}>Duration</span><span>{String(r.duration_years || '—')} years</span></div>
                          <div style={S.roiRow}><span style={S.roiKey}>Cost</span><span>{lpa(r.estimated_cost)}</span></div>
                          <div style={S.roiRow}><span style={S.roiKey}>Expected Salary</span><span>{lpa(r.expected_salary)}</span></div>
                          <div style={{ ...S.roiBadge, color: roiColor, background: roiColor + '18' }}>{level} ROI</div>
                        </div>
                      );
                    })}
                  </div>
                </Section>
              )}

              {/* ⑥ Career Simulations */}
              {sims.length > 0 && (
                <Section title="Salary Projections" icon="📈">
                  <div style={S.tableWrap}>
                    <table style={S.table}>
                      <thead>
                        <tr>
                          {['Career', 'Probability', 'Entry', '5 Years', '10 Years', 'Demand'].map(h => (
                            <th key={h} style={S.th}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sims.map((sim, i) => (
                          <tr key={i}>
                            <td style={S.td}><div style={S.careerNameCell}>{String(sim.career_name || sim.career || '—')}</div></td>
                            <td style={S.td}>{pct(Number(sim.probability))}</td>
                            <td style={S.td}>{lpa(sim.entry_salary)}</td>
                            <td style={S.td}>{lpa(sim.salary_5_year)}</td>
                            <td style={{ ...S.td, fontWeight: 700, color: '#6ee7b7' }}>{lpa(sim.salary_10_year)}</td>
                            <td style={S.td}><span style={S.demandChip}>{String(sim.demand_level || '—')}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
  button:hover { opacity:0.85; }
`;

const S: Record<string, React.CSSProperties> = {
  root:        { minHeight: '100vh', background: '#080c14', fontFamily: "'DM Sans', sans-serif", color: '#f9fafb' },
  header:      { background: '#0d1117', borderBottom: '1px solid #1f2937', position: 'sticky', top: 0, zIndex: 40 },
  headerInner: { maxWidth: 900, margin: '0 auto', padding: '13px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  left:        { display: 'flex', alignItems: 'center', gap: 10 },
  backBtn:     { background: 'transparent', border: '1.5px solid #1f2937', borderRadius: 8, color: '#6b7280', fontSize: 12, fontWeight: 600, padding: '5px 12px', cursor: 'pointer' },
  sep:         { color: '#374151' },
  pageTitle:   { fontSize: 13, color: '#6b7280' },
  genAt:       { fontSize: 11.5, color: '#374151' },

  main:        { maxWidth: 900, margin: '0 auto', padding: '32px 24px 60px', display: 'flex', flexDirection: 'column', gap: 24 },

  loadWrap:    { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 60 },
  spinner:     { width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.10)', borderTopColor: '#6ee7b7', animation: 'spin 0.7s linear infinite' },
  loadText:    { fontSize: 14, color: '#64748b' },
  errorBox:    { background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: '16px 20px', fontSize: 13.5, color: '#fca5a5' },

  studentCard: { display: 'flex', alignItems: 'center', gap: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '24px 28px', animation: 'fadeIn 0.3s ease' },
  studentAvatar:{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#fff', flexShrink: 0 },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 20, fontWeight: 700, color: '#f9fafb' },
  studentMeta: { fontSize: 13, color: '#64748b', marginTop: 4 },
  streamPill:  { fontSize: 13, fontWeight: 700, borderRadius: 10, padding: '6px 16px' },

  section:     { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '24px', display: 'flex', flexDirection: 'column', gap: 18, animation: 'fadeIn 0.4s ease' },
  sectionHeader:{ display: 'flex', alignItems: 'center', gap: 10 },
  sectionIcon: { fontSize: 20 },
  sectionTitle:{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' },

  streamGrid:  { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 },
  streamStat:  { background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '14px 16px' },
  streamStatVal:{ fontSize: 18, fontWeight: 700, color: '#f9fafb' },
  streamStatLabel:{ fontSize: 11.5, color: '#64748b', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.07em' },
  rationale:   { fontSize: 13.5, color: '#94a3b8', lineHeight: 1.65, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '14px 16px', borderLeft: '3px solid rgba(99,102,241,0.4)' },

  scoreGrid:   { display: 'flex', flexDirection: 'column', gap: 12 },
  progRow:     { display: 'flex', alignItems: 'center', gap: 12 },
  progLabel:   { width: 130, fontSize: 13, color: '#94a3b8', flexShrink: 0 },
  progTrack:   { flex: 1, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' },
  progFill:    { height: '100%', borderRadius: 999, transition: 'width 0.7s ease' },
  progValue:   { width: 40, fontSize: 12.5, fontWeight: 700, color: '#e2e8f0', textAlign: 'right' },

  careerList:  { display: 'flex', flexDirection: 'column', gap: 10 },
  careerRow:   { display: 'flex', alignItems: 'center', gap: 12 },
  careerRank:  { width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', fontSize: 12, fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  careerName:  { width: 200, fontSize: 13.5, fontWeight: 600, color: '#cbd5e1', flexShrink: 0 },
  careerBar:   { flex: 1, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' },
  careerBarFill:{ height: '100%', background: 'linear-gradient(90deg, #4f46e5, #7c3aed)', borderRadius: 999, transition: 'width 0.8s ease' },
  careerPct:   { width: 40, fontSize: 12.5, fontWeight: 700, color: '#a5b4fc', textAlign: 'right' },

  roiGrid:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 },
  roiCard:     { background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 },
  roiPath:     { fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 },
  roiRow:      { display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#94a3b8' },
  roiKey:      { color: '#64748b' },
  roiBadge:    { fontSize: 12, fontWeight: 700, borderRadius: 6, padding: '3px 10px', textAlign: 'center', marginTop: 4 },

  tableWrap:   { overflowX: 'auto' },
  table:       { width: '100%', borderCollapse: 'collapse' },
  th:          { textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.07em', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  td:          { padding: '11px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 13.5, color: '#94a3b8', verticalAlign: 'middle' },
  careerNameCell:{ fontSize: 13.5, fontWeight: 600, color: '#e2e8f0' },
  demandChip:  { fontSize: 11.5, fontWeight: 600, background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '2px 8px', color: '#94a3b8' },
};