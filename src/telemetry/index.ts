/**
 * src/telemetry/index.ts
 */
export { academicTelemetry, setTelemetrySink } from './academicTelemetry';
export type {
  TelemetryEventName,
  TelemetryEvent,
  RpcStartEvent,
  RpcSuccessEvent,
  RpcErrorEvent,
  RpcRetryEvent,
  OnboardingFunnelEvent,
  CacheInvalidationEvent,
} from './academicTelemetry';
