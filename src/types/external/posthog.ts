/**
 * @file types/external/posthog.ts
 * @description Raw wire types for PostHog API responses.
 *
 * RULES (NON-NEGOTIABLE):
 *  - These types ONLY model what PostHog actually sends over the wire
 *  - NO business logic, NO derived fields, NO computed values
 *  - NEVER imported by UI components, hooks, or alerts
 *  - All fields optional — PostHog responses are unpredictable
 *  - Any external shape changes are contained here: mapper absorbs the diff
 *
 * BOUNDARY: These types stop at /lib/integrations/posthogClient.ts
 * They are mapped to MetricsResponse types at /lib/mappers/metricsMapper.ts
 *
 * Source: PostHog Insights API + PostHog Events API
 * Docs: https://posthog.com/docs/api/insights
 */

// ─────────────────────────────────────────────────────────────────────────────
// POSTHOG COMMON SHAPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PostHog standard API envelope for paginated list responses.
 * All list endpoints wrap results in this shape.
 */
export interface PostHogListResponse<T> {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: T[];
}

/**
 * A single data point in a PostHog time-series insight.
 */
export interface PostHogDataPoint {
  /** ISO-8601 date string for this bucket */
  date?: string;
  /** Numeric value for this time bucket */
  value?: number;
  /** Breakdown label if segmented */
  label?: string;
}

/**
 * A single series inside a PostHog trends result.
 */
export interface PostHogTrendSeries {
  /** Human-readable label for this series */
  label?: string;
  /** Internal event/action name */
  action?: {
    id?: string;
    name?: string;
    type?: string;
  };
  /** Ordered array of data points */
  data?: number[];
  /** Corresponding date labels, parallel to data[] */
  days?: string[];
  /** Total across all buckets */
  count?: number;
  /** Breakdown value if segmented */
  breakdown_value?: string | number | null;
}

/**
 * PostHog Trends insight result envelope.
 * Returned by GET /api/projects/:id/insights/trend/
 */
export interface PostHogTrendsResult {
  result?: PostHogTrendSeries[];
  is_cached?: boolean;
  last_refresh?: string | null;
  next?: string | null;
}

/**
 * A single step inside a PostHog Funnel result.
 */
export interface PostHogFunnelStep {
  /** Action/event name for this step */
  name?: string;
  /** Unique order index of this step */
  order?: number;
  /** Count of people who reached this step */
  count?: number;
  /** Conversion rate from previous step: 0.0–1.0 */
  conversion_rate?: number;
  /** Conversion rate from first step: 0.0–1.0 */
  average_conversion_time?: number | null;
  /** Breakdown value if segmented */
  breakdown?: string | number | null;
  /** Array of nested breakdowns if variant-segmented */
  nested_breakdown?: PostHogFunnelStep[];
}

/**
 * PostHog Funnel insight result envelope.
 * Returned by GET /api/projects/:id/insights/funnel/
 */
export interface PostHogFunnelResult {
  result?: PostHogFunnelStep[] | PostHogFunnelStep[][];
  is_cached?: boolean;
  last_refresh?: string | null;
}

/**
 * PostHog Event Aggregation result for a single event.
 * Used when querying raw event counts via the events API.
 */
export interface PostHogEventAggregation {
  event?: string;
  count?: number;
  /** ISO-8601 timestamp of first occurrence in window */
  first_timestamp?: string;
  /** ISO-8601 timestamp of last occurrence in window */
  last_timestamp?: string;
}

/**
 * PostHog Feature Flag exposure data.
 * Returned from /api/projects/:id/feature_flags/ with usage stats.
 */
export interface PostHogFlagExposure {
  id?: number;
  key?: string;
  /** Total distinct users who evaluated this flag */
  rollout_percentage?: number;
  /** Per-variant exposure counts */
  filters?: {
    groups?: Array<{
      variant?: string;
      rollout_percentage?: number;
    }>;
    multivariate?: {
      variants?: Array<{
        key?: string;
        rollout_percentage?: number;
        name?: string;
      }>;
    };
  };
  /** Experiment usage breakdown by variant */
  experiment_set?: Array<{
    id?: number;
    name?: string;
  }> | null;
}

/**
 * PostHog Experiment result for a single variant.
 */
export interface PostHogExperimentVariant {
  key?: string;
  /** Count of exposures for this variant */
  count?: number;
  /** Conversion count */
  success_count?: number;
  /** Failure count */
  failure_count?: number;
}

/**
 * PostHog Experiment result envelope.
 */
export interface PostHogExperimentResult {
  id?: number;
  name?: string;
  feature_flag?: string;
  variants?: PostHogExperimentVariant[];
  /** Overall p-value for significance */
  p_value?: number | null;
  /** ISO-8601 start date */
  start_date?: string | null;
  /** ISO-8601 end date */
  end_date?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSITE RAW RESPONSE
// Aggregated raw payload as returned by posthogClient.ts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Composite raw payload assembled by posthogClient.ts from multiple
 * PostHog API calls. All fields are optional — partial data is expected
 * when some calls fail or time out.
 *
 * This is the ONLY shape that crosses the integration boundary.
 * metricsMapper.ts consumes this and produces MetricsResponse.
 */
export interface PostHogRawPayload {
  /** Resume funnel steps: upload_started → upload_success → processing_done */
  resumeFunnel?: PostHogFunnelResult;
  /** Onboarding funnel steps: per-step completion */
  onboardingFunnel?: PostHogFunnelResult;
  /** Processing latency percentile trends (p50/p95/p99) */
  processingLatency?: PostHogTrendsResult;
  /** Upload duration trend */
  uploadDuration?: PostHogTrendsResult;
  /** Error event aggregations by error_reason property */
  errorAggregations?: PostHogListResponse<PostHogEventAggregation>;
  /** Feature flag / experiment exposure counts */
  flagExposures?: PostHogListResponse<PostHogFlagExposure>;
  /** Experiment conversion results by variant */
  experimentResults?: PostHogExperimentResult;
  /**
   * Fetch metadata for partial-failure transparency.
   * The mapper uses this to determine which fields to default.
   */
  fetchedAt?: number;
  /** Which sections succeeded. Allows mapper to skip defaulting on success. */
  successfulSections?: Set<PostHogSection>;
}

/** Section keys that can succeed or fail independently during fetch. */
export type PostHogSection =
  | 'resumeFunnel'
  | 'onboardingFunnel'
  | 'processingLatency'
  | 'uploadDuration'
  | 'errorAggregations'
  | 'flagExposures'
  | 'experimentResults';