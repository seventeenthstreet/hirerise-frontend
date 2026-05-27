/**
 * @file src/components/devtools/TimelineFilters.tsx
 * @description Filter controls for the Timeline Viewer.
 * Kept as a pure controlled component — all state lives in TimelineViewer.
 * Dev-only.
 */

import { memo } from 'react';
import type { ObservabilityEventType } from '@/lib/observability';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface TimelineFilterState {
  errorsOnly: boolean;
  slowOnly:   boolean;   // ← NEW: show only slow traces
  typeFilter: ObservabilityEventType | 'all';
  nameSearch: string;
}

export const DEFAULT_FILTERS: TimelineFilterState = {
  errorsOnly: false,
  slowOnly:   false,   // ← NEW
  typeFilter: 'all',
  nameSearch: '',
};

interface TimelineFiltersProps {
  filters: TimelineFilterState;
  totalEvents: number;
  visibleTraces: number;
  onChange: (next: TimelineFilterState) => void;
  onRefresh: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const TimelineFilters = memo(function TimelineFilters({
  filters,
  totalEvents,
  visibleTraces,
  onChange,
  onRefresh,
}: TimelineFiltersProps) {
  const set = <K extends keyof TimelineFilterState>(
    key: K,
    value: TimelineFilterState[K],
  ) => onChange({ ...filters, [key]: value });

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-slate-800/60 border-b border-slate-700/60">

      {/* ── Search ── */}
      <div className="relative flex-1 min-w-[140px] max-w-[260px]">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-[11px] pointer-events-none select-none">
          ⌕
        </span>
        <input
          type="text"
          placeholder="Filter by name or action…"
          value={filters.nameSearch}
          onChange={e => set('nameSearch', e.target.value)}
          className="w-full pl-6 pr-2 py-1 bg-slate-900/80 border border-slate-700 rounded text-[12px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500 font-mono"
        />
      </div>

      {/* ── Type dropdown ── */}
      <select
        value={filters.typeFilter}
        onChange={e =>
          set('typeFilter', e.target.value as TimelineFilterState['typeFilter'])
        }
        className="px-2 py-1 bg-slate-900/80 border border-slate-700 rounded text-[12px] text-slate-300 focus:outline-none focus:border-slate-500 font-mono cursor-pointer"
      >
        <option value="all">all types</option>
        <option value="ui">ui</option>
        <option value="api">api</option>
        <option value="error">error</option>
        <option value="system">system</option>
      </select>

      {/* ── Errors only toggle ── */}
      <button
        type="button"
        onClick={() => set('errorsOnly', !filters.errorsOnly)}
        className={[
          'flex items-center gap-1.5 px-2.5 py-1 rounded text-[12px] font-mono border transition-colors',
          filters.errorsOnly
            ? 'bg-red-900/50 border-red-700/70 text-red-300'
            : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:text-slate-200',
        ].join(' ')}
      >
        <span className={`text-[9px] ${filters.errorsOnly ? 'text-red-400' : 'text-slate-600'}`}>●</span>
        errors only
      </button>

      {/* ── Slow only toggle ── NEW */}
      <button
        type="button"
        onClick={() => set('slowOnly', !filters.slowOnly)}
        className={[
          'flex items-center gap-1.5 px-2.5 py-1 rounded text-[12px] font-mono border transition-colors',
          filters.slowOnly
            ? 'bg-yellow-900/50 border-yellow-700/70 text-yellow-300'
            : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:text-slate-200',
        ].join(' ')}
      >
        <span className={`text-[9px] ${filters.slowOnly ? 'text-yellow-400' : 'text-slate-600'}`}>●</span>
        slow only
      </button>

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── Stats ── */}
      <span className="text-[11px] text-slate-600 font-mono tabular-nums">
        {visibleTraces} traces · {totalEvents} events
      </span>

      {/* ── Refresh ── */}
      <button
        type="button"
        onClick={onRefresh}
        title="Re-read buffer"
        className="px-2 py-1 rounded text-[12px] font-mono text-slate-500 hover:text-slate-200 border border-slate-700 hover:border-slate-500 bg-slate-900/80 transition-colors"
      >
        ↻
      </button>
    </div>
  );
});