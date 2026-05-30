/**
 * @file src/types/analytics.ts
 * @description UI-safe analytics contract types.
 *
 * ARCHITECTURE BOUNDARY:
 *  - This file is the ONLY source of truth for analytics types in UI + hooks.
 *  - UI components import ONLY from here — never from lib/api/metrics.ts.
 *  - All fields are nullable or have safe defaults so renders never crash.
 *  - The mapper (lib/mappers/analytics.mapper.ts) converts raw API types → these types.
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │  USAGE RULE                                                  │
 * │  ✅  UI  → import from src/types/analytics.ts               │
 * │  ✅  Hook → return UiContractRoot | null                     │
 * │  ✅  Mapper → produces UiContractRoot from raw API shape     │
 * │  ❌  UI  → NEVER import from lib/api/metrics.ts             │
 * └──────────────────────────────────────────────────────────────┘
 */

// ─────────────────────────────────────────────────────────────────────────────
// METRIC STATUS — exhaustive union, used across all metric cards
// ─────────────────────────────────────────────────────────────────────────────

/**
 * UI-facing metric health status.
 * All switch statements on this type MUST handle every case.
 * Use the exhaustiveMetricStatus() helper to enforce this at compile time.
 */
export type MetricStatus = 'good' | 'warning' | 'critical' | 'neutral';

/**
 * Compile-time exhaustiveness guard for MetricStatus switch statements.
 *
 * @example
 * switch (status) {
 *   case 'good':     return '#22c55e';
 *   case 'warning':  return '#f59e0b';
 *   case 'critical': return '#ef4444';
 *   case 'neutral':  return '#4d6080';
 *   default:         return exhaustiveMetricStatus(status);
 * }
 */
export function exhaustiveMetricStatus(status: never): never {
  throw new Error(`[analytics] Unhandled MetricStatus: ${String(status)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED BUILDING BLOCKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single formatted metric value as rendered by a MetricCard.
 * All fields are safe strings — null/undefined never reaches the UI.
 */
export interface UiMetric {
  /** Display label (e.g. "Upload success rate") */
  label: string;
  /** Pre-formatted display value (e.g. "94.2%" or "—") */
  formatted: string;
  /** Health status for the coloured indicator strip */
  status: MetricStatus;
  /** Optional secondary label */
  sublabel?: string;
  /** Optional secondary formatted value */
  subvalue?: string;
  /** Optional detail/footnote string */
  detail?: string;
  /** Raw numeric value for computations — null when unavailable */
  rawValue: number | null;
}

/**
 * A single step in a funnel chart.
 */
export interface UiFunnelStep {
  label: string;
  /** 0–1 rate or raw count depending on isRate */
  value: number;
  isRate: boolean;
  color?: string;
}

/**
 * A single row in a bar chart.
 */
export interface UiBarChartRow {
  label: string;
  value: number;
  isRate: boolean;
  highlight?: boolean;
  sublabel?: string;
}

/**
 * Percentile trio used in latency display panels.
 */
export interface UiPercentileSet {
  label: string;
  p50: number | null;
  p95: number | null;
  p99?: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION CONTRACTS
// Each section corresponds to one DashboardSection in the analytics page.
// ─────────────────────────────────────────────────────────────────────────────

/** Overview section — headline KPIs */
export interface UiOverviewSection {
  endToEndConversion: UiMetric;
  timeToValueP50: UiMetric;
  resumeFailureRate: UiMetric;
}

/** Resume funnel section */
export interface UiResumeFunnelSection {
  funnelSteps: UiFunnelStep[];
  uploadStartCount: UiMetric;
  timeoutRate: UiMetric;
  retrySuccessRate: UiMetric;
}

/** Onboarding section */
export interface UiOnboardingSection {
  onboardingStartCount: UiMetric;
  completionRate: UiMetric;
  stepCompletionRows: UiBarChartRow[];
}

/** Performance section */
export interface UiPerformanceSection {
  processingLatency: UiPercentileSet;
  timeToValue: UiPercentileSet;
  avgAttemptsPerResume: UiMetric;
  avgUploadDuration: UiMetric;
  avgOnboardingTime: UiMetric;
  avgStepTime: UiMetric;
}

/** Reliability section */
export interface UiReliabilitySection {
  resumeFailureRate: UiMetric;
  timeoutRate: UiMetric;
  retrySuccessRate: UiMetric;
  errorsPer100Sessions: UiMetric;
  monitoringErrorRate: UiMetric;
  onboardingErrorRate: UiMetric;
}

/** Experiments section */
export interface UiExperimentsSection {
  flagExposureRows: UiBarChartRow[];
  variantConversionRows: UiBarChartRow[];
  variantTable: UiVariantTableRow[];
}

export interface UiVariantTableRow {
  variant: string;
  sessions: string;         // pre-formatted
  conversionRate: string;   // pre-formatted
  relativeLift: string;     // pre-formatted, "— (control)" for control
  liftIsPositive: boolean | null; // null for control, used for colour
}

/** Derived cross-section signals */
export interface UiDerivedSection {
  overallHealthScore: UiMetric;
  processingDropOffRate: UiMetric;
  uploadDropOffRate: UiMetric;
  onboardingResumeGap: UiMetric;
  p95OverP50Ratio: UiMetric;
  estimatedRetryWaste: UiMetric;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT CONTRACT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The single root UI contract for the analytics dashboard.
 *
 * The hook (useMetrics) returns MetricSectionState<UiContractRoot>.
 * Every UI component in components/analytics MUST consume this type only.
 * The mapper (analytics.mapper.ts) is the ONLY place raw API types are read.
 *
 * INVARIANTS:
 *  - All section fields are always present (never undefined at the root level)
 *  - Individual metric values inside sections may be null to indicate unavailability
 *  - Arrays are always [] (never null/undefined)
 */
export interface UiContractRoot {
  overview: UiOverviewSection;
  resumeFunnel: UiResumeFunnelSection;
  onboarding: UiOnboardingSection;
  performance: UiPerformanceSection;
  reliability: UiReliabilitySection;
  experiments: UiExperimentsSection;
  derived: UiDerivedSection;
}