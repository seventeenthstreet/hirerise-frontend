/**
 * src/telemetry/academicTelemetry.ts
 *
 * TELEMETRY FOUNDATION — Academic Intelligence Platform (HARDENED)
 * ──────────────────────────────────────────────────────────────────
 * Architecture-ready telemetry layer. No external provider is wired yet.
 * All events are typed and routed through this module — swapping in
 * PostHog, Datadog, or OpenTelemetry is a single-file change.
 *
 * CHANGES FROM ORIGINAL (TL-01):
 *  The `rpcRetry` telemetry method and `RpcRetryEvent` type were already
 *  defined correctly. The gap was that they were never emitted at runtime
 *  because React Query's retry predicate function does not provide a callback
 *  hook for each retry attempt.
 *
 *  The gap cannot be fully closed in the Phase 3 orchestration layer alone —
 *  it requires a Phase 4 pattern. The fix here:
 *  1. Documents the gap clearly with an explanation of why it exists.
 *  2. Exposes `emitRetryTelemetry` (from rpcExecutor.ts) as the recommended
 *     wiring point for Phase 4 query error handlers.
 *  3. Notes the `useQuery` failureCount field as the source for attempt number.
 *
 * CAPTURES:
 *  - RPC latency (per function, with correlation ID)
 *  - RPC retries (typed — wiring instructions in TL-01 note below)
 *  - Onboarding step funnel events (start, save, advance, abandon)
 *  - Cache invalidation events (which key, triggered by which mutation)
 *  - Optimistic rollback events
 *
 * GOVERNANCE:
 *  ❌ No PII in any event payload (no names, emails, raw answers)
 *  ❌ No direct Supabase calls
 *  ✅ All events are append-only and additive-safe
 *
 * TL-01 — RETRY TELEMETRY WIRING NOTE:
 *  The `rpcRetry` event is correctly defined and ready. To wire it in Phase 4:
 *
 *    // In a query component that uses useStudentAcademicProfile or similar:
 *    const { data, failureCount } = useStudentAcademicProfile(userId);
 *
 *    // Emit retry event when failureCount increments (using a ref to detect change):
 *    const prevFailureCount = useRef(0);
 *    useEffect(() => {
 *      if (failureCount > prevFailureCount.current) {
 *        emitRetryTelemetry('fn_get_student_full_profile', correlationId, failureCount);
 *        prevFailureCount.current = failureCount;
 *      }
 *    }, [failureCount]);
 *
 *  `emitRetryTelemetry` is exported from hooks/utils/rpcExecutor.ts.
 *  The correlationId can be threaded from the rpcStart event via a ref or context.
 */

import type { CorrelationId } from '../hooks/types/rpcEnvelope.types';

// ─────────────────────────────────────────────────────────────────────────────
// EVENT CATALOG
// ─────────────────────────────────────────────────────────────────────────────

export type TelemetryEventName =
  // RPC lifecycle
  | 'academic.rpc.start'
  | 'academic.rpc.success'
  | 'academic.rpc.error'
  | 'academic.rpc.retry'
  // Onboarding funnel
  | 'academic.onboarding.profile_create.start'
  | 'academic.onboarding.profile_create.success'
  | 'academic.onboarding.profile_create.error'
  | 'academic.onboarding.subjects_save.start'
  | 'academic.onboarding.subjects_save.success'
  | 'academic.onboarding.subjects_save.error'
  | 'academic.onboarding.languages_save.start'
  | 'academic.onboarding.languages_save.success'
  | 'academic.onboarding.languages_save.error'
  | 'academic.onboarding.complete.start'
  | 'academic.onboarding.complete.success'
  | 'academic.onboarding.complete.error'
  | 'academic.onboarding.abandon'
  // Cache
  | 'academic.cache.invalidate'
  | 'academic.cache.optimistic_rollback';

// ─────────────────────────────────────────────────────────────────────────────
// EVENT SHAPES
// ─────────────────────────────────────────────────────────────────────────────

export interface TelemetryBaseEvent {
  event: TelemetryEventName;
  correlationId: CorrelationId;
  timestamp: number;
}

export interface RpcStartEvent extends TelemetryBaseEvent {
  event: 'academic.rpc.start';
  rpcName: string;
  params?: Record<string, unknown>;
}

export interface RpcSuccessEvent extends TelemetryBaseEvent {
  event: 'academic.rpc.success';
  rpcName: string;
  latencyMs: number;
}

export interface RpcErrorEvent extends TelemetryBaseEvent {
  event: 'academic.rpc.error';
  rpcName: string;
  latencyMs: number;
  errorCode?: string;
  isRetryable: boolean;
}

/**
 * Emitted on each retry attempt.
 *
 * TL-01: This event is defined and typed correctly. It is NOT currently emitted
 * automatically — see the TL-01 wiring note at the top of this file for how to
 * wire it in Phase 4 component-level useEffect hooks.
 */
export interface RpcRetryEvent extends TelemetryBaseEvent {
  event: 'academic.rpc.retry';
  rpcName: string;
  /** 1-indexed retry attempt number (1 = first retry after initial failure). */
  attemptNumber: number;
}

export interface OnboardingFunnelEvent extends TelemetryBaseEvent {
  event: Extract<
    TelemetryEventName,
    | 'academic.onboarding.profile_create.start'
    | 'academic.onboarding.profile_create.success'
    | 'academic.onboarding.profile_create.error'
    | 'academic.onboarding.subjects_save.start'
    | 'academic.onboarding.subjects_save.success'
    | 'academic.onboarding.subjects_save.error'
    | 'academic.onboarding.languages_save.start'
    | 'academic.onboarding.languages_save.success'
    | 'academic.onboarding.languages_save.error'
    | 'academic.onboarding.complete.start'
    | 'academic.onboarding.complete.success'
    | 'academic.onboarding.complete.error'
    | 'academic.onboarding.abandon'
  >;
  /** sanitised — no PII */
  meta?: Record<string, unknown>;
}

export interface CacheInvalidationEvent extends TelemetryBaseEvent {
  event: 'academic.cache.invalidate' | 'academic.cache.optimistic_rollback';
  cacheScope: string;
  triggeredBy: string;
}

export type TelemetryEvent =
  | RpcStartEvent
  | RpcSuccessEvent
  | RpcErrorEvent
  | RpcRetryEvent
  | OnboardingFunnelEvent
  | CacheInvalidationEvent;

// ─────────────────────────────────────────────────────────────────────────────
// TELEMETRY SINK INTERFACE
// Swap the implementation below to wire a real provider.
// ─────────────────────────────────────────────────────────────────────────────

export interface TelemetrySink {
  capture(event: TelemetryEvent): void;
}

/**
 * Default sink — writes to console in development, no-ops in production.
 * Replace with a real sink (PostHog, Datadog, OTLP) without changing callers.
 */
const consoleSink: TelemetrySink = {
  capture(event: TelemetryEvent): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[academic:telemetry]', event.event, event);
    }
  },
};

let _sink: TelemetrySink = consoleSink;

/** Replace the telemetry sink at runtime (e.g. after user consent is obtained). */
export function setTelemetrySink(sink: TelemetrySink): void {
  _sink = sink;
}

/** Retrieve the active telemetry sink (primarily for testing). */
export function getTelemetrySink(): TelemetrySink {
  return _sink;
}

// ─────────────────────────────────────────────────────────────────────────────
// CAPTURE HELPERS — called by the API layer and mutation hooks
// ─────────────────────────────────────────────────────────────────────────────

export const academicTelemetry = {

  rpcStart(rpcName: string, correlationId: CorrelationId, params?: Record<string, unknown>): void {
    _sink.capture({
      event: 'academic.rpc.start',
      correlationId,
      timestamp: Date.now(),
      rpcName,
      params,
    });
  },

  rpcSuccess(rpcName: string, correlationId: CorrelationId, latencyMs: number): void {
    _sink.capture({
      event: 'academic.rpc.success',
      correlationId,
      timestamp: Date.now(),
      rpcName,
      latencyMs,
    });
  },

  rpcError(
    rpcName: string,
    correlationId: CorrelationId,
    latencyMs: number,
    opts: { errorCode?: string; isRetryable: boolean },
  ): void {
    _sink.capture({
      event: 'academic.rpc.error',
      correlationId,
      timestamp: Date.now(),
      rpcName,
      latencyMs,
      ...opts,
    });
  },

  /**
   * Emits a retry telemetry event.
   *
   * TL-01: Call this from Phase 4 component useEffect hooks when `failureCount`
   * from a `useQuery` return value increments. See the TL-01 wiring note at the
   * top of this file. Also accessible via `emitRetryTelemetry` in rpcExecutor.ts.
   */
  rpcRetry(rpcName: string, correlationId: CorrelationId, attemptNumber: number): void {
    _sink.capture({
      event: 'academic.rpc.retry',
      correlationId,
      timestamp: Date.now(),
      rpcName,
      attemptNumber,
    });
  },

  onboarding(
    event: OnboardingFunnelEvent['event'],
    correlationId: CorrelationId,
    meta?: Record<string, unknown>,
  ): void {
    _sink.capture({ event, correlationId, timestamp: Date.now(), meta });
  },

  cacheInvalidate(cacheScope: string, triggeredBy: string, correlationId: CorrelationId): void {
    _sink.capture({
      event: 'academic.cache.invalidate',
      correlationId,
      timestamp: Date.now(),
      cacheScope,
      triggeredBy,
    });
  },

  optimisticRollback(
    cacheScope: string,
    triggeredBy: string,
    correlationId: CorrelationId,
  ): void {
    _sink.capture({
      event: 'academic.cache.optimistic_rollback',
      correlationId,
      timestamp: Date.now(),
      cacheScope,
      triggeredBy,
    });
  },
} as const;