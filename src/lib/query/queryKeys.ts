/**
 * @file src/lib/query/queryKeys.ts
 * @description Centralized, typed query key factory.
 *
 * WHY A KEY FACTORY?
 *  - Prevents key typos and mismatches between useQuery and invalidateQueries.
 *  - Enables hierarchical invalidation: invalidate `metrics.all()` to bust
 *    every metric section at once, or target a specific section.
 *  - Keys are plain arrays — no magic strings scattered across the codebase.
 *  - TypeScript infers the return type so callers never manually construct keys.
 *
 * KEY HIERARCHY (React Query uses prefix-matching for invalidation):
 *
 *   ['metrics']                           ← root: invalidates everything
 *   ['metrics', 'sections']               ← all section fetches
 *   ['metrics', 'sections', 'overview',   filters] ← one section
 *   ['metrics', 'sections', 'funnel',     filters]
 *   ['metrics', 'sections', 'onboarding', filters]
 *   ['metrics', 'sections', 'performance',filters]
 *   ['metrics', 'sections', 'reliability',filters]
 *   ['metrics', 'sections', 'experiments',filters]
 *   ['onboarding']                        ← onboarding flow
 *   ['onboarding', 'status', userId]
 *   ['resume']                            ← resume flow
 *   ['resume', userId]
 *   ['resume', 'score', resumeId]
 *   ['user']                              ← user/auth
 *   ['user', 'me']
 *   ['roles']                             ← role catalogue
 *   ['dashboard']                         ← dashboard aggregate
 *   ['career-health']                     ← CHI score + snapshot
 *   ['skills-priority']                   ← skills priority engine
 *   ['opportunities']                     ← opportunity radar
 *   ['app-entry']                         ← boot-time cache warm
 *   ['resume-score']                      ← resume score for current user
 *
 * ARCHITECTURE POSITION: Infrastructure (alongside queryClient.ts)
 *   QueryKeys → useQuery calls in hooks → React Query cache
 */

import type { MetricFilters } from '@/lib/api/metrics';

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE KEY IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Onboarding query keys are owned by the onboarding feature domain.
 * Re-exported here so existing call sites (`queryKeys.onboarding.*`) continue
 * to work without modification.
 *
 * Source of truth: src/features/onboarding/queries/queryKeys.ts
 * WHY HERE: lib/query is infrastructure — it provides a unified import surface
 * for all query key namespaces. Consumers should never need to know which
 * feature owns which namespace; they import from @/lib/query uniformly.
 */
import { onboardingQueryKeys } from '@/features/onboarding/queries';

// ─────────────────────────────────────────────────────────────────────────────
// METRIC SECTION NAMES
// ─────────────────────────────────────────────────────────────────────────────

export type MetricSection =
  | 'overview'
  | 'funnel'
  | 'onboarding'
  | 'performance'
  | 'reliability'
  | 'experiments';

// ─────────────────────────────────────────────────────────────────────────────
// KEY FACTORY
// ─────────────────────────────────────────────────────────────────────────────

export const queryKeys = {

  // ── Metrics ───────────────────────────────────────────────────────────────

  metrics: {
    /** Root key — invalidates ALL metric queries. */
    all: () => ['metrics'] as const,

    /** Intermediate — invalidates all section queries (any filter). */
    sections: () => ['metrics', 'sections'] as const,

    /**
     * Leaf key for a specific section + filter combo.
     *
     * @example
     * queryKeys.metrics.section('overview', { grain: 'weekly' })
     * // → ['metrics', 'sections', 'overview', { grain: 'weekly' }]
     */
    section: (name: MetricSection, filters: MetricFilters) =>
      ['metrics', 'sections', name, filters] as const,
  },

  // ── Onboarding ────────────────────────────────────────────────────────────
  // Keys are owned by src/features/onboarding/queries/queryKeys.ts.
  // Re-exported here under the queryKeys.onboarding namespace for backward
  // compatibility — all existing call sites continue to work unchanged.
  // New call sites that need progress/step granularity can import directly
  // from @/features/onboarding/queries or use queryKeys.onboarding.progress().
  onboarding: onboardingQueryKeys,

  // ── Resume ────────────────────────────────────────────────────────────────

  resume: {
    /** Root key — invalidates all resume queries. */
    all: () => ['resume'] as const,

    /** All resumes for a user. */
    list: (userId: string) => ['resume', userId] as const,

    /** Score for a specific resume. */
    score: (resumeId: string) => ['resume', 'score', resumeId] as const,
  },

  // ── User ──────────────────────────────────────────────────────────────────

  user: {
    /** Root key — invalidates all user queries. */
    all: () => ['user'] as const,

    /** Current authenticated user (/users/me). */
    me: () => ['user', 'me'] as const,
  },

  // ── Roles ─────────────────────────────────────────────────────────────────

  roles: {
    /** Full roles catalogue (static, rarely changes). */
    all: () => ['roles'] as const,
  },

  // ── Dashboard ─────────────────────────────────────────────────────────────

  dashboard: {
    /** Tier-aware aggregated dashboard data. */
    all: () => ['dashboard'] as const,
  },

  // ── Career Health ─────────────────────────────────────────────────────────

  careerHealth: {
    /** CHI score + snapshot. */
    all: () => ['career-health'] as const,
  },

  // ── Skills Priority ───────────────────────────────────────────────────────

  skillsPriority: {
    /** Skills priority engine result (server-cached 30 min). */
    all: () => ['skills-priority'] as const,
  },

  // ── Opportunities ─────────────────────────────────────────────────────────

  opportunities: {
    /** Opportunity radar score + top opportunities list. */
    all: () => ['opportunities'] as const,
  },

  // ── App Entry ─────────────────────────────────────────────────────────────

  appEntry: {
    /**
     * Boot-time cache-warm endpoint.
     * staleTime: 0 — always refetch on mount so the side-effect fires.
     * gcTime:    0 — do not persist in the cache between sessions.
     */
    all: () => ['app-entry'] as const,
  },

  // ── Resume Score ──────────────────────────────────────────────────────────

  resumeScore: {
    /** Score for the authenticated user's active resume. */
    all: () => ['resume-score'] as const,
  },

  // ── Intelligence Quality (Phase 4A) ───────────────────────────────────────
  //
  //   ['intelligence-quality']                  ← root: invalidates all quality queries
  //   ['intelligence-quality', 'report']        ← full quality report
  //   ['intelligence-quality', 'coverage']      ← signal coverage profile
  //   ['intelligence-quality', 'stability']     ← cluster stability profiles
  //   ['intelligence-quality', 'drift']         ← drift events + history
  //   ['intelligence-quality', 'explainability'] ← human-readable narratives
  //
  // Invalidation pattern:
  //   After an assessment completes, invalidate intelligenceQuality.all()
  //   to bust all quality caches at once.

  intelligenceQuality: {
    /** Root key — invalidates ALL intelligence quality queries. */
    all: () => ['intelligence-quality'] as const,

    /** Full quality report (coverage + reliability + stability + drift). */
    report: () => ['intelligence-quality', 'report'] as const,

    /** Signal coverage profile only. */
    coverage: () => ['intelligence-quality', 'coverage'] as const,

    /** Cluster stability profiles. */
    stability: () => ['intelligence-quality', 'stability'] as const,

    /** Drift event + history. */
    drift: () => ['intelligence-quality', 'drift'] as const,

    /** Human-readable explainability narratives. */
    explainability: () => ['intelligence-quality', 'explainability'] as const,
  },

} as const;