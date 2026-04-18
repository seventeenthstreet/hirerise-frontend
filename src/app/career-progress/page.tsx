'use client';

/**
 * app/career-progress/page.tsx — Career Progress Tracker
 *
 * Displays career health metrics with improvement deltas and a chart-ready
 * history timeline. Three score rings (CHI, Skills, Job Match) sit at the
 * top; a table/grid of history snapshots renders below.
 *
 * Chart integration:
 *   history[] is passed as data-ready props to a recharts LineChart.
 *   The chart block is kept self-contained so recharts can be swapped.
 *
 * Design: dark v3 system — green (#4ade80) as accent for progress/health.
 */

import React, { CSSProperties } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { useProgressTracker }    from '@/hooks/useEngagement';
import { LoadingSpinner }        from '@/components/ui/LoadingSpinner';

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({
  label,
  value,
  delta,
  color,
  max = 100,
}: {
  label: string;
  value: number | undefined;
  delta: string | null | undefined;
  color: string;
  max?:  number;
}) {
  const score   = value ?? 0;
  const pct     = Math.min((score / max) * 100, 100);
  const radius  = 36;
  const circ    = 2 * Math.PI * radius;
  const offset  = circ - (pct / 100) * circ;

  const deltaPositive = delta && delta.startsWith('+');
  const deltaNeutral  = !delta || delta === '0';

  return (
    <div style={S.scoreRing}>
      <svg width={90} height={90} viewBox="0 0 90 90">
        {/* Track */}
        <circle cx={45} cy={45} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
        {/* Fill */}
        <circle
          cx={45} cy={45} r={radius} fill="none"
          stroke={color} strokeWidth={8}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 45 45)"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
        <text x={45} y={49} textAnchor="middle" fill="#f1f5f9" fontSize={16} fontWeight={700}>
          {score}
        </text>
      </svg>
      <div style={S.ringLabel}>{label}</div>
      {delta && (
        <div
          style={{
            ...S.deltaPill,
            color:      deltaPositive ? '#4ade80' : deltaNeutral ? '#94a3b8' : '#f87171',
            background: deltaPositive ? 'rgba(74,222,128,0.12)' : deltaNeutral ? 'rgba(148,163,184,0.10)' : 'rgba(248,113,113,0.12)',
            border:     `1px solid ${deltaPositive ? 'rgba(74,222,128,0.25)' : deltaNeutral ? 'rgba(148,163,184,0.15)' : 'rgba(248,113,113,0.25)'}`,
          }}
        >
          {delta}
        </div>
      )}
    </div>
  );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={S.tooltip}>
      <div style={S.tooltipDate}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ ...S.tooltipRow, color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CareerProgressPage() {
  const { progress, actions } = useProgressTracker();
  const report = progress.data;

  // Format history dates for the x-axis
  const chartData = (report?.history ?? []).map(h => ({
    date:  new Date(h.recorded_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    'CHI':         h.career_health_index,
    'Job Match':   h.job_match_score,
    'Skills':      h.skills_count,
  }));

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}><span style={S.titleIcon}>📊</span> Career Progress</h1>
          <p style={S.subtitle}>
            Track your career health over time — CHI score, skills growth, and job match quality.
          </p>
        </div>
        <button
          style={{ ...S.btn, ...(progress.loading ? S.btnDisabled : {}) }}
          disabled={progress.loading}
          onClick={() => actions.load()}
        >
          {progress.loading ? 'Loading…' : '↺ Refresh'}
        </button>
      </div>

      {/* Loading */}
      {progress.loading && !report && (
        <div style={S.centred}><LoadingSpinner /></div>
      )}

      {/* Error */}
      {progress.error && (
        <div style={S.errorBanner}>⚠ {progress.error}</div>
      )}

      {/* No data */}
      {!progress.loading && report && !report.has_data && (
        <div style={S.centred}>
          <p style={S.dimText}>No progress data yet. Complete your profile and upload a CV to start tracking.</p>
        </div>
      )}

      {/* Score rings */}
      {report?.current && (
        <div style={S.ringsRow}>
          <ScoreRing
            label="Career Health Index"
            value={report.current.career_health_index}
            delta={report.improvement?.career_health_index}
            color="#4ade80"
          />
          <ScoreRing
            label="Job Match Score"
            value={report.current.job_match_score}
            delta={report.improvement?.job_match_score}
            color="#3d65f6"
          />
          <ScoreRing
            label="Skills Count"
            value={report.current.skills_count}
            delta={report.improvement?.skills_count}
            color="#fbbf24"
            max={50}
          />
        </div>
      )}

      {/* Previous snapshot comparison */}
      {report?.previous && (
        <div style={S.compRow}>
          <div style={S.compLabel}>Previous snapshot</div>
          <div style={S.compValues}>
            <span>CHI: <strong>{report.previous.career_health_index}</strong></span>
            <span>Job Match: <strong>{report.previous.job_match_score}</strong></span>
            <span>Skills: <strong>{report.previous.skills_count}</strong></span>
            {report.previous.recorded_at && (
              <span style={{ color: '#475569' }}>
                {new Date(report.previous.recorded_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Chart */}
      {chartData.length > 1 && (
        <div style={S.chartCard}>
          <h2 style={S.sectionTitle}>Progress Over Time</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 11 }} />
              <YAxis tick={{ fill: '#475569', fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="CHI"       stroke="#4ade80" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Job Match" stroke="#3d65f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Skills"    stroke="#fbbf24" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div style={S.legend}>
            {[['#4ade80','CHI'],['#3d65f6','Job Match'],['#fbbf24','Skills']].map(([c,l]) => (
              <span key={l} style={S.legendItem}>
                <span style={{ ...S.legendDot, background: c }} />{l}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* History table */}
      {report && report.history.length > 0 && (
        <div style={S.historyCard}>
          <h2 style={S.sectionTitle}>Snapshot History</h2>
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead>
                <tr>
                  {['Date','CHI','Job Match','Skills','Trigger'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...report.history].reverse().map((row, i) => (
                  <tr key={i} style={i % 2 === 0 ? S.trEven : undefined}>
                    <td style={S.td}>{new Date(row.recorded_at).toLocaleDateString()}</td>
                    <td style={{ ...S.td, fontWeight: 600, color: '#4ade80' }}>{row.career_health_index}</td>
                    <td style={{ ...S.td, fontWeight: 600, color: '#3d65f6' }}>{row.job_match_score}</td>
                    <td style={{ ...S.td, fontWeight: 600, color: '#fbbf24' }}>{row.skills_count}</td>
                    <td style={{ ...S.td, color: '#64748b', fontSize: 11 }}>{row.trigger_event.replace(/_/g, ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S: Record<string, CSSProperties> = {
  page: { minHeight: '100vh', background: '#0a0f1e', padding: '32px 24px', color: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 28 },
  titleIcon: { marginRight: 8 },
  title: { fontSize: 26, fontWeight: 700, margin: 0, color: '#f1f5f9' },
  subtitle: { fontSize: 14, color: '#64748b', margin: '6px 0 0' },
  btn: { padding: '8px 16px', background: '#4ade80', color: '#0a0f1e', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  centred: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '60px 0' },
  dimText: { color: '#475569', fontSize: 14 },
  errorBanner: { background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', borderRadius: 8, padding: '12px 16px', marginBottom: 24, fontSize: 14 },
  // Rings
  ringsRow: { display: 'flex', gap: 32, flexWrap: 'wrap', marginBottom: 24 },
  scoreRing: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
  ringLabel: { fontSize: 11, color: '#64748b', textAlign: 'center', maxWidth: 90 },
  deltaPill: { padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 700 },
  // Comparison
  compRow: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, padding: '10px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 },
  compLabel: { fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 },
  compValues: { display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13, color: '#94a3b8' },
  // Chart
  chartCard: { background: '#111827', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '20px 24px', marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: 600, color: '#f1f5f9', margin: '0 0 16px' },
  legend: { display: 'flex', gap: 20, marginTop: 12 },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8' },
  legendDot: { width: 8, height: 8, borderRadius: '50%' },
  tooltip: { background: '#1e293b', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, padding: '10px 14px', fontSize: 13 },
  tooltipDate: { color: '#64748b', marginBottom: 6, fontSize: 11 },
  tooltipRow: { marginBottom: 2 },
  // Table
  historyCard: { background: '#111827', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '20px 24px' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '8px 12px', color: '#475569', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  td: { padding: '9px 12px', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  trEven: { background: 'rgba(255,255,255,0.015)' },
};
