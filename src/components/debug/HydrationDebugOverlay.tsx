/**
 * @file src/components/debug/HydrationDebugOverlay.tsx
 *
 * PHASE 10 — Hydration Performance Metrics + Dev Diagnostics Overlay
 *
 * USAGE
 * ─────
 * Render in the root layout inside a NODE_ENV guard:
 *
 *   {process.env.NODE_ENV !== 'production' && (
 *     <HydrationDebugOverlay />
 *   )}
 *
 * Or expose via a keyboard shortcut in production for internal users:
 *
 *   const [show, setShow] = useState(false);
 *   useEffect(() => {
 *     const fn = (e: KeyboardEvent) =>
 *       e.ctrlKey && e.shiftKey && e.key === 'D' && setShow(p => !p);
 *     window.addEventListener('keydown', fn);
 *     return () => window.removeEventListener('keydown', fn);
 *   }, []);
 *   {show && <HydrationDebugOverlay />}
 *
 * WHAT IT SHOWS
 * ─────────────
 * - isHydrated / isError / user.id
 * - sessionId / currentFlowId
 * - Last 10 observability events (ring buffer)
 * - Telemetry counters (login success/failure, token refreshes, etc.)
 * - Hydration latency stats (avg, p95)
 *
 * PRODUCTION SAFETY
 * ─────────────────
 * This component is designed to be tree-shaken in production builds when
 * wrapped in a NODE_ENV guard. No sensitive data is rendered — userId is
 * shown in truncated form, no tokens, no PII.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext }         from '@/context/AppContext';
import { getEventBuffer }        from '@/lib/observability';
import { getTelemetrySnapshot }  from '@/lib/observability/authLogger';
import type { ObservabilityEvent } from '@/lib/observability';

const OVERLAY_STYLE: React.CSSProperties = {
  position:       'fixed',
  bottom:         '1rem',
  right:          '1rem',
  zIndex:         9999,
  background:     'rgba(15, 15, 30, 0.92)',
  color:          '#e2e8f0',
  borderRadius:   '12px',
  padding:        '1rem 1.25rem',
  fontFamily:     '"JetBrains Mono", "Fira Code", monospace',
  fontSize:       '11px',
  lineHeight:     1.5,
  maxWidth:       '480px',
  maxHeight:      '80vh',
  overflowY:      'auto',
  boxShadow:      '0 8px 32px rgba(0,0,0,0.6)',
  backdropFilter: 'blur(8px)',
  border:         '1px solid rgba(99,102,241,0.4)',
};

const BADGE: React.CSSProperties = {
  display:      'inline-block',
  padding:      '1px 6px',
  borderRadius: '4px',
  fontSize:     '10px',
  fontWeight:   700,
  marginLeft:   '4px',
};

function StatusBadge({ value }: { value: boolean }) {
  return (
    <span style={{ ...BADGE, background: value ? '#16a34a' : '#dc2626', color: '#fff' }}>
      {value ? 'YES' : 'NO'}
    </span>
  );
}

function levelColor(level: string): string {
  return level === 'error' ? '#f87171' : level === 'warn' ? '#fbbf24' : '#86efac';
}

export function HydrationDebugOverlay() {
  const { user, isHydrated, isError, sessionId, currentFlowId } = useAppContext();
  const [events,    setEvents]    = useState<ObservabilityEvent[]>([]);
  const [telemetry, setTelemetry] = useState(() => getTelemetrySnapshot());
  const [collapsed, setCollapsed] = useState(false);

  const refresh = useCallback(() => {
    const buf = getEventBuffer();
    // Show last 10 events, newest first
    setEvents([...buf].reverse().slice(0, 10));
    setTelemetry(getTelemetrySnapshot());
  }, []);

  useEffect(() => {
    // Debug-only hydration monitor: refresh() reads from the observability
    // ring buffer and telemetry snapshot, then calls setEvents/setTelemetry
    // to drive the overlay UI. State updates are intentional — this component
    // exists solely to display live-updating debug state. The initial call
    // populates the overlay immediately; the interval keeps it current.
    // A refactor (e.g. storing in a ref) would defeat the rendering purpose.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    const id = setInterval(refresh, 1_500);
    return () => clearInterval(id);
  }, [refresh]);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        style={{
          position: 'fixed', bottom: '1rem', right: '1rem', zIndex: 9999,
          background: 'rgba(99,102,241,0.9)', color: '#fff', border: 'none',
          borderRadius: '8px', padding: '0.5rem 1rem', fontSize: '11px',
          fontWeight: 700, cursor: 'pointer',
        }}
      >
        🔍 OBS
      </button>
    );
  }

  return (
    <div style={OVERLAY_STYLE}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontWeight: 700, color: '#a5b4fc', fontSize: '12px' }}>
          🔭 HireRise Observability
        </span>
        <button
          onClick={() => setCollapsed(true)}
          style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '14px' }}
        >
          ✕
        </button>
      </div>

      {/* Auth State */}
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
          Auth State
        </div>
        <div>isHydrated <StatusBadge value={isHydrated} /></div>
        <div>isError    <StatusBadge value={isError} /></div>
        <div>user       <span style={{ color: user ? '#86efac' : '#f87171' }}>
          {user ? `✓ ${user.id?.slice(0, 8)}…` : '✗ null'}
        </span></div>
        {sessionId && <div style={{ color: '#64748b' }}>session  {sessionId.slice(0, 18)}…</div>}
        {currentFlowId && <div style={{ color: '#a78bfa' }}>flow     {currentFlowId}</div>}
      </div>

      {/* Telemetry */}
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
          Telemetry
        </div>
        <div>loginOK     <span style={{ color: '#86efac' }}>{telemetry.loginSuccess}</span></div>
        <div>loginFail   <span style={{ color: '#f87171' }}>{telemetry.loginFailure}</span></div>
        <div>tokenRefresh <span style={{ color: '#fbbf24' }}>{telemetry.tokenRefreshCount}</span></div>
        <div>bootstrapFail <span style={{ color: '#f87171' }}>{telemetry.bootstrapFailures}</span></div>
        {telemetry.avgHydrationMs !== null && (
          <div>
            hydration avg <span style={{ color: '#86efac' }}>{telemetry.avgHydrationMs}ms</span>
            {telemetry.p95HydrationMs !== null && (
              <> p95 <span style={{ color: '#fbbf24' }}>{telemetry.p95HydrationMs}ms</span></>
            )}
          </div>
        )}
      </div>

      {/* Event Timeline */}
      <div>
        <div style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
          Recent Events (last 10)
        </div>
        {events.length === 0 && <div style={{ color: '#475569' }}>—</div>}
        {events.map((ev) => (
          <div key={ev.eventId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '2px', marginBottom: '2px' }}>
            <span style={{ color: levelColor(ev.level) }}>
              {ev.level === 'error' ? '✗' : ev.level === 'warn' ? '⚠' : '·'}
            </span>{' '}
            <span style={{ color: '#e2e8f0' }}>{ev.name}</span>
            <span style={{ color: '#475569', marginLeft: '4px' }}>
              {new Date(ev.timestamp).toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            {ev.context?.durationMs !== undefined && (
              <span style={{ color: '#64748b', marginLeft: '4px' }}>
                {ev.context.durationMs as number}ms
              </span>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: '0.5rem', textAlign: 'right' }}>
        <button
          onClick={refresh}
          style={{
            background: 'transparent', border: '1px solid #334155',
            color: '#64748b', borderRadius: '4px', padding: '2px 8px',
            fontSize: '10px', cursor: 'pointer',
          }}
        >
          refresh
        </button>
      </div>
    </div>
  );
}