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
 *   ['xai-metrics']                       ← WP-7: XAI pipeline metrics
 *   ['xai-metrics', 'usage',  filters]   ← WP-7: XAI usage section
 *   ['xai-metrics', 'tier',   filters]   ← WP-7: XAI tier section
 *   ['system-health']                     ← WP-7: system health
 *   ['system-health', 'snapshot']         ← WP-7: current health snapshot
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

  // ── Admin Master Data (WP-ADMIN-02A) ────────────────────────────────────────
  //
  // Namespace shared by every Admin Master Data module (Skills now; Roles /
  // Career Domains / Skill Clusters in later work packages each get their
  // own leaf below `adminMasterData`, following the `skills` shape).
  //
  //   ['admin-master-data', 'skills']                          ← root: invalidates all skills queries
  //   ['admin-master-data', 'skills', 'list', params]           ← one filtered/paginated page
  //   ['admin-master-data', 'skills', 'detail', skillId]        ← one skill's detail

  adminMasterData: {
    skills: {
      /** Root — invalidates every admin skills query (list + detail). */
      all: () => ['admin-master-data', 'skills'] as const,

      /** One page of the list, keyed by its filters/pagination. */
      list: (params: Record<string, unknown>) =>
        ['admin-master-data', 'skills', 'list', params] as const,

      /** A single skill's detail. */
      detail: (skillId: string) =>
        ['admin-master-data', 'skills', 'detail', skillId] as const,
    },

    // ── Users (WP-ADMIN-04 Phase 1B, read-only) ────────────────────────────
    users: {
      /** Root — invalidates every admin users query (list + detail). */
      all: () => ['admin-master-data', 'users'] as const,

      /** One page of the list, keyed by its filters/pagination. */
      list: (params: Record<string, unknown>) =>
        ['admin-master-data', 'users', 'list', params] as const,

      /** A single user's detail. */
      detail: (userId: string) =>
        ['admin-master-data', 'users', 'detail', userId] as const,

      /** WP-ADMIN-COMP-04 — one user's audit-history page, keyed by limit. */
      auditHistory: (userId: string, limit: number) =>
        ['admin-master-data', 'users', 'audit-history', userId, limit] as const,
    },

    // ── Roles (WP-ADMIN-COMP-03) ───────────────────────────────────────────
    roles: {
      all: () => ['admin-master-data', 'cms-roles'] as const,
      list: (params: Record<string, unknown>) =>
        ['admin-master-data', 'cms-roles', 'list', params] as const,
    },

    // ── Career Domains (WP-ADMIN-COMP-03) ──────────────────────────────────
    careerDomains: {
      all: () => ['admin-master-data', 'career-domains'] as const,
      list: () => ['admin-master-data', 'career-domains', 'list'] as const,
    },

    // ── Skill Clusters (WP-ADMIN-COMP-03) ──────────────────────────────────
    skillClusters: {
      all: () => ['admin-master-data', 'skill-clusters'] as const,
      list: (params: Record<string, unknown>) =>
        ['admin-master-data', 'skill-clusters', 'list', params] as const,
    },

    // ── Job Families (WP-ADMIN-COMP-03) ────────────────────────────────────
    jobFamilies: {
      all: () => ['admin-master-data', 'job-families'] as const,
      list: (params: Record<string, unknown>) =>
        ['admin-master-data', 'job-families', 'list', params] as const,
    },

    // ── Education Levels (WP-ADMIN-COMP-03) ────────────────────────────────
    educationLevels: {
      all: () => ['admin-master-data', 'education-levels'] as const,
      list: (params: Record<string, unknown>) =>
        ['admin-master-data', 'education-levels', 'list', params] as const,
    },

    // ── Salary Benchmarks (WP-ADMIN-COMP-03) ───────────────────────────────
    salaryBenchmarks: {
      all: () => ['admin-master-data', 'salary-benchmarks'] as const,
      list: (params: Record<string, unknown>) =>
        ['admin-master-data', 'salary-benchmarks', 'list', params] as const,
    },
  },

  // ── Admin Jobs (WP-ADMIN-COMP-06) ───────────────────────────────────────────
  //
  // Backs hooks/admin/useAdminJobs.ts. Its own top-level namespace (not
  // nested under adminMasterData) — Jobs is a distinct domain with richer
  // behavior (sync trigger/status/history) than the generic Master Data
  // CRUD shape, per WP-ADMIN-COMP-06 §7's explicit guidance not to force
  // it into that abstraction.
  //
  //   ['admin-jobs']                          ← root: all job queries
  //   ['admin-jobs', 'list', params]           ← one filtered/paginated page
  //   ['admin-jobs', 'detail', jobId]          ← one job's detail
  //   ['admin-jobs', 'sync-status']            ← current sync lock state
  //   ['admin-jobs', 'sync-logs', limit]       ← recent sync history

  adminJobs: {
    /** Root — invalidates every admin jobs query (list + detail + sync state). */
    all: () => ['admin-jobs'] as const,

    /** One page of the list, keyed by its filters/pagination. */
    list: (params: Record<string, unknown>) =>
      ['admin-jobs', 'list', params] as const,

    /** A single job's detail. */
    detail: (jobId: string) =>
      ['admin-jobs', 'detail', jobId] as const,

    /** Current sync lock state (idle/running). */
    syncStatus: () => ['admin-jobs', 'sync-status'] as const,

    /** Recent sync history, keyed by the requested page size. */
    syncLogs: (limit: number) => ['admin-jobs', 'sync-logs', limit] as const,
  },

  // ── Admin Administrators (WP-ADMIN-05A) ─────────────────────────────────────
  //
  // Backs hooks/admin/useAdministrators.ts — the Enterprise Administrator
  // Management directory/detail/lifecycle UI. Same list/detail shape as
  // adminMasterData.users above, in its own top-level namespace since
  // Administrators (admin_principals) are a distinct entity from
  // application Users (public.users).
  //
  //   ['admin-administrators']                          ← root: all administrator queries
  //   ['admin-administrators', 'list', params]           ← one filtered/paginated page
  //   ['admin-administrators', 'detail', uid]             ← one administrator's detail

  adminAdministrators: {
    /** Root — invalidates every administrator query (list + detail). */
    all: () => ['admin-administrators'] as const,

    /** One page of the directory, keyed by its filters/pagination. */
    list: (params: Record<string, unknown>) =>
      ['admin-administrators', 'list', params] as const,

    /** A single administrator's detail (identity, lifecycle, audit history). */
    detail: (uid: string) =>
      ['admin-administrators', 'detail', uid] as const,
  },

  // ── Admin Permissions (WP-ADMIN-04F-09) ─────────────────────────────────────
  //
  // Backs the Enterprise Permission Management UI's hooks in
  // hooks/admin/usePermissionsAdmin.ts. Two independent sub-namespaces:
  //
  //   registry     — the Permission catalog itself (list/detail, WP-ADMIN-04F-08)
  //   assignments  — which principals hold which Permissions
  //
  //   ['admin-permissions', 'registry']                       ← root: all registry queries
  //   ['admin-permissions', 'registry', 'list', params]        ← one filtered/paginated page
  //   ['admin-permissions', 'registry', 'detail', identity]     ← one permission's detail
  //   ['admin-permissions', 'assignments']                     ← root: all assignment queries
  //   ['admin-permissions', 'assignments', 'principal', principalId] ← one principal's assignments
  //   ['admin-permissions', 'history']                          ← root: all history queries
  //   ['admin-permissions', 'history', 'permission', id, params] ← one permission's timeline page

  adminPermissions: {
    registry: {
      /** Root — invalidates every admin permissions registry query (list + detail). */
      all: () => ['admin-permissions', 'registry'] as const,

      /** One page of the catalog list, keyed by its filters/pagination. */
      list: (params: Record<string, unknown>) =>
        ['admin-permissions', 'registry', 'list', params] as const,

      /** A single permission's detail, by its stable identity. */
      detail: (identity: string) =>
        ['admin-permissions', 'registry', 'detail', identity] as const,
    },

    assignments: {
      /** Root — invalidates every admin permissions assignment query. */
      all: () => ['admin-permissions', 'assignments'] as const,

      /** All Assignments held by one principal. */
      forPrincipal: (principalId: string) =>
        ['admin-permissions', 'assignments', 'principal', principalId] as const,
    },

    // WP-ADMIN-05D — Enterprise Permission Audit & Governance History.
    history: {
      /** Root — invalidates every admin permissions history query. */
      all: () => ['admin-permissions', 'history'] as const,

      /** One Permission's unified Assignment + Governance timeline, keyed by id and its filters/pagination. */
      forPermission: (id: string, params: Record<string, unknown>) =>
        ['admin-permissions', 'history', 'permission', id, params] as const,
    },
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

  // ── WP-7: XAI Metrics ─────────────────────────────────────────────────────
  //
  // Root is intentionally separate from ['metrics'] so that:
  //   - queryClient.invalidateQueries({ queryKey: ['metrics'] }) does NOT
  //     touch xai-metrics (different operational domain).
  //   - WP-13 can invalidate XAI caches independently after real data lands.
  //
  // Invalidation patterns:
  //   queryKeys.xaiMetrics.all()       → busts usage + tier (both sections)
  //   queryKeys.xaiMetrics.usage(f)    → busts only the usage section for filters f
  //   queryKeys.xaiMetrics.tier(f)     → busts only the tier section for filters f

  xaiMetrics: {
    /** Root key — invalidates ALL XAI metric queries. */
    all: () => ['xai-metrics'] as const,

    /**
     * Leaf key for the XAI usage section + filter combo.
     *
     * @example
     * queryKeys.xaiMetrics.usage({ grain: 'weekly' })
     * // → ['xai-metrics', 'usage', { grain: 'weekly' }]
     */
    usage: (filters: MetricFilters) =>
      ['xai-metrics', 'usage', filters] as const,

    /**
     * Leaf key for the XAI tier distribution section + filter combo.
     *
     * @example
     * queryKeys.xaiMetrics.tier({ grain: 'weekly' })
     * // → ['xai-metrics', 'tier', { grain: 'weekly' }]
     */
    tier: (filters: MetricFilters) =>
      ['xai-metrics', 'tier', filters] as const,
  },

  // ── WP-7: System Health ───────────────────────────────────────────────────
  //
  // Root is intentionally separate from all other namespaces — system health
  // is an operational signal, not an analytics metric. It has its own staleTime
  // (60 s in useSystemHealth) and is invalidated independently of metrics.
  //
  // Invalidation pattern:
  //   queryKeys.systemHealth.all()      → busts the health snapshot

  systemHealth: {
    /** Root key — invalidates ALL system health queries. */
    all: () => ['system-health'] as const,

    /**
     * Leaf key for the current health snapshot.
     * No filter params — health is always a point-in-time read.
     *
     * @example
     * queryKeys.systemHealth.snapshot()
     * // → ['system-health', 'snapshot']
     */
    snapshot: () => ['system-health', 'snapshot'] as const,
  },

} as const;