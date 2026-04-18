'use client';

/**
 * src/modules/employer-dashboard/components/TalentTable.tsx
 *
 * Displays per-role talent pipeline stats for an employer.
 * Privacy: aggregated counts + skill gaps only — no student PII.
 */

import React from 'react';
import type { RolePipelineStats } from '../services/employer.api';

interface Props {
  roles:       RolePipelineStats[];
  onViewRole?: (roleId: string) => void;
}

function MatchBadge({ score }: { score: number }) {
  const color = score >= 70 ? '#22c55e' : score >= 45 ? '#f59e0b' : '#94a3b8';
  return (
    <span style={{ color, fontWeight: 600, fontSize: 14 }}>{score}%</span>
  );
}

function SkillGapBar({ coverage }: { coverage: number }) {
  const color = coverage >= 60 ? '#22c55e' : coverage >= 30 ? '#f59e0b' : '#ef4444';
  return (
    <div style={S.barWrap}>
      <div style={{ ...S.bar, width: `${coverage}%`, background: color }} />
      <span style={{ ...S.barLabel, color }}>{coverage}%</span>
    </div>
  );
}

export default function TalentTable({ roles, onViewRole }: Props) {
  if (!roles.length) {
    return (
      <div style={S.empty}>
        No job roles configured yet. Add roles to see talent pipeline data.
      </div>
    );
  }

  return (
    <div style={S.wrap}>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Role</th>
            <th style={{ ...S.th, textAlign: 'center' }}>Pipeline</th>
            <th style={{ ...S.th, textAlign: 'center' }}>Avg Match</th>
            <th style={S.th}>Top Skill Gap</th>
            <th style={S.th}>Salary Range</th>
            <th style={S.th} />
          </tr>
        </thead>
        <tbody>
          {roles.map(role => {
            const topGap = role.skill_gap?.[0];
            const salMin = role.salary_range?.min;
            const salMax = role.salary_range?.max;
            const currency = role.salary_range?.currency ?? 'USD';

            return (
              <tr key={role.role_id} style={S.tr}>
                <td style={S.td}>
                  <div style={S.roleName}>{role.role_name}</div>
                  {role.required_skills?.length > 0 && (
                    <div style={S.skillTags}>
                      {role.required_skills.slice(0, 3).map(sk => (
                        <span key={sk} style={S.skillTag}>{sk}</span>
                      ))}
                      {role.required_skills.length > 3 && (
                        <span style={S.skillTagMore}>+{role.required_skills.length - 3}</span>
                      )}
                    </div>
                  )}
                </td>
                <td style={{ ...S.td, textAlign: 'center' }}>
                  <div style={S.pipelineCount}>{role.pipeline_count}</div>
                  <div style={S.pipelineLabel}>students</div>
                </td>
                <td style={{ ...S.td, textAlign: 'center' }}>
                  <MatchBadge score={role.avg_match_score} />
                </td>
                <td style={S.td}>
                  {topGap ? (
                    <div>
                      <div style={S.gapSkill}>{topGap.skill}</div>
                      <SkillGapBar coverage={topGap.coverage_percent} />
                    </div>
                  ) : (
                    <span style={S.muted}>—</span>
                  )}
                </td>
                <td style={S.td}>
                  {salMin || salMax ? (
                    <span style={S.salary}>
                      {currency} {salMin?.toLocaleString() ?? '?'} – {salMax?.toLocaleString() ?? '?'}
                    </span>
                  ) : (
                    <span style={S.muted}>—</span>
                  )}
                </td>
                <td style={S.td}>
                  {onViewRole && (
                    <button
                      style={S.viewBtn}
                      onClick={() => onViewRole(role.role_id)}
                    >
                      Details →
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap:          { overflowX: 'auto' },
  table:         { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th:            { padding: '10px 14px', fontSize: 11, color: '#64748b', textAlign: 'left', borderBottom: '1px solid #1e293b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' },
  tr:            { borderBottom: '1px solid #1e293b', transition: 'background 0.15s' },
  td:            { padding: '14px 14px', verticalAlign: 'middle' },
  roleName:      { fontWeight: 600, color: '#f1f5f9', marginBottom: 4 },
  skillTags:     { display: 'flex', gap: 4, flexWrap: 'wrap' },
  skillTag:      { padding: '2px 6px', background: '#1e3a5f', border: '1px solid #1d4ed8', borderRadius: 4, fontSize: 11, color: '#93c5fd' },
  skillTagMore:  { padding: '2px 6px', background: '#1e293b', border: '1px solid #334155', borderRadius: 4, fontSize: 11, color: '#64748b' },
  pipelineCount: { fontSize: 20, fontWeight: 700, color: '#60a5fa' },
  pipelineLabel: { fontSize: 11, color: '#64748b' },
  gapSkill:      { fontSize: 13, color: '#e2e8f0', marginBottom: 4 },
  barWrap:       { display: 'flex', alignItems: 'center', gap: 6 },
  bar:           { height: 6, borderRadius: 3, flex: 1, maxWidth: 80, transition: 'width 0.4s' },
  barLabel:      { fontSize: 11, fontWeight: 600, width: 32 },
  salary:        { color: '#a3e635', fontSize: 13, fontWeight: 500 },
  muted:         { color: '#334155' },
  viewBtn:       { background: 'none', border: '1px solid #334155', borderRadius: 6, color: '#60a5fa', cursor: 'pointer', padding: '5px 10px', fontSize: 12 },
  empty:         { color: '#475569', padding: '40px 0', textAlign: 'center', fontSize: 14 },
};
