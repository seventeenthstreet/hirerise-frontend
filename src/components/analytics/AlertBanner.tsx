

/**
 * @file components/analytics/AlertBanner.tsx
 * @description Pure UI component for surfacing product intelligence alerts.
 *
 * HARD RULES:
 *  - NO API calls
 *  - NO business logic — threshold evaluation lives in lib/alerts.ts
 *  - NO sorting or filtering — alerts[] arrives pre-sorted from the hook
 *  - ONLY props → render
 *  - Receives Alert[] directly from useMetrics() via the page layer
 *
 * Architecture position: UI layer (third tier)
 *   API → Hooks → UI → Pages → Guards → Context
 */

import type { Alert, AlertSeverity } from '@/lib/alerts';

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS  (inline — consistent with existing analytics components)
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<AlertSeverity, {
  border: string;
  bg:     string;
  icon:   string;
  label:  string;
  text:   string;
}> = {
  critical: {
    border: '#ef4444',
    bg:     'rgba(239,68,68,0.08)',
    icon:   '#ef4444',
    label:  '#ef4444',
    text:   '#fca5a5',
  },
  high: {
    border: '#f97316',
    bg:     'rgba(249,115,22,0.08)',
    icon:   '#f97316',
    label:  '#f97316',
    text:   '#fdba74',
  },
  medium: {
    border: '#f59e0b',
    bg:     'rgba(245,158,11,0.08)',
    icon:   '#f59e0b',
    label:  '#f59e0b',
    text:   '#fcd34d',
  },
  low: {
    border: '#3b82f6',
    bg:     'rgba(59,130,246,0.08)',
    icon:   '#3b82f6',
    label:  '#3b82f6',
    text:   '#93c5fd',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS  (pure, no state)
// ─────────────────────────────────────────────────────────────────────────────

function SeverityIcon({ severity }: { severity: AlertSeverity }) {
  const color = SEVERITY_STYLES[severity].icon;
  if (severity === 'critical' || severity === 'high') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden style={{ flexShrink: 0 }}>
        <path
          d="M8 1.5 L14.5 13 H1.5 Z"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill="none"
        />
        <path d="M8 6 L8 9.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="11.5" r="0.75" fill={color} />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.5" stroke={color} strokeWidth="1.5" />
      <path d="M8 5 L8 8.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="10.5" r="0.75" fill={color} />
    </svg>
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  const s = SEVERITY_STYLES[alert.severity];
  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        display:      'flex',
        alignItems:   'flex-start',
        gap:          10,
        padding:      '10px 14px',
        borderRadius: 8,
        background:   s.bg,
        border:       `1px solid ${s.border}`,
        borderLeft:   `3px solid ${s.border}`,
      }}
    >
      <span style={{ marginTop: 1, flexShrink: 0 }}>
        <SeverityIcon severity={alert.severity} />
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Severity badge */}
          <span style={{
            fontSize:      10,
            fontFamily:    'monospace',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight:    600,
            color:         s.label,
          }}>
            {alert.severity}
          </span>
          {/* Metric name */}
          <span style={{
            fontSize:   10,
            fontFamily: 'monospace',
            color:      '#4d6080',
          }}>
            {alert.metric}
          </span>
          {/* Current value */}
          {alert.value !== null && (
            <span style={{
              fontSize:   10,
              fontFamily: 'monospace',
              color:      '#4d6080',
            }}>
              {alert.value <= 1
                ? `${(alert.value * 100).toFixed(1)}%`
                : alert.value >= 1000
                  ? `${(alert.value / 1000).toFixed(1)}s`
                  : String(alert.value)
              }
            </span>
          )}
        </div>

        <p style={{
          margin:     '3px 0 0',
          fontSize:   13,
          color:      s.text,
          lineHeight: 1.45,
        }}>
          {alert.message}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ALERT BANNER  (exported component)
// ─────────────────────────────────────────────────────────────────────────────

export interface AlertBannerProps {
  /**
   * Pre-sorted alert array from useMetrics().alerts.
   * Already sorted critical → high → medium → low by evaluateAlerts().
   * Component renders them in the order received — no sorting here.
   */
  alerts: Alert[];
  /**
   * Maximum number of alerts to display before collapsing.
   * Defaults to 5. Remaining alerts are shown as a summary count.
   */
  maxVisible?: number;
}

/**
 * AlertBanner — pure component.
 *
 * Renders the alerts[] array returned by useMetrics().
 * No logic, no thresholds, no sorting — all handled by lib/alerts.ts and the hook.
 *
 * Usage in page.tsx:
 *   const { alerts } = useMetrics();
 *   <AlertBanner alerts={alerts} />
 */
export function AlertBanner({ alerts, maxVisible = 5 }: AlertBannerProps) {
  // Nothing to render
  if (!alerts.length) return null;

  const visible  = alerts.slice(0, maxVisible);
  const overflow = alerts.length - visible.length;

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const highCount     = alerts.filter(a => a.severity === 'high').length;

  return (
    <div
      aria-label={`${alerts.length} product intelligence alert${alerts.length !== 1 ? 's' : ''}`}
      style={{ display: 'flex', flexDirection: 'column', gap: 0 }}
    >
      {/* Header bar */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '10px 14px 8px',
        background:     '#111827',
        borderRadius:   '12px 12px 0 0',
        border:         '1px solid #1f2d45',
        borderBottom:   'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize:      11,
            fontFamily:    'monospace',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color:         criticalCount > 0 ? '#ef4444' : highCount > 0 ? '#f97316' : '#f59e0b',
            fontWeight:    600,
          }}>
            Alerts
          </span>
          <span style={{
            fontSize:      11,
            fontFamily:    'monospace',
            color:         '#4d6080',
          }}>
            {alerts.length} active
          </span>
        </div>

        {/* Severity summary chips */}
        <div style={{ display: 'flex', gap: 6 }}>
          {criticalCount > 0 && (
            <span style={{
              fontSize:      10,
              fontFamily:    'monospace',
              padding:       '2px 7px',
              borderRadius:  4,
              background:    'rgba(239,68,68,0.15)',
              color:         '#ef4444',
              border:        '1px solid rgba(239,68,68,0.3)',
            }}>
              {criticalCount} critical
            </span>
          )}
          {highCount > 0 && (
            <span style={{
              fontSize:      10,
              fontFamily:    'monospace',
              padding:       '2px 7px',
              borderRadius:  4,
              background:    'rgba(249,115,22,0.12)',
              color:         '#f97316',
              border:        '1px solid rgba(249,115,22,0.3)',
            }}>
              {highCount} high
            </span>
          )}
        </div>
      </div>

      {/* Alert rows */}
      <div style={{
        display:       'flex',
        flexDirection: 'column',
        gap:           4,
        padding:       '8px',
        background:    '#0e1420',
        border:        '1px solid #1f2d45',
        borderTop:     'none',
        borderRadius:  alerts.length > maxVisible ? 0 : '0 0 12px 12px',
      }}>
        {visible.map(alert => (
          <AlertRow key={alert.id} alert={alert} />
        ))}
      </div>

      {/* Overflow summary */}
      {overflow > 0 && (
        <div style={{
          padding:       '8px 14px',
          background:    '#0e1420',
          border:        '1px solid #1f2d45',
          borderTop:     '1px solid #1a2236',
          borderRadius:  '0 0 12px 12px',
          fontSize:      12,
          color:         '#4d6080',
          fontFamily:    'monospace',
          textAlign:     'center',
        }}>
          +{overflow} more alert{overflow !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
