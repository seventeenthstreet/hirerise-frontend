/**
 * @file lib/constants/mergeRules.ts
 * @description Single source of truth for hybrid merge precedence per metric section.
 *
 * Extracted into a standalone constants file so that both metricsAdapter.ts and
 * metricsMapper.ts can import it without creating a circular dependency
 * (adapter → mapper → adapter would be a cycle).
 *
 * RULE SEMANTICS:
 *   'posthog'  → PostHog data wins for this section; backend fills gaps
 *   'backend'  → Backend data wins for this section; PostHog fills gaps
 *   'derived'  → Section is always re-computed from already-merged sibling
 *                sections. It is NEVER merged directly from either raw source.
 *
 * WHEN TO CHANGE A RULE:
 *   Change the value here and nowhere else. metricsMapper.mergeMetrics() reads
 *   this table at runtime — logic follows config, not the other way around.
 *   A lint rule or integration test should assert that all keys of MappedMetrics
 *   (excluding _meta) are present in this table.
 *
 * RATIONALE (per section):
 *   resumeFunnel  → posthog: client-side behavioral accuracy; backend counts
 *                   inflated by server-side retries that aren't user-initiated.
 *   onboarding    → posthog: richer step-level funnel with conversion_rate;
 *                   backend only has aggregate counts.
 *   performance   → backend: latency measured server-side; PostHog timestamps
 *                   are client-side approximations.
 *   reliability   → backend: retry counts + monitoring_error_rate are
 *                   server-authoritative; PostHog only sees client-observable errors.
 *   experiments   → backend: flag assignment is server-authoritative; PostHog
 *                   exposure counts are behavioral and lag behind flag evaluation.
 *   overview      → derived: always re-computed from merged sections; merging
 *                   summary fields from two sources would be nonsensical.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPE
// ─────────────────────────────────────────────────────────────────────────────

/** Valid merge strategy values */
export type MergeStrategy = 'posthog' | 'backend' | 'derived';

/**
 * Maps each MappedMetrics section key (excluding _meta) to its merge strategy.
 * TypeScript enforces completeness via `satisfies`.
 */
export type MergeRulesMap = {
  resumeFunnel:  MergeStrategy;
  onboarding:    MergeStrategy;
  performance:   MergeStrategy;
  reliability:   MergeStrategy;
  experiments:   MergeStrategy;
  overview:      MergeStrategy;
};

// ─────────────────────────────────────────────────────────────────────────────
// RULES TABLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Authoritative precedence table for the hybrid merge strategy.
 *
 * This is the SINGLE SOURCE OF TRUTH for merge precedence.
 * metricsMapper.mergeMetrics() reads this table at runtime.
 * metricsAdapter.ts re-exports it for external observability (e.g. tests).
 */
export const MERGE_RULES = {
  resumeFunnel:  'posthog',
  onboarding:    'posthog',
  performance:   'backend',
  reliability:   'backend',
  experiments:   'backend',
  overview:      'derived',
} as const satisfies MergeRulesMap;