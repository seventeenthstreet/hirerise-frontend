/**
 * @file src/components/devtools/types.ts
 * @description Shared types for the devtools Timeline components.
 * Kept separate to avoid cross-file import cycles between
 * TimelinePanel ↔ TimelineViewer.
 */

import type { ObservabilityEvent } from '@/lib/observability';

export interface TraceGroup {
  traceId: string;          // 'untracked' for events without traceId
  events: ObservabilityEvent[];
  hasError: boolean;
  latestTimestamp: string;
  /** True for traces injected via file import — never from the live buffer. */
  imported?: boolean;
  /** True when trace duration exceeds SLOW_TRACE_THRESHOLD_MS. */
  isSlow?: boolean;
  /** Name of the event with the highest context.duration — the bottleneck step. */
  slowestEventName?: string | null;
  /** context.duration value of the bottleneck event, in ms. */
  maxDuration?: number;
  /** Unaccounted (idle) time: trace duration minus sum of known API durations, in ms. */
  gapMs?: number;
}