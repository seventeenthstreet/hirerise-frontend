'use client';

/**
 * src/modules/university-dashboard/components/StudentMatchTable.tsx
 *
 * Aggregated student match insights for a university program.
 * PRIVACY: shows only stream distribution and skill frequencies — never PII.
 */

import React from 'react';
import type { StudentMatchInsights } from '../services/university.api';

interface Props {
  insights: StudentMatchInsights;
}

export default function StudentMatchTable({ insights }: Props) {
  const total = insights.total_matched;

  return (
    <div style={S.wrap}>
      {/* Summary */}
      <div style={S.summary}>
        <div style={S.summaryCard}>
          <div style={S.summaryValue}>{total}</div>
          <div style={S.summaryLabel}>Matched students</div>
        </div>
        <div style={S.summaryCard}>
          <div style={S.summaryValue}>{insights.avg_match_score}%</div>
          <div style={S.summaryLabel}>Avg match score</div>
        </div>
      </div>

      <div style={S.cols}>
        {/* Stream distribution */}
        <div style={S.section}>
          <div style={S.sectionTitle}>Stream Distribution</div>
          {insights.stream_distribution.length === 0 ? (
            <div style={S.empty}>No data yet</div>
          ) : (
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Stream</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Students</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Share</th>
                </tr>
              </thead>
              <tbody>
                {insights.stream_distribution.map(row => (
                  <tr key={row.stream} style={S.tr}>
                    <td style={S.td}>{row.stream || 'Unknown'}</td>
                    <td style={{ ...S.td, textAlign: 'right' }}>{row.count}</td>
                    <td style={{ ...S.td, textAlign: 'right' }}>
                      {total > 0 ? Math.round((row.count / total) * 100) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Top student skills */}
        <div style={S.section}>
          <div style={S.sectionTitle}>Top Student Skills</div>
          {insights.top_student_skills.length === 0 ? (
            <div style={S.empty}>No skill data yet</div>
          ) : (
            <div style={S.skillList}>
              {insights.top_student_skills.map(s => (
                <div key={s.skill} style={S.skillRow}>
                  <div style={S.skillName}>{s.skill}</div>
                  <div style={S.barWrap}>
                    <div
                      style={{
                        ...S.bar,
                        width: `${Math.min(100, Math.round((s.student_count / total) * 100))}%`,
                      }}
                    />
                  </div>
                  <div style={S.skillCount}>{s.student_count}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={S.privacyNote}>
        🔒 Aggregated data only. No student names or personal information are displayed.
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 20 },
  summary: { display: 'flex', gap: 16 },
  summaryCard: {
    flex: 1, background: '#1e293b', border: '1px solid #334155',
    borderRadius: 10, padding: 16, textAlign: 'center',
  },
  summaryValue: { fontSize: 28, fontWeight: 700, color: '#60a5fa' },
  summaryLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },
  cols: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  section: {
    background: '#1e293b', border: '1px solid #334155',
    borderRadius: 10, padding: 16,
  },
  sectionTitle: { fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { fontSize: 12, color: '#64748b', padding: '4px 0', textAlign: 'left', borderBottom: '1px solid #334155' },
  tr: {},
  td: { fontSize: 14, color: '#e2e8f0', padding: '8px 0', borderBottom: '1px solid #1e293b' },
  empty: { color: '#475569', fontSize: 14, padding: '8px 0' },
  skillList: { display: 'flex', flexDirection: 'column', gap: 8 },
  skillRow: { display: 'flex', alignItems: 'center', gap: 8 },
  skillName: { fontSize: 13, color: '#e2e8f0', width: 120, flexShrink: 0 },
  barWrap: { flex: 1, background: '#0f172a', borderRadius: 4, height: 8, overflow: 'hidden' },
  bar: { height: '100%', background: '#3b82f6', borderRadius: 4, transition: 'width 0.4s' },
  skillCount: { fontSize: 12, color: '#64748b', width: 30, textAlign: 'right' },
  privacyNote: { fontSize: 12, color: '#475569', padding: '8px 12px', background: '#0f172a', borderRadius: 6 },
};
