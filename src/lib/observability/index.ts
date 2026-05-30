/**
 * @file src/lib/observability/index.ts
 * @description Public surface for the Phase 3.5 observability layer.
 *
 * All consumers import from '@/lib/observability' — never from individual
 * files. This ensures import paths stay stable if the internal structure
 * changes, and makes the intended public API explicit.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUICK REFERENCE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * INITIALISATION (call once at app boot):
 *   initSilentErrorCapture()
 *
 * UI LAYER:
 *   const traceId = trackUserAction('ACTION_NAME', { ...context });
 *   trackNavigation('/dashboard', { from: '/login' });
 *
 * API LAYER:
 *   emitApiRequest(endpoint, traceId)
 *   emitApiSuccess(endpoint, traceId)
 *   emitApiError(endpoint, error, traceId)
 *   extractTraceId(meta)   ← read traceId from React Query meta
 *
 * ERROR BOUNDARY EXTENSION:
 *   emitErrorBoundaryEvent(error, errorId, context, traceId?)
 *
 * LOGGER (direct use — prefer the helpers above):
 *   logEvent(createEvent({ type, name, traceId, context }))
 *
 * DEBUG:
 *   getEventBuffer()        ← snapshot of the in-memory ring buffer
 *   window.__obs.printTimeline()  ← devtools console table
 */

// Types
export type { ObservabilityEvent, ObservabilityEventType, ObservabilityEventInput } from './types';

// Context
export { getSessionId, createTraceId, setActiveTraceId, getActiveTraceId } from './context';

// Core buffer + factory
export { createEvent, getEventBuffer, pushEvent } from './observability';

// Logger
export { logEvent, registerAdapter } from './logger';

// UI action tracking
export { trackUserAction, trackNavigation } from './actions';

// API instrumentation helpers
export { emitApiRequest, emitApiSuccess, emitApiError, extractTraceId } from './apiInstrumentation';

// Error boundary helper
export { emitErrorBoundaryEvent } from './errorBoundaryIntegration';

// Silent error capture (call once at boot)
export { initSilentErrorCapture } from './silentErrors';
