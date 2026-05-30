/**
 * @file lib/alerts.ts
 * @description Product Intelligence — Alert System.
 *
 * RULES (non-negotiable):
 *  - NO imports from React, hooks, or UI — pure TypeScript
 *  - NO state, NO side effects — pure input → output
 *  - NO direct API calls
 *  - All alert rules are declarative and data-driven
 *  - evaluateAlerts() is the single evaluation entry point
 *
 * Used by:
 *  - hooks/useMetrics.ts → called after data fetch, result returned as `alerts`
 *
 * NOT used by:
 *  - UI components  — they receive Alert[] and render only
 *  - pages          — same; zero logic
 *
 * Architecture position: lib utility, feeds into Hooks layer only
 *   API → Hooks → UI → Pages → Guards → Context
 *          ↑
 *     alerts.ts feeds into the Hooks layer only
 */

import type {
  OverviewMetrics,
  ResumeFunnelMetrics,
  OnboardingFunnelMetrics,
  PerformanceMetrics,
  ReliabilityMetrics,
  ExperimentMetrics,
} from '@/lib/api/metrics';

// ─── Threshold Engine (additive integration) ─────────────────────────────────
// These imports extend the evaluation pipeline without changing existing types
// or the Alert[] contract returned from evaluateAlerts().
import { evaluateThreshold } from '@/lib/thresholds/thresholdEngine';
import type { CooldownEntry } from '@/lib/thresholds/noiseFilter';

// ─────────────────────────────────────────────────────────────────────────────
// ALERT TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Severity levels ordered low → critical. */
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * A fired alert instance.
 * Produced by evaluateAlerts() and returned from useMetrics.
 * UI receives Alert[] — renders only, zero computation.
 */
export interface Alert {
  /** Unique identifier matching the rule that fired. */
  id:         string;
  /** The schema metric name this alert monitors. */
  metric:     string;
  severity:   AlertSeverity;
  message:    string;
  /** The raw value that triggered the alert. Null when value was unavailable. */
  value:      number | null;
  /** Unix timestamp (ms) when this alert was evaluated. */
  firedAt:    number;
}

// ─────────────────────────────────────────────────────────────────────────────
// METRICS INPUT TYPE
// Mirrors AllMetricsData from useMetrics.ts but declared independently here
// so alerts.ts has zero dependency on the hook layer.
// ─────────────────────────────────────────────────────────────────────────────

export interface AlertMetricsInput {
  overview:     OverviewMetrics         | null;
  resumeFunnel: ResumeFunnelMetrics     | null;
  onboarding:   OnboardingFunnelMetrics | null;
  performance:  PerformanceMetrics      | null;
  reliability:  ReliabilityMetrics      | null;
  experiments:  ExperimentMetrics       | null;

  /**
   * Optional threshold engine context — additive extension.
   * When provided, evaluateAlerts() routes through the ThresholdEngine for
   * smarter, noise-reduced, baseline-aware evaluation.
   * When absent, falls back to static condition fns — full backward compat.
   */
  _thresholdCtx?: ThresholdContext;
}

/**
 * Context supplied by the hook layer to enable the threshold engine.
 */
export interface ThresholdContext {
  /** Historical values per metric key, oldest first. */
  history?:  Record<string, number[]>;
  /** Cooldown state per metric key (from alert dedup layer). */
  cooldowns?: Record<string, CooldownEntry>;
  /** Unix timestamp in ms. Defaults to Date.now() if absent. */
  nowMs?:    number;
}

// ─────────────────────────────────────────────────────────────────────────────
// ALERT RULE TYPE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Declarative alert rule.
 * Each rule extracts one numeric value from the metrics snapshot,
 * tests it against a condition, and emits a structured Alert if it fires.
 *
 * Rules are pure data — no logic lives outside evaluateAlerts().
 */
interface AlertRule {
  /** Stable unique ID — used as Alert.id. */
  id:        string;
  /** Schema metric name being monitored. */
  metric:    string;
  severity:  AlertSeverity;
  message:   string;
  /**
   * Extract the monitored value from the metrics snapshot.
   * Returns null when the relevant section hasn't loaded yet —
   * evaluateAlerts() skips null extractions (no false positives on load).
   */
  extract:   (m: AlertMetricsInput) => number | null;
  /**
   * Return true when the extracted value should trigger the alert.
   * The condition receives the raw value (already confirmed non-null).
   */
  condition: (value: number) => boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// ALERT RULES
// Single source of truth for all product intelligence thresholds.
// Add new rules here — evaluateAlerts() picks them up automatically.
// ─────────────────────────────────────────────────────────────────────────────

const ALERT_RULES: AlertRule[] = [
  // ── Reliability ────────────────────────────────────────────────────────────

  {
    id:        'high-resume-failure-rate',
    metric:    'resume_failure_rate',
    severity:  'high',
    message:   'Resume failure rate exceeds 5% — investigate processing pipeline',
    extract:   m => m.reliability?.resume_failure_rate ?? null,
    condition: v => v > 0.05,
  },
  {
    id:        'critical-resume-failure-rate',
    metric:    'resume_failure_rate',
    severity:  'critical',
    message:   'Resume failure rate exceeds 15% — immediate action required',
    extract:   m => m.reliability?.resume_failure_rate ?? null,
    condition: v => v > 0.15,
  },
  {
    id:        'high-timeout-rate',
    metric:    'timeout_rate',
    severity:  'high',
    message:   'Timeout rate exceeds 8% — check processing infrastructure',
    extract:   m => m.reliability?.timeout_rate ?? null,
    condition: v => v > 0.08,
  },
  {
    id:        'high-monitoring-error-rate',
    metric:    'monitoring_error_rate',
    severity:  'medium',
    message:   'Monitoring error rate elevated above 3%',
    extract:   m => m.reliability?.monitoring_error_rate ?? null,
    condition: v => v > 0.03,
  },

  // ── Conversion ─────────────────────────────────────────────────────────────

  {
    id:        'low-e2e-conversion',
    metric:    'resume_end_to_end_conversion_rate',
    severity:  'high',
    message:   'End-to-end conversion rate dropped below 60%',
    extract:   m => m.overview?.resume_end_to_end_conversion_rate ?? null,
    condition: v => v < 0.60,
  },
  {
    id:        'critical-e2e-conversion',
    metric:    'resume_end_to_end_conversion_rate',
    severity:  'critical',
    message:   'End-to-end conversion rate critically low (below 40%)',
    extract:   m => m.overview?.resume_end_to_end_conversion_rate ?? null,
    condition: v => v < 0.40,
  },
  {
    id:        'low-upload-success',
    metric:    'upload_success_rate',
    severity:  'medium',
    message:   'Upload success rate below 90% — check client-side upload flow',
    extract:   m => m.resumeFunnel?.upload_success_rate ?? null,
    condition: v => v < 0.90,
  },
  {
    id:        'low-onboarding-completion',
    metric:    'onboarding_completion_rate',
    severity:  'medium',
    message:   'Onboarding completion rate below 50%',
    extract:   m => m.onboarding?.onboarding_completion_rate ?? null,
    condition: v => v < 0.50,
  },

  // ── Performance ────────────────────────────────────────────────────────────

  {
    id:        'slow-p95-processing',
    metric:    'avg / p50 / p95 / p99 processing time',
    severity:  'medium',
    message:   'Processing p95 latency exceeds 30 seconds',
    extract:   m => m.performance?.processing_p95_ms ?? null,
    condition: v => v > 30_000,
  },
  {
    id:        'critical-p95-processing',
    metric:    'avg / p50 / p95 / p99 processing time',
    severity:  'critical',
    message:   'Processing p95 latency exceeds 60 seconds — SLA breach risk',
    extract:   m => m.performance?.processing_p95_ms ?? null,
    condition: v => v > 60_000,
  },
  {
    id:        'slow-time-to-value',
    metric:    'time_to_value',
    severity:  'medium',
    message:   'Time-to-value p50 exceeds 20 seconds',
    extract:   m => m.performance?.time_to_value_p50_ms ?? null,
    condition: v => v > 20_000,
  },
  {
    id:        'high-avg-attempts',
    metric:    'avg_attempts_per_resume',
    severity:  'low',
    message:   'Average retry attempts per resume above 3 — retry loop suspected',
    extract:   m => m.performance?.avg_attempts_per_resume ?? null,
    condition: v => v > 3,
  },

  // ── Errors per session ─────────────────────────────────────────────────────

  {
    id:        'high-errors-per-session',
    metric:    'resume_errors_per_session',
    severity:  'high',
    message:   'Resume errors per session above 0.1 (10 per 100 sessions)',
    extract:   m => m.reliability?.resume_errors_per_session ?? null,
    condition: v => v > 0.1,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// evaluateAlerts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluate all ALERT_RULES against a metrics snapshot.
 *
 * Rules:
 *  - If a section hasn't loaded (extract returns null) → rule is skipped,
 *    no false-positive alert on initial page load.
 *  - Rules are evaluated in declaration order; all matching rules fire
 *    (both 'high' and 'critical' thresholds can fire simultaneously).
 *  - Output is sorted: critical → high → medium → low.
 *  - Pure function — deterministic given the same input, safe in useMemo.
 *
 * @param metrics - Latest metrics snapshot from the hook
 * @returns Sorted array of fired Alert instances (empty if all green)
 */
export function evaluateAlerts(metrics: AlertMetricsInput): Alert[] {
  const now    = metrics._thresholdCtx?.nowMs ?? Date.now();
  const ctx    = metrics._thresholdCtx;
  const fired: Alert[] = [];

  for (const rule of ALERT_RULES) {
    const value = rule.extract(metrics);
    if (value === null) continue;  // section not yet loaded — no false positives

    // ── Threshold Engine path (when context is available) ────────────────
    // Additive: when _thresholdCtx is present, route through the engine for
    // smarter, adaptive, noise-filtered evaluation.
    // Backward compat: when absent, original static condition is used.
    if (ctx) {
      const history      = ctx.history?.[rule.metric]    ?? [];
      const cooldownEntry = ctx.cooldowns?.[rule.metric];

      const result = evaluateThreshold({
        metricKey:      rule.metric,
        value,
        history,
        cooldownEntry,
        nowMs:          now,
      });

      // Engine returns 'normal' → threshold not breached (or noise filtered)
      if (result.level === 'normal') continue;

      // Map engine level to alert severity using rule severity as ceiling.
      // The rule declares its severity intent; engine can only suppress, not escalate.
      const effectiveSeverity: AlertSeverity =
        result.level === 'critical' && rule.severity === 'critical' ? 'critical'
        : result.level === 'critical' ? rule.severity  // engine says critical, rule cap applies
        : result.level === 'warning'  ? downgradeSeverity(rule.severity)
        : rule.severity;

      fired.push({
        id:       rule.id,
        metric:   rule.metric,
        severity: effectiveSeverity,
        message:  rule.message,
        value,
        firedAt:  now,
      });
      continue;
    }

    // ── Static fallback path (original behavior — unchanged) ─────────────
    if (!rule.condition(value)) continue;

    fired.push({
      id:       rule.id,
      metric:   rule.metric,
      severity: rule.severity,
      message:  rule.message,
      value,
      firedAt:  now,
    });
  }

  // Sort critical → high → medium → low so UI can render by priority.
  const ORDER: Record<AlertSeverity, number> = {
    critical: 0,
    high:     1,
    medium:   2,
    low:      3,
  };

  return fired.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
}

// ─────────────────────────────────────────────────────────────────────────────
// THRESHOLD ENGINE HELPERS (private to this module)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Downgrade a severity by one level (critical→high, high→medium, medium→low, low→low).
 * Used when the engine signals 'warning' but the rule declared a higher severity.
 */
function downgradeSeverity(s: AlertSeverity): AlertSeverity {
  const MAP: Record<AlertSeverity, AlertSeverity> = {
    critical: 'high',
    high:     'medium',
    medium:   'low',
    low:      'low',
  };
  return MAP[s];
}