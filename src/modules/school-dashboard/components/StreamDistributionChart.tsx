'use client';

/**
 * src/modules/school-dashboard/components/StreamDistributionChart.tsx
 *
 * Horizontal bar chart showing stream suitability distribution across the school.
 * Pure CSS — no external chart library needed.
 *
 * Props:
 *   distribution — array of { stream, label, count, percent }
 *   isLoading    — show skeleton bars
 */

import React from 'react';
import type { StreamDistribution } from '../services/school.api';

interface StreamDistributionChartProps {
  distribution: StreamDistribution[];
  isLoading:    boolean;
}

const STREAM_COLORS: Record<string, { bar: string; glow: string }> = {
  engineering: { bar: 'linear-gradient(90deg, #4f46e5, #7c3aed)', glow: 'rgba(99,102,241,0.25)' },
  medical:     { bar: 'linear-gradient(90deg, #059669, #0d9488)', glow: 'rgba(5,150,105,0.25)'  },
  commerce:    { bar: 'linear-gradient(90deg, #d97706, #f59e0b)', glow: 'rgba(217,119,6,0.25)'  },
  humanities:  { bar: 'linear-gradient(90deg, #be185d, #ec4899)', glow: 'rgba(190,24,93,0.25)'  },
};

const DEFAULT_COLOR = { bar: 'linear-gradient(90deg, #374151, #4b5563)', glow: 'rgba(100,116,139,0.15)' };

const STREAM_ICONS: Record<string, string> = {
  engineering: '⚙️',
  medical:     '🏥',
  commerce:    '📊',
  humanities:  '🎨',
};

export default function StreamDistributionChart({ distribution, isLoading }: StreamDistributionChartProps) {
  const sorted = [...distribution].sort((a, b) => b.percent - a.percent);

  return (
    <div style={S.card}>
      <div style={S.header}>
        <div style={S.titleGroup}>
          <span style={S.icon}>📊</span>
          <div>
            <div style={S.title}>Stream Distribution</div>
            <div style={S.subtitle}>Suitability across all assessed students</div>
          </div>
        </div>
      </div>

      <div style={S.bars}>
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={S.barRow}>
              <div style={{ ...S.skeleton, width: 120, marginBottom: 8 }} />
              <div style={{ ...S.skeleton, width: '100%', height: 28 }} />
            </div>
          ))
          : sorted.length === 0
            ? <div style={S.empty}>No assessment data yet.</div>
            : sorted.map(({ stream, label, count, percent }) => {
              const colors = STREAM_COLORS[stream] || DEFAULT_COLOR;
              const icon   = STREAM_ICONS[stream] || '📌';
              return (
                <div key={stream} style={S.barRow}>
                  <div style={S.barLabel}>
                    <span style={S.streamIcon}>{icon}</span>
                    <span style={S.streamName}>{label || stream}</span>
                    <span style={S.streamCount}>{count} students</span>
                  </div>
                  <div style={S.barTrack}>
                    <div
                      style={{
                        ...S.barFill,
                        width: `${percent}%`,
                        background: colors.bar,
                        boxShadow: `0 0 12px ${colors.glow}`,
                      }}
                    />
                    <span style={S.barPct}>{percent}%</span>
                  </div>
                </div>
              );
            })
        }
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  card:      { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '24px 24px 20px', display: 'flex', flexDirection: 'column', gap: 20 },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  titleGroup:{ display: 'flex', gap: 12, alignItems: 'flex-start' },
  icon:      { fontSize: 24, lineHeight: 1, marginTop: 2 },
  title:     { fontSize: 15, fontWeight: 700, color: '#e2e8f0' },
  subtitle:  { fontSize: 12.5, color: '#64748b', marginTop: 2 },

  bars:      { display: 'flex', flexDirection: 'column', gap: 16 },
  barRow:    { display: 'flex', flexDirection: 'column', gap: 6 },
  barLabel:  { display: 'flex', alignItems: 'center', gap: 8 },
  streamIcon:{ fontSize: 14 },
  streamName:{ fontSize: 13, fontWeight: 600, color: '#cbd5e1', flex: 1 },
  streamCount:{ fontSize: 12, color: '#475569' },

  barTrack:  { position: 'relative', height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'visible', display: 'flex', alignItems: 'center' },
  barFill:   { height: '100%', borderRadius: 999, transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)', minWidth: 4 },
  barPct:    { position: 'absolute', right: 0, transform: 'translateX(calc(100% + 8px))', fontSize: 12, fontWeight: 700, color: '#94a3b8', whiteSpace: 'nowrap' },

  empty:     { fontSize: 13.5, color: '#374151', textAlign: 'center', padding: 24 },
  skeleton:  { borderRadius: 6, background: 'rgba(255,255,255,0.06)', animation: 'shimmer 1.4s infinite' },
};
