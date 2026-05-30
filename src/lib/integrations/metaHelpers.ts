/**
 * @file lib/integrations/metaHelpers.ts
 * @description Internal helpers for inspecting _meta state inside the adapter layer.
 *
 * SCOPE (NON-NEGOTIABLE):
 *  - These helpers are consumed ONLY by metricsAdapter.ts and its siblings.
 *  - They must NEVER be imported by hooks, UI components, or pages.
 *  - They never appear in any public return type or API response.
 *  - _meta itself never leaves the adapter; these helpers operate on it in-place.
 *
 * PURPOSE:
 *  The adapter now carries `_meta.mode` ('single' | 'hybrid' | 'mock').
 *  These helpers centralise the mode-inspection logic so that:
 *    1. logIntegrationHealth can vary its output by mode (richer observability).
 *    2. Future alerting can consult shouldSuppressAlerts() with no call-site churn.
 *    3. Dev-only debug branches have consistent, readable guard clauses.
 *
 * FUTURE INTEGRATION (Part 2 — Alert Delivery):
 *  shouldSuppressAlerts() is the designed entry point. When the alert system is
 *  wired in Part 2, it will call this helper instead of containing its own
 *  mode-inspection logic. No other files need to change.
 */

import type { MetricsMeta } from '@/types/internal/mappedMetrics';

// ─────────────────────────────────────────────────────────────────────────────
// MODE PREDICATES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true when _meta describes a mock-mode result.
 *
 * Mock results are synthetic and intentionally partial. They should:
 *  - be logged at a lower priority (or skipped) to avoid polluting dashboards
 *  - never trigger production alerts
 *  - be visually distinguishable in dev tooling
 *
 * @internal
 */
export function isMockMode(meta: MetricsMeta): boolean {
  return meta.mode === 'mock';
}

/**
 * Returns true when _meta describes a hybrid-mode result (both sources attempted).
 *
 * Hybrid partial states (one source down) are the most actionable failure mode:
 *  - data quality is degraded but not absent
 *  - the failing source name is in meta.sources
 *  - these warrant a warning log and, in Part 2, a suppressed (not silenced) alert
 *
 * @internal
 */
export function isHybridMode(meta: MetricsMeta): boolean {
  return meta.mode === 'hybrid';
}

/**
 * Returns true when _meta describes a single-source mode result.
 *
 * Single-source partial means the sole configured source failed entirely,
 * so the system is running on safe defaults. This is more severe than a
 * hybrid partial and warrants a higher-priority log entry.
 *
 * @internal
 */
export function isSingleMode(meta: MetricsMeta): boolean {
  return meta.mode === 'single';
}

// ─────────────────────────────────────────────────────────────────────────────
// ALERT SUPPRESSION PLACEHOLDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if alerts derived from this _meta should be suppressed.
 *
 * CURRENT BEHAVIOUR:
 *   Suppresses alerts only when mode === 'mock'. Mock data is synthetic;
 *   firing production alerts on it would be noise.
 *
 * FUTURE BEHAVIOUR (Part 2 — Alert Delivery):
 *   Additional conditions can be layered here without changing any call-site:
 *   - suppress during known maintenance windows (flag-gated)
 *   - suppress low-severity hybrid partials below a threshold
 *   - suppress when a circuit-breaker is open
 *
 * This function is the designated integration point. The alert system in
 * Part 2 will call shouldSuppressAlerts(meta) and honour the result.
 * No hooks, UI, or API files need to know this function exists.
 *
 * @param meta - The _meta object from a resolved MappedMetrics.
 * @returns    true → alert should be suppressed; false → alert may fire.
 *
 * @internal
 */
export function shouldSuppressAlerts(meta: MetricsMeta): boolean {
  // Mock mode: synthetic data — never alert on it.
  if (isMockMode(meta)) return true;

  // All other modes (single, hybrid — whether partial or not) may produce alerts.
  // Part 2 will add conditions above this line before the final return.
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// ALERT POLICY — forward-compatible typed alternative to suppress_alerts bool
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Typed alert policy discriminant.
 *
 * WHY does AlertPolicy exist alongside suppress_alerts (boolean)?
 *   suppress_alerts is a boolean that was shipped in the analytics payload
 *   schema (EventMap['metrics.integration.health']). Renaming or removing it
 *   would break existing dashboard queries, alert rules, and data pipelines
 *   that filter on suppress_alerts === true. It MUST stay in the payload.
 *
 *   AlertPolicy is the forward-compatible replacement that future engineers
 *   should extend. Adding new states ('throttle', 'escalate', 'silent') is
 *   a non-breaking additive change to this union type — it requires no
 *   changes to call sites or existing boolean consumers. A boolean can never
 *   express a third state without breaking callers.
 *
 *   The mapping is intentionally 1:1 today:
 *     'suppress' ↔ suppress_alerts === true
 *     'allow'    ↔ suppress_alerts === false
 *
 *   When Part 2 adds new states, extend this union and update getAlertPolicy.
 *   suppress_alerts remains in the payload permanently for backward compat.
 *
 * @internal — never forwarded to UI, hooks, or API responses.
 */
export type AlertPolicy = 'suppress' | 'allow';

/**
 * Derives a typed AlertPolicy from _meta.
 *
 * This is the forward-compatible alternative to reading suppress_alerts directly.
 * Internal analytics consumers (metricsAdapter, logIntegrationHealth) should
 * prefer this function over shouldSuppressAlerts() for new code paths.
 *
 * CURRENT MAPPING:
 *   mock  → 'suppress'  (synthetic data — never alert)
 *   other → 'allow'     (single, hybrid — alerts may fire)
 *
 * TO EXTEND: add cases above the final return. Do NOT change the external
 * shouldSuppressAlerts() signature — it derives from this function.
 *
 * @param meta - The _meta object from a resolved MappedMetrics result.
 * @returns    AlertPolicy — typed intent, not a raw boolean.
 *
 * @internal
 */
export function getAlertPolicy(meta: MetricsMeta): AlertPolicy {
  // Mock mode generates synthetic data — suppress all alerts unconditionally.
  // Future states ('throttle', 'escalate', etc.) go above this return.
  if (isMockMode(meta)) return 'suppress';

  return 'allow';
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGGING UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a human-readable description of the _meta state for log messages.
 * Used by logIntegrationHealth() to produce consistent, parseable log lines.
 *
 * Format: "mode=hybrid partial=true sources={posthog:true,backend:false}"
 *
 * @internal
 */
export function formatMetaForLog(meta: MetricsMeta): string {
  const sourceParts = Object.entries(meta.sources)
    .map(([name, ok]) => `${name}:${ok}`)
    .join(',');
  return `mode=${meta.mode} partial=${meta.partial} sources={${sourceParts}}`;
}

/**
 * Returns the names of sources that failed (value === false) in meta.sources.
 * Empty array means all configured sources succeeded.
 *
 * @internal
 */
export function failedSources(meta: MetricsMeta): string[] {
  return Object.entries(meta.sources)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);
}