/**
 * @file src/components/devtools/TimelineViewer.tsx
 * @description Root developer-only observability timeline viewer.
 *
 * Reads the in-memory event buffer, groups by traceId, applies filters,
 * and renders a scrollable list of TracePanel cards.
 *
 * GUARD: renders nothing when process.env.NODE_ENV !== 'development'.
 * The entire component tree is tree-shaken in production builds.
 *
 * USAGE (e.g. in a layout or debug page):
 *   import { TimelineViewer } from '@/components/devtools/TimelineViewer';
 *   <TimelineViewer />          ← renders nothing in production
 *   <TimelineViewer autoRefreshMs={2000} defaultOpen={false} />
 */

'use client';

import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  memo,
} from 'react';
import { getEventBuffer } from '@/lib/observability';
import type { ObservabilityEvent } from '@/lib/observability';
import {
  TimelineFilters,
  DEFAULT_FILTERS,
} from './TimelineFilters';
import type { TimelineFilterState } from './TimelineFilters';
import { TimelinePanel } from './TimelinePanel';
import type { TraceGroup } from './TimelinePanel';

// ─────────────────────────────────────────────────────────────────────────────
// PERFORMANCE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Traces exceeding this duration (ms) are flagged isSlow. */
const SLOW_TRACE_THRESHOLD_MS = 1000;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safely reads context.duration from an event.
 * Returns 0 for missing, non-numeric, or NaN values — prevents NaN propagation.
 */
const getDuration = (e: ObservabilityEvent): number =>
  typeof e.context?.duration === 'number' ? e.context.duration : 0;

// ─────────────────────────────────────────────────────────────────────────────
// GROUPING + SORTING (pure, no side effects)
// ─────────────────────────────────────────────────────────────────────────────

function buildTraceGroups(events: ReadonlyArray<ObservabilityEvent>): TraceGroup[] {
  const map = new Map<string, ObservabilityEvent[]>();

  for (const event of events) {
    const key = event.traceId ?? 'untracked';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(event);
  }

  const groups: TraceGroup[] = [];

  for (const [traceId, evts] of map.entries()) {
    // ── Parse timestamps once per event (avoids repeated Date construction) ──
    const parsedEvents = evts.map(e => ({ ...e, _ts: Date.parse(e.timestamp) }));

    // Sort ascending by pre-parsed timestamp
    parsedEvents.sort((a, b) => a._ts - b._ts);

    const startMs = parsedEvents[0]._ts;
    const endMs   = parsedEvents[parsedEvents.length - 1]._ts;
    const durationMs = endMs - startMs;
    const isSlow  = durationMs > SLOW_TRACE_THRESHOLD_MS;

    // ── Gap (idle) time: unaccounted latency not covered by known API durations ─
    const totalApiTime = parsedEvents.reduce((sum, e) => {
      if (e.type !== 'api') return sum;
      return sum + getDuration(e);
    }, 0);
    // gapMs represents time not accounted for by API calls (UI / rendering / idle)
    const rawGap = durationMs - totalApiTime;
    const gapMs  = rawGap > 0 ? rawGap : 0;

    // ── Bottleneck: event with the highest context.duration ───────────────
    let maxDuration       = 0;
    let slowestEventName: string | null = null;

    for (const e of parsedEvents) {
      const d = getDuration(e);
      if (d > maxDuration) {
        maxDuration       = d;
        slowestEventName  = e.name;
      }
    }

    // Strip internal _ts field — it must not leak into the stored group
    const sorted = parsedEvents.map(({ _ts: _ignored, ...e }) => e as ObservabilityEvent);

    groups.push({
      traceId,
      events: sorted,
      hasError: sorted.some(e => e.level === 'error'),
      latestTimestamp: sorted[sorted.length - 1]?.timestamp ?? '',
      isSlow,
      slowestEventName: slowestEventName ?? null,
      maxDuration,
      gapMs,
    });
  }

  // Sort traces descending by their latest event timestamp
  groups.sort(
    (a, b) =>
      new Date(b.latestTimestamp).getTime() -
      new Date(a.latestTimestamp).getTime(),
  );

  return groups;
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTERING (pure, memoized in component)
// ─────────────────────────────────────────────────────────────────────────────

function applyFilters(
  groups: TraceGroup[],
  filters: TimelineFilterState,
): TraceGroup[] {
  const { errorsOnly, slowOnly, typeFilter, nameSearch } = filters;
  const needle = nameSearch.trim().toLowerCase();

  return groups
    .map(group => {
      // Trace-level gates — applied before touching events
      if (errorsOnly && !group.hasError) return null;
      if (slowOnly   && !group.isSlow)   return null;

      let evts: ObservabilityEvent[] = group.events;

      if (errorsOnly) {
        evts = evts.filter((e: ObservabilityEvent) => e.level === 'error');
      }

      if (typeFilter !== 'all') {
        evts = evts.filter((e: ObservabilityEvent) => e.type === typeFilter);
      }

      if (needle) {
        evts = evts.filter((e: ObservabilityEvent) =>
          e.name.toLowerCase().includes(needle) ||
          String(e.context?.action ?? '').toLowerCase().includes(needle),
        );
      }

      return evts.length > 0 ? { ...group, events: evts } : null;
    })
    .filter((g): g is TraceGroup => g !== null);
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

interface TimelineViewerProps {
  /** Auto-refresh interval in ms. 0 = disabled (manual only). Default: 0. */
  autoRefreshMs?: number;
  /** Whether the panel starts open. Default: true. */
  defaultOpen?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const TimelineViewerInner = memo(function TimelineViewerInner({
  autoRefreshMs = 0,
  defaultOpen = true,
}: TimelineViewerProps) {
  const [panelOpen, setPanelOpen]   = useState(defaultOpen);
  const [filters, setFilters]       = useState<TimelineFilterState>(DEFAULT_FILTERS);
  // Snapshot of the buffer — taken on mount and on every explicit refresh
  const [snapshot, setSnapshot]     = useState<ReadonlyArray<ObservabilityEvent>>(
    () => getEventBuffer(),
  );
  const intervalRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef     = useRef<HTMLDivElement>(null);
  // Tracks whether the user has manually scrolled down so auto-refresh
  // does not yank the list back to top while they're reading.
  const isUserScrolling  = useRef(false);
  const scrollResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Prevents auto-scroll firing on the very first render (mount snapshot read).
  const hasMounted       = useRef(false);
  // Timestamp of last programmatic scroll — throttles overlapping smooth animations.
  const lastScrollTime   = useRef(0);
  // Hidden file input for trace import
  const importRef        = useRef<HTMLInputElement>(null);

  // ── Import / replay state ────────────────────────────────────────────────
  // Each entry is the full events array from one imported trace file.
  const [importedTraces, setImportedTraces] = useState<ObservabilityEvent[][]>([]);
  // When true: hide live buffer and show only imported traces.
  const [replayMode, setReplayMode]         = useState(false);

  // ── Import handler ───────────────────────────────────────────────────────
  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);

          // Forward-compatibility: accept version-less exports (pre-v1); reject anything beyond v1
          if (data.version !== undefined && data.version !== 1) {
            console.warn('[TimelineViewer] Unsupported trace version:', data.version);
            return;
          }

          // Validate: must have traceId (string) and events (non-empty array)
          if (
            typeof data?.traceId !== 'string' ||
            !Array.isArray(data?.events) ||
            data.events.length === 0
          ) {
            console.warn('[TimelineViewer] Import ignored: invalid trace file structure.');
            return;
          }

          // Validate: each event must have the minimum required shape
          const isValidEvents =
            Array.isArray(data.events) &&
            data.events.length > 0 &&
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data.events.every((e: any) =>
              typeof e === 'object' &&
              e !== null &&
              typeof e.timestamp === 'string' &&
              typeof e.type === 'string' &&
              typeof e.name === 'string'
            );

          if (!isValidEvents) {
            console.warn('[TimelineViewer] Import ignored: malformed events');
            return;
          }

          // Defensive: re-assert traceId is a string immediately before duplicate detection,
          // guarding against future refactors that might reorder or bypass earlier checks.
          if (typeof data.traceId !== 'string') {
            console.warn('[TimelineViewer] Invalid traceId');
            return;
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const safeEvents = data.events.map((e: any) => ({ ...e })) as ObservabilityEvent[];

          setImportedTraces(prev => {
            const exists = prev.some(trace => {
              if (!trace.length) return false;
              return trace[0].traceId === data.traceId;
            });

            if (exists) {
              console.warn('[TimelineViewer] Trace already imported:', data.traceId);
              return prev;
            }

            return [...prev, safeEvents];
          });
        } catch {
          console.warn('[TimelineViewer] Import ignored: could not parse JSON.');
        } finally {
          // Reset so the same file can be re-imported if needed
          if (importRef.current) importRef.current.value = '';
        }
      };
      reader.readAsText(file);
    },
    [],
  );

  const refresh = useCallback(() => {
    const buffer = getEventBuffer();
    setSnapshot(buffer);

    const now       = Date.now();
    const container = containerRef.current;

    // IMPORTANT:
    // Use 'buffer' (not 'snapshot') for scroll decisions.
    // 'buffer' represents the latest event read from getEventBuffer(),
    // while 'snapshot' is React state and may lag by one render.
    const isAtTop = container ? container.scrollTop === 0 : true;

    if (
      hasMounted.current &&
      !isUserScrolling.current &&
      now - lastScrollTime.current > 800 &&
      container &&
      buffer.length > 0 &&
      !isAtTop
    ) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
      lastScrollTime.current = now;
    }

    hasMounted.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh + user-scroll tracking
  useEffect(() => {
    const container = containerRef.current;

    // Mark user as scrolling; clear flag 1 s after they stop
    function onScroll() {
      isUserScrolling.current = true;
      if (scrollResetTimer.current !== null) clearTimeout(scrollResetTimer.current);
      scrollResetTimer.current = setTimeout(() => {
        isUserScrolling.current = false;
      }, 1000);
    }

    container?.addEventListener('scroll', onScroll, { passive: true });

    if (autoRefreshMs > 0) {
      intervalRef.current = setInterval(refresh, autoRefreshMs);
    }

    return () => {
      container?.removeEventListener('scroll', onScroll);
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
      if (scrollResetTimer.current !== null) clearTimeout(scrollResetTimer.current);
    };
  }, [autoRefreshMs, refresh]);

  // ── Collect the traceIds that come from imported files ───────────────────
  // Built once per importedTraces change so buildTraceGroups can tag them.
  const importedTraceIds = useMemo<Set<string>>(() => {
    const ids = new Set<string>();
    for (const evts of importedTraces) {
      for (const e of evts) {
        if (e.traceId) ids.add(e.traceId);
      }
    }
    return ids;
  }, [importedTraces]);

  // Build trace groups — only recomputed when snapshot or imported traces change
  const allGroups = useMemo(() => {
    // replayMode: show only imported events; otherwise merge both sources
    const liveEvents   = replayMode ? [] : [...snapshot];
    const importEvents = importedTraces.flat();
    const merged       = [...liveEvents, ...importEvents];

    return buildTraceGroups(merged).map(group => ({
      ...group,
      imported: importedTraceIds.has(group.traceId),
    }));
  }, [snapshot, importedTraces, importedTraceIds, replayMode]);

  // Apply filters — only recomputed when groups or filters change
  const visibleGroups = useMemo(
    () => applyFilters(allGroups, filters),
    [allGroups, filters],
  );

  const totalEvents = useMemo(
    () => visibleGroups.reduce((sum, g) => sum + g.events.length, 0),
    [visibleGroups],
  );

  return (
    <div
      className="fixed bottom-0 right-0 z-[9999] w-[560px] max-h-[80vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-tl-xl shadow-2xl font-mono text-sm"
      role="region"
      aria-label="Observability Timeline (dev)"
    >
      {/* ── Title bar ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700/60 bg-slate-800/80 rounded-tl-xl">
        {/* Traffic-light style dots */}
        <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />

        <span className="flex-1 text-[11px] text-slate-400 uppercase tracking-widest ml-1 select-none">
          Observability Timeline
        </span>

        {autoRefreshMs > 0 && (
          <span className="text-[10px] text-slate-600 tabular-nums">
            ↻ {autoRefreshMs}ms
          </span>
        )}

        {/* ── Import / Replay controls ── */}

        {/* Hidden file input — triggered by "Import Trace" button */}
        <input
          ref={importRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={handleImport}
          aria-hidden="true"
        />

        {/* Import Trace button */}
        <button
          type="button"
          onClick={() => importRef.current?.click()}
          className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-600 text-slate-400 hover:text-slate-100 hover:border-slate-400 transition-colors shrink-0"
          title="Import a trace JSON file"
        >
          Import
        </button>

        {/* Replay Mode toggle — only visible when at least one trace is imported */}
        {importedTraces.length > 0 && (
          <button
            type="button"
            onClick={() => setReplayMode(p => !p)}
            className={[
              'text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors shrink-0',
              replayMode
                ? 'border-purple-500/60 bg-purple-900/30 text-purple-300'
                : 'border-slate-600 text-slate-400 hover:text-slate-100 hover:border-slate-400',
            ].join(' ')}
            title={replayMode ? 'Exit replay mode' : 'Show only imported traces'}
          >
            {replayMode ? 'Live ↩' : 'Replay'}
          </button>
        )}

        {/* Clear Imported — only visible when at least one trace is imported */}
        {importedTraces.length > 0 && (
          <button
            type="button"
            onClick={() => { setImportedTraces([]); setReplayMode(false); }}
            className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-600 text-slate-500 hover:text-red-300 hover:border-red-500/50 transition-colors shrink-0"
            title="Remove all imported traces"
          >
            Clear
          </button>
        )}

        <button
          type="button"
          onClick={() => setPanelOpen(p => !p)}
          className="text-[12px] text-slate-500 hover:text-slate-200 transition-colors px-1"
          aria-label={panelOpen ? 'Collapse panel' : 'Expand panel'}
        >
          {panelOpen ? '⌄' : '⌃'}
        </button>
      </div>

      {/* ── Body ── */}
      {panelOpen && (
        <>
          {/* Filter bar */}
          <TimelineFilters
            filters={filters}
            totalEvents={totalEvents}
            visibleTraces={visibleGroups.length}
            onChange={setFilters}
            onRefresh={refresh}
          />

          {/* Trace list */}
          <div ref={containerRef} className="overflow-y-auto flex-1 min-h-0 p-2 space-y-2">
            {visibleGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-600">
                <span className="text-3xl mb-2 opacity-40">◎</span>
                <span className="text-[12px]">
                  {replayMode
                    ? 'No imported traces. Click Import to load a trace file.'
                    : snapshot.length === 0
                    ? 'No events in buffer yet.'
                    : 'No events match current filters.'}
                </span>
              </div>
            ) : (
              visibleGroups.map(group => (
                <TimelinePanel key={group.traceId} group={group} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// DEV GUARD — production build exports a no-op
// ─────────────────────────────────────────────────────────────────────────────

export function TimelineViewer(props: TimelineViewerProps) {
  if (process.env.NODE_ENV !== 'development') return null;
  return <TimelineViewerInner {...props} />;
}