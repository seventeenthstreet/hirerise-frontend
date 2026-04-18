'use client';

/**
 * src/modules/school-dashboard/components/StudentTable.tsx
 *
 * Sortable, filterable table of students for the school dashboard.
 *
 * Features:
 *   - Search by name or email
 *   - Filter by assessment status
 *   - Stream badge per student
 *   - Run Assessment + View Report action buttons
 *   - Loading skeleton rows
 */

import React, { useState, useMemo } from 'react';
import type { SchoolStudent } from '../services/school.api';

interface StudentTableProps {
  students:         SchoolStudent[];
  schoolId:         string;
  isLoading:        boolean;
  onRunAssessment:  (studentId: string) => void;
  onViewReport:     (studentId: string) => void;
  assessingIds:     Set<string>;
}

// ─── Stream badge colours ─────────────────────────────────────────────────────

const STREAM_COLORS: Record<string, { bg: string; text: string }> = {
  engineering: { bg: 'rgba(99,102,241,0.20)',  text: '#a5b4fc' },
  medical:     { bg: 'rgba(16,185,129,0.20)',  text: '#6ee7b7' },
  commerce:    { bg: 'rgba(245,158,11,0.20)',  text: '#fcd34d' },
  humanities:  { bg: 'rgba(236,72,153,0.20)',  text: '#f9a8d4' },
};

function StreamBadge({ stream, label }: { stream: string | null; label: string | null }) {
  if (!stream) return <span style={S.noStream}>Not assessed</span>;
  const colors = STREAM_COLORS[stream] || { bg: 'rgba(255,255,255,0.08)', text: '#94a3b8' };
  return (
    <span style={{ ...S.streamBadge, background: colors.bg, color: colors.text }}>
      {label || stream}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {[180, 200, 60, 60, 130, 100].map((w, i) => (
        <td key={i} style={S.td}>
          <div style={{ ...S.skeleton, width: w }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StudentTable({
  students, schoolId, isLoading, onRunAssessment, onViewReport, assessingIds,
}: StudentTableProps) {
  const [search,     setSearch]     = useState('');
  const [filterDone, setFilterDone] = useState<'all' | 'assessed' | 'pending'>('all');

  const filtered = useMemo(() => {
    let list = students;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        (s.name  || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q)
      );
    }
    if (filterDone === 'assessed') list = list.filter(s => s.assessment_done);
    if (filterDone === 'pending')  list = list.filter(s => !s.assessment_done);
    return list;
  }, [students, search, filterDone]);

  return (
    <div style={S.wrap}>
      {/* Toolbar */}
      <div style={S.toolbar}>
        <input
          style={S.search}
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={S.filters}>
          {(['all', 'assessed', 'pending'] as const).map(f => (
            <button
              key={f}
              style={{ ...S.filterBtn, ...(filterDone === f ? S.filterBtnActive : {}) }}
              onClick={() => setFilterDone(f)}
            >
              {f === 'all' ? `All (${students.length})` : f === 'assessed' ? `Assessed (${students.filter(s => s.assessment_done).length})` : `Pending (${students.filter(s => !s.assessment_done).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              {['Name', 'Email', 'Class', 'Section', 'Stream', 'Actions'].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : filtered.length === 0
                ? (
                  <tr>
                    <td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#475569', padding: 32 }}>
                      {search ? 'No students match your search.' : 'No students yet. Import a CSV to get started.'}
                    </td>
                  </tr>
                )
                : filtered.map(student => {
                  const isAssessing = assessingIds.has(student.student_id);
                  return (
                    <tr key={student.student_id} style={S.row}>
                      <td style={S.td}>
                        <div style={S.studentName}>{student.name || '—'}</div>
                      </td>
                      <td style={S.td}>
                        <span style={S.email}>{student.email || '—'}</span>
                      </td>
                      <td style={S.td}><span style={S.chip}>{student.class || '—'}</span></td>
                      <td style={S.td}><span style={S.chip}>{student.section || '—'}</span></td>
                      <td style={S.td}>
                        <StreamBadge
                          stream={student.recommended_stream}
                          label={student.recommended_label}
                        />
                        {student.stream_confidence != null && (
                          <div style={S.confidence}>{Math.round(student.stream_confidence)}% confidence</div>
                        )}
                      </td>
                      <td style={S.td}>
                        <div style={S.actions}>
                          <button
                            style={{ ...S.actionBtn, ...S.assessBtn }}
                            onClick={() => onRunAssessment(student.student_id)}
                            disabled={isAssessing}
                            title="Run AI assessment"
                          >
                            {isAssessing ? '⏳' : '▶'} {isAssessing ? 'Running…' : 'Assess'}
                          </button>
                          {student.assessment_done && (
                            <button
                              style={{ ...S.actionBtn, ...S.reportBtn }}
                              onClick={() => onViewReport(student.student_id)}
                              title="View full report"
                            >
                              📄 Report
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
            }
          </tbody>
        </table>
      </div>

      <div style={S.footer}>
        Showing {filtered.length} of {students.length} students
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  wrap:      { display: 'flex', flexDirection: 'column', gap: 0 },
  toolbar:   { display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  search:    { flex: 1, maxWidth: 320, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 10, color: '#e2e8f0', fontSize: 13.5, padding: '8px 14px', outline: 'none' },
  filters:   { display: 'flex', gap: 6 },
  filterBtn: { background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, color: '#64748b', fontSize: 12.5, fontWeight: 600, padding: '6px 12px', cursor: 'pointer' },
  filterBtnActive: { background: 'rgba(99,102,241,0.20)', borderColor: 'rgba(99,102,241,0.40)', color: '#a5b4fc' },

  tableWrap: { overflowX: 'auto' },
  table:     { width: '100%', borderCollapse: 'collapse' },
  th:        { textAlign: 'left', padding: '12px 20px', fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' },
  td:        { padding: '13px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' },
  row:       { transition: 'background 0.12s' },

  studentName: { fontSize: 13.5, fontWeight: 600, color: '#e2e8f0' },
  email:       { fontSize: 12.5, color: '#64748b' },
  chip:        { fontSize: 12, color: '#94a3b8', background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '2px 8px' },

  streamBadge:  { fontSize: 12, fontWeight: 600, borderRadius: 6, padding: '3px 10px', whiteSpace: 'nowrap' },
  noStream:     { fontSize: 12, color: '#374151', fontStyle: 'italic' },
  confidence:   { fontSize: 11, color: '#475569', marginTop: 3 },

  actions:   { display: 'flex', gap: 6 },
  actionBtn: { fontSize: 12, fontWeight: 600, borderRadius: 7, padding: '5px 11px', border: 'none', cursor: 'pointer', transition: 'opacity 0.15s', whiteSpace: 'nowrap' },
  assessBtn: { background: 'rgba(99,102,241,0.20)', color: '#a5b4fc' },
  reportBtn: { background: 'rgba(16,185,129,0.15)', color: '#6ee7b7' },

  footer:   { padding: '10px 20px', fontSize: 12, color: '#475569', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'right' },

  skeleton: { height: 14, borderRadius: 6, background: 'rgba(255,255,255,0.06)', animation: 'shimmer 1.4s infinite' },
};
