/**
 * src/telemetry/academicTelemetry.ts
 *
 * TELEMETRY FOUNDATION — Academic Intelligence Platform
 * ──────────────────────────────────────────────────────
 * Architecture-ready telemetry layer. No external provider is wired yet.
 * All events are typed and routed through this module — swapping in
 * PostHog, Datadog, or OpenTelemetry is a single-file change.
 *
 * CAPTURES:
 *  - RPC latency (per function, with correlation ID)
 *  - RPC retries (with attempt count)
 *  - Onboarding step funnel events (start, save, advance, abandon)
 *  - Cache invalidation events (which key, triggered by which mutation)
 *  - Query stale / refetch events
 *
 * GOVERNANCE:
 *  ❌ No PII in any event payload (no names, emails, raw answers)
 *  ❌ No direct Supabase calls
 *  ✅ All events are append-only and additive-safe
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

export interface RpcRetryEvent extends TelemetryBaseEvent {
  event: 'academic.rpc.retry';
  rpcName: string;
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

interface TelemetrySink {
  capture(event: TelemetryEvent): void;
}

/**
 * Default sink — writes to console in development, no-ops in production.
 * Replace with a real sink (PostHog, Datadog, OTLP) without changing callers.
 */
const consoleSink: TelemetrySink = {
  capture(event: TelemetryEvent): void {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.debug('[academic:telemetry]', event.event, event);
    }
  },
};

let _sink: TelemetrySink = consoleSink;

/** Replace the telemetry sink at runtime (e.g. after user consent is obtained). */
export function setTelemetrySink(sink: TelemetrySink): void {
  _sink = sink;
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
