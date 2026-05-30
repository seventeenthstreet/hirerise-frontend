/**
 * @file src/lib/observability/errorBoundaryIntegration.ts
 * @description Bridge between the existing ErrorBoundary system and the
 * Phase 3.5 observability layer.
 *
 * DESIGN:
 *  The existing `ErrorBoundary` component is NOT modified. Instead, this
 *  module provides `emitErrorBoundaryEvent()` — a pure function that the
 *  ErrorBoundary can call from `componentDidCatch` to emit an observability
 *  event alongside its existing structured console log.
 *
 *  The existing `console.error('[ErrorBoundary]', {...})` output is preserved
 *  verbatim. The observability event is ADDITIVE — it carries the same data
 *  in the canonical `ObservabilityEvent` shape for timeline correlation.
 *
 * CORRELATION:
 *  - `errorId` (Date.now from getDerivedStateFromError) is threaded through.
 *  - `traceId` is optional — only present if the initiating user action
 *    called `trackUserAction()` and the component stored the returned traceId.
 *
 * USAGE (in ErrorBoundary.componentDidCatch — see MODIFIED FILES section):
 *
 *   import { emitErrorBoundaryEvent } from '@/lib/observability/errorBoundaryIntegration';
 *
 *   componentDidCatch(error: Error, info: ErrorInfo): void {
 *     // Existing log — UNCHANGED:
 *     console.error('[ErrorBoundary]', { errorId: this.state.errorId, ... });
 *     this.props.onError?.(error, info);
 *
 *     // NEW — additive observability emission:
 *     emitErrorBoundaryEvent(error, this.state.errorId, this.props.context);
 *   }
 */

import type { ErrorInfo } from 'react';
import { createEvent } from './observability';
import { logEvent } from './logger';

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Emits an `error:ERROR_BOUNDARY` observability event.
 *
 * Call from `ErrorBoundary.componentDidCatch` after the existing console.error
 * call. Pass the same data that the existing log uses so events correlate
 * by errorId.
 *
 * @param error     - The caught Error object.
 * @param errorId   - The errorId from state (Date.now() from getDerivedStateFromError).
 * @param context   - The boundary's `context` prop (e.g. "SkillsPriorityWidget").
 * @param traceId   - Optional trace ID if the originating action was tracked.
 * @param info      - Optional React ErrorInfo (componentStack).
 */
export function emitErrorBoundaryEvent(
  error: Error,
  errorId: number | null,
  context?: string,
  traceId?: string,
  info?: ErrorInfo,
): void {
  try {
    logEvent(createEvent({
      type:    'error',
      name:    'ERROR_BOUNDARY',
      level:   'error',
      traceId,
      ...(errorId !== null && errorId !== undefined && { errorId }),
      context: {
        boundaryContext:  context   ?? 'unknown',
        errorName:        error.name    ?? 'Error',
        errorMessage:     error.message ?? String(error),
        ...(info?.componentStack && {
          // Trim componentStack to the first 500 chars — the full stack is
          // already in the existing console.error output and would bloat the
          // event buffer unnecessarily.
          componentStack: info.componentStack.slice(0, 500),
        }),
      },
    }));
  } catch { /* never surface observability errors */ }
}
