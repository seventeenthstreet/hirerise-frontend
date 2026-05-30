/**
 * @file src/components/devtools/TimelinePanel.tsx
 * @description Renders one trace group — header card + event rows.
 * Accepts already-filtered events. Collapsible.
 * Dev-only.
 */

import { memo, useState } from 'react';
import type { TraceGroup } from './types';
import { TimelineEventRow } from './TimelineEventRow';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

// Re-export so existing imports of TraceGroup from './TimelinePanel' keep working
export type { TraceGroup } from './types';

interface TimelinePanelProps {
  group: TraceGroup;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function shortId(id: string): string {
  if (id === 'untracked') return 'untracked';
  return id.length > 12 ? `…${id.slice(-10)}` : id;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serialises a trace group to JSON and triggers a browser file download.
 * Pure, synchronous, no side effects on the original data.
 */
function exportTrace(group: TraceGroup): void {
  const payload = {
    version:    1,
    traceId:    group.traceId,
    exportedAt: new Date().toISOString(),
    events:     group.events,            // read-only snapshot copy via spread below
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href     = url;
  a.download = `trace-${group.traceId}.json`;
  a.click();

  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// PERFORMANCE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Must mirror the value in TimelineViewer — used only for display decisions. */
const _SLOW_TRACE_THRESHOLD_MS = 1000; // TODO: wire into filter UI

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const TimelinePanel = memo(function TimelinePanel({
  group,
}: TimelinePanelProps) {
  const [open, setOpen] = useState(true);

  const { traceId, events, hasError, imported, isSlow, slowestEventName, maxDuration, gapMs } = group;

  // UI-bound: slow trace with no API events — the bottleneck is frontend work
  const hasApi = events.some(e => e.type === 'api');

  // ── Performance metrics ────────────────────────────────────────────────
  // Trace duration: first → last event
  const start      = new Date(events[0].timestamp).getTime();
  const end        = new Date(events[events.length - 1].timestamp).getTime();
  const durationMs = end - start;

  // Average API latency across events that carry a numeric context.duration
  const apiEvents  = events.filter(e => e.type === 'api');
  const avgLatency =
    apiEvents.reduce(
      (sum, e) => sum + (typeof e.context?.duration === 'number' ? e.context.duration : 0),
      0,
    ) / (apiEvents.length || 1);

  // Compute offset + total span for proportional bar in each row
  const timestamps = events.map(e => new Date(e.timestamp).getTime());
  const minTs = Math.min(...timestamps);
  const maxTs = Math.max(...timestamps);
  const totalMs = maxTs - minTs;

  const statusColor = hasError
    ? 'text-red-400 border-red-700/60 bg-red-900/20'
    : 'text-emerald-400 border-emerald-800/50 bg-emerald-900/10';

  const dotColor = hasError ? 'bg-red-500' : 'bg-emerald-500';

  // Last event in the sorted-ascending list — quick-glance label in header
  const lastEvent = events[events.length - 1];

  // Card border priority: slow → yellow, imported → purple, error → red, normal → slate
  const cardBorder = isSlow
    ? 'border border-yellow-500/60 bg-yellow-950/20'
    : imported
    ? 'border border-purple-500/50 bg-purple-950/20'
    : hasError
    ? 'border border-red-500/60 bg-red-950/20'
    : 'border border-slate-700/60 bg-slate-800/30';

  return (
    <div className={`rounded-lg overflow-hidden transition-colors ${cardBorder}`}>

      {/* ── Header ── */}
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-700/30 transition-colors text-left"
        aria-expanded={open}
      >
        {/* Collapse chevron */}
        <span className="text-slate-600 text-[11px] shrink-0 select-none w-3">
          {open ? '▾' : '▸'}
        </span>

        {/* Status dot */}
        <span className={`shrink-0 w-2 h-2 rounded-full ${dotColor}`} />

        {/* Trace ID + last event label */}
        <span className="font-mono text-[12px] text-slate-300 flex-1 min-w-0 flex items-center gap-1.5 truncate">
          {traceId === 'untracked'
            ? <span className="italic text-slate-500">untracked</span>
            : shortId(traceId)
          }
          {lastEvent && (
            <span className="text-[11px] text-slate-500 truncate">
              → {lastEvent.name}
            </span>
          )}
        </span>

        {/* SLOW badge */}
        {isSlow && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-yellow-500/60 bg-yellow-900/30 text-yellow-300 shrink-0">
            SLOW
          </span>
        )}

        {/* Bottleneck label — slowest named step within this trace */}
        {slowestEventName && (maxDuration ?? 0) > 0 && (
          <span className="text-[11px] text-yellow-400 shrink-0 truncate max-w-[160px]" title={`Bottleneck: ${slowestEventName}`}>
            ⚑ {slowestEventName} ({maxDuration}ms)
          </span>
        )}

        {/* UI-bound label — slow trace with no API events */}
        {isSlow && !hasApi && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-orange-500/60 bg-orange-900/30 text-orange-300 shrink-0">
            UI-bound
          </span>
        )}

        {/* IMPORTED badge */}
        {imported && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-purple-500/50 bg-purple-900/30 text-purple-300 shrink-0">
            IMPORTED
          </span>
        )}

        {/* Event count */}
        <span className="text-[11px] text-slate-500 shrink-0 tabular-nums">
          {events.length} {events.length === 1 ? 'event' : 'events'}
        </span>

        {/* Trace duration */}
        {durationMs > 0 && (
          <span className={`text-[11px] shrink-0 tabular-nums ${isSlow ? 'text-yellow-400' : 'text-slate-500'}`}>
            {durationMs}ms
          </span>
        )}

        {/* Avg API latency — only shown when there are API events */}
        {apiEvents.length > 0 && (
          <span className="text-[11px] text-slate-600 shrink-0 tabular-nums">
            avg {Math.round(avgLatency)}ms
          </span>
        )}

        {/* Idle (gap) time — only shown when unaccounted latency exceeds 200 ms */}
        {(gapMs ?? 0) > 200 && (
          <span className="text-xs text-purple-400 ml-2 shrink-0 tabular-nums">
            idle: {gapMs}ms
          </span>
        )}

        {/* Status badge */}
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${statusColor}`}
        >
          {hasError ? 'error' : 'success'}
        </span>

        {/* Export button — stop propagation so it doesn't toggle collapse */}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); exportTrace(group); }}
          className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-600 text-slate-400 hover:text-slate-100 hover:border-slate-400 transition-colors shrink-0"
          title={`Export trace ${traceId}`}
        >
          Export
        </button>
      </button>

      {/* ── Event rows ── */}
      {open && (
        <div className="border-t border-slate-700/40 divide-y divide-slate-700/20">
          {events.map(event => (
            <TimelineEventRow
              key={event.eventId}
              event={event}
              offsetMs={new Date(event.timestamp).getTime() - minTs}
              totalMs={totalMs}
            />
          ))}
        </div>
      )}
    </div>
  );
});