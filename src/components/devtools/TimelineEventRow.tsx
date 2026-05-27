/**
 * @file src/components/devtools/TimelineEventRow.tsx
 * @description Single event row with expandable JSON context.
 * Dev-only — never imported in production paths.
 */

import { memo, useState } from 'react';
import type { ObservabilityEvent } from '@/lib/observability';

// ─────────────────────────────────────────────────────────────────────────────
// PERFORMANCE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** API events with context.duration above this value are flagged as slow. */
const SLOW_API_THRESHOLD_MS = 500;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Format ISO timestamp → HH:mm:ss.ms */
function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// LEVEL BADGE
// ─────────────────────────────────────────────────────────────────────────────

const LEVEL_STYLES: Record<ObservabilityEvent['level'], string> = {
  info:  'bg-sky-900/60 text-sky-300 border border-sky-700/50',
  warn:  'bg-amber-900/60 text-amber-300 border border-amber-700/50',
  error: 'bg-red-900/60 text-red-300 border border-red-700/50',
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPE BADGE
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_STYLES: Record<string, string> = {
  ui:     'text-violet-400',
  api:    'text-cyan-400',
  error:  'text-red-400',
  system: 'text-slate-400',
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface TimelineEventRowProps {
  event: ObservabilityEvent;
  /** Visual offset from trace start in ms — for the timeline bar */
  offsetMs: number;
  /** Total trace duration in ms — for proportional width */
  totalMs: number;
}

export const TimelineEventRow = memo(function TimelineEventRow({
  event,
  offsetMs,
  totalMs,
}: TimelineEventRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasContext = event.context && Object.keys(event.context).length > 0;

  // API latency from context.duration (already tracked in Phase 3.5)
  const apiDuration =
    typeof event.context?.duration === 'number'
      ? event.context.duration
      : null;

  const isSlowApi =
    event.type === 'api' &&
    apiDuration !== null &&
    apiDuration > SLOW_API_THRESHOLD_MS;

  const durationLabel = apiDuration !== null ? `${apiDuration}ms` : null;

  // Proportional left offset for the timeline dot (clamped 0–95%)
  const dotLeft =
    totalMs > 0 ? Math.min(95, Math.round((offsetMs / totalMs) * 100)) : 0;

  // Heatmap: slow API events get a larger dot for instant visual weight
  const dotSize = isSlowApi ? 'w-2.5 h-2.5' : 'w-1.5 h-1.5';

  const typeClass = TYPE_STYLES[event.type] ?? 'text-slate-400';
  const levelClass = LEVEL_STYLES[event.level] ?? LEVEL_STYLES.info;

  return (
    <div className="group">
      {/* ── Main row ── */}
      <button
        type="button"
        onClick={() => hasContext && setExpanded(p => !p)}
        className={[
          'w-full text-left px-3 py-2 flex items-start gap-3 rounded',
          'transition-colors duration-100',
          hasContext
            ? 'cursor-pointer hover:bg-slate-700/40'
            : 'cursor-default',
        ].join(' ')}
        aria-expanded={hasContext ? expanded : undefined}
      >
        {/* Timestamp */}
        <span className="font-mono text-[11px] text-slate-500 shrink-0 w-[88px] pt-px">
          {formatTime(event.timestamp)}
        </span>

        {/* Type */}
        <span className={`font-mono text-[11px] uppercase tracking-wider shrink-0 w-14 pt-px ${typeClass}`}>
          {event.type}
        </span>

        {/* Name — highlighted yellow when slow API */}
        <span className={`font-mono text-[12px] flex-1 min-w-0 truncate ${isSlowApi ? 'text-yellow-300' : 'text-slate-200'}`}>
          {event.name}
        </span>

        {/* API latency — highlighted when slow */}
        {durationLabel && (
          <span className={`text-[11px] shrink-0 tabular-nums ${isSlowApi ? 'text-yellow-400' : 'text-slate-500'}`}>
            {durationLabel}
          </span>
        )}

        {/* Level badge */}
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${levelClass}`}>
          {event.level}
        </span>

        {/* Expand indicator */}
        {hasContext && (
          <span className="text-[10px] text-slate-600 shrink-0 pt-px select-none">
            {expanded ? '▾' : '▸'}
          </span>
        )}
      </button>

      {/* Timeline bar row */}
      <div className="relative h-1 mx-3 mb-1">
        <div className="absolute inset-y-0 left-0 right-0 bg-slate-800/50 rounded-full" />
        <div
          className={[
            // Heatmap sizing: slow API dots are larger
            `absolute top-1/2 -translate-y-1/2 rounded-full -translate-x-1/2 ${dotSize}`,
            isSlowApi
              ? 'bg-yellow-400'
              : event.level === 'error'
              ? 'bg-red-500'
              : event.level === 'warn'
              ? 'bg-amber-500'
              : event.type === 'ui'
              ? 'bg-violet-500'
              : event.type === 'api'
              ? 'bg-cyan-500'
              : 'bg-slate-500',
          ].join(' ')}
          style={{ left: `${dotLeft}%` }}
        />
      </div>

      {/* ── Expanded context ── */}
      {expanded && hasContext && (
        <div className="mx-3 mb-2 px-3 py-2 bg-slate-900 rounded border border-slate-700/60">
          <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap break-all leading-relaxed">
            {JSON.stringify(event.context, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
});