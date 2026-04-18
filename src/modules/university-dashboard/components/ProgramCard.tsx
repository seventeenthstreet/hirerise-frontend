'use client';

/**
 * src/modules/university-dashboard/components/ProgramCard.tsx
 *
 * Card for a single university program.
 * Shows: name, degree type, duration, tuition, matched student count.
 */

import React from 'react';
import type { ProgramAnalytics } from '../services/university.api';

interface ProgramCardProps {
  program:   ProgramAnalytics;
  onViewMatches?: (programId: string) => void;
}

export default function ProgramCard({ program, onViewMatches }: ProgramCardProps) {
  const matchColor =
    program.matched_count > 20 ? '#22c55e' :
    program.matched_count > 5  ? '#f59e0b' : '#94a3b8';

  return (
    <div style={S.card}>
      <div style={S.header}>
        <div>
          <div style={S.programName}>{program.program_name}</div>
          <div style={S.badge}>{program.degree_type || 'Program'}</div>
        </div>
        <div style={{ ...S.matchPill, background: matchColor + '20', color: matchColor }}>
          {program.matched_count} students
        </div>
      </div>

      <div style={S.stats}>
        <div style={S.stat}>
          <span style={S.statLabel}>Avg match</span>
          <span style={S.statValue}>{program.avg_score}%</span>
        </div>
        <div style={S.stat}>
          <span style={S.statLabel}>Top skills</span>
          <span style={S.statValue}>{program.top_skills?.length ?? 0}</span>
        </div>
      </div>

      {program.top_skills && program.top_skills.length > 0 && (
        <div style={S.skills}>
          {program.top_skills.slice(0, 4).map(s => (
            <span key={s.skill} style={S.skillTag}>{s.skill}</span>
          ))}
        </div>
      )}

      {onViewMatches && (
        <button
          style={S.btn}
          onClick={() => onViewMatches(program.program_id)}
        >
          View matched students →
        </button>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  card: {
    background:   '#1e293b',
    border:       '1px solid #334155',
    borderRadius: 12,
    padding:      20,
    display:      'flex',
    flexDirection:'column',
    gap:          12,
  },
  header: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
  },
  programName: {
    fontSize:   16,
    fontWeight: 600,
    color:      '#f1f5f9',
    marginBottom: 4,
  },
  badge: {
    display:      'inline-block',
    padding:      '2px 8px',
    background:   '#3b82f620',
    color:        '#93c5fd',
    borderRadius: 4,
    fontSize:     12,
    fontWeight:   500,
  },
  matchPill: {
    padding:      '4px 10px',
    borderRadius: 20,
    fontSize:     13,
    fontWeight:   600,
    whiteSpace:   'nowrap',
  },
  stats: {
    display: 'flex',
    gap:     16,
  },
  stat: {
    display:       'flex',
    flexDirection: 'column',
    gap:           2,
  },
  statLabel: {
    fontSize: 11,
    color:    '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  statValue: {
    fontSize:   15,
    fontWeight: 600,
    color:      '#f1f5f9',
  },
  skills: {
    display:  'flex',
    flexWrap: 'wrap',
    gap:      6,
  },
  skillTag: {
    padding:      '3px 8px',
    background:   '#0f172a',
    border:       '1px solid #334155',
    borderRadius: 4,
    fontSize:     12,
    color:        '#94a3b8',
  },
  btn: {
    marginTop:    4,
    background:   'none',
    border:       'none',
    color:        '#60a5fa',
    fontSize:     13,
    cursor:       'pointer',
    padding:      0,
    textAlign:    'left',
  },
};
