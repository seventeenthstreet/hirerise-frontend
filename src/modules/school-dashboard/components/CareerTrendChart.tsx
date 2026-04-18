'use client';

/**
 * src/modules/school-dashboard/components/CareerTrendChart.tsx
 *
 * Vertical bar / ranked list chart showing the top career interests
 * across the school — how many students have each career as a top prediction.
 *
 * Purely CSS-driven, no chart library dependency.
 */

import React from 'react';
import type { CareerCount } from '../services/school.api';

interface CareerTrendChartProps {
  careers:   CareerCount[];
  isLoading: boolean;
  totalAssessed: number;
}

const BAR_GRADIENTS = [
  'linear-gradient(135deg, #4f46e5, #7c3aed)',
  'linear-gradient(135deg, #059669, #0d9488)',
  'linear-gradient(135deg, #d97706, #f59e0b)',
  'linear-gradient(135deg, #be185d, #ec4899)',
  'linear-gradient(135deg, #0284c7, #0ea5e9)',
  'linear-gradient(135deg, #7c3aed, #6d28d9)',
  'linear-gradient(135deg, #065f46, #059669)',
  'linear-gradient(135deg, #92400e, #d97706)',
  'linear-gradient(135deg, #831843, #be185d)',
  'linear-gradient(135deg, #1e3a8a, #0284c7)',
];

export default function CareerTrendChart({ careers, isLoading, totalAssessed }: CareerTrendChartProps) {
  const top10 = careers.slice(0, 10);
  const maxCount = top10.length > 0 ? top10[0].student_count : 1;

  return (
    <div style={S.card}>
      <div style={S.header}>
        <div style={S.titleGroup}>
          <span style={S.icon}>🚀</span>
          <div>
            <div style={S.title}>Career Interest Trends</div>
            <div style={S.subtitle}>Top career predictions across the school</div>
          </div>
        </div>
        {totalAssessed > 0 && (
          <div style={S.badge}>{totalAssessed} assessed</div>
        )}
      </div>

      <div style={S.list}>
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={S.itemRow}>
              <div style={{ ...S.skeleton, width: 24, height: 24, borderRadius: '50%' }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ ...S.skeleton, width: 160 + i * 10, height: 13 }} />
                <div style={{ ...S.skeleton, width: `${70 - i * 8}%`, height: 8 }} />
              </div>
              <div style={{ ...S.skeleton, width: 30, height: 13 }} />
            </div>
          ))
          : top10.length === 0
            ? <div style={S.empty}>No career predictions yet. Run assessments to see trends.</div>
            : top10.map(({ career, student_count }, idx) => {
              const pct      = Math.round((student_count / maxCount) * 100);
              const gradient = BAR_GRADIENTS[idx % BAR_GRADIENTS.length];
              return (
                <div key={career} style={S.itemRow}>
                  {/* Rank badge */}
                  <div style={{ ...S.rankBadge, background: idx === 0 ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)' }}>
                    <span style={{ ...S.rankNum, color: idx === 0 ? '#fcd34d' : '#64748b' }}>
                      {idx + 1}
                    </span>
                  </div>

                  {/* Bar + label */}
                  <div style={S.barArea}>
                    <div style={S.careerName}>{career}</div>
                    <div style={S.barTrack}>
                      <div style={{ ...S.barFill, width: `${pct}%`, background: gradient }} />
                    </div>
                  </div>

                  {/* Count */}
                  <div style={S.count}>{student_count}</div>
                </div>
              );
            })
        }
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  card:       { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '24px 24px 20px', display: 'flex', flexDirection: 'column', gap: 20 },
  header:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  titleGroup: { display: 'flex', gap: 12, alignItems: 'flex-start' },
  icon:       { fontSize: 24, lineHeight: 1, marginTop: 2 },
  title:      { fontSize: 15, fontWeight: 700, color: '#e2e8f0' },
  subtitle:   { fontSize: 12.5, color: '#64748b', marginTop: 2 },
  badge:      { fontSize: 11.5, fontWeight: 700, color: '#6ee7b7', background: 'rgba(6,214,160,0.12)', border: '1px solid rgba(6,214,160,0.20)', borderRadius: 20, padding: '4px 10px' },

  list:       { display: 'flex', flexDirection: 'column', gap: 12 },
  itemRow:    { display: 'flex', alignItems: 'center', gap: 12 },

  rankBadge:  { width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rankNum:    { fontSize: 12, fontWeight: 800 },

  barArea:    { flex: 1, display: 'flex', flexDirection: 'column', gap: 5 },
  careerName: { fontSize: 13, fontWeight: 600, color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  barTrack:   { height: 7, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' },
  barFill:    { height: '100%', borderRadius: 999, transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)', minWidth: 4 },

  count:      { fontSize: 12.5, fontWeight: 700, color: '#94a3b8', minWidth: 24, textAlign: 'right' },

  empty:      { fontSize: 13.5, color: '#374151', textAlign: 'center', padding: 24 },
  skeleton:   { borderRadius: 6, background: 'rgba(255,255,255,0.06)', animation: 'shimmer 1.4s infinite' },
};
