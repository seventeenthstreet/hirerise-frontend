/**
 * @file src/hooks/admin/useAdminDashboard.ts
 * @description Orchestrator hook for the Enterprise Admin Dashboard
 * (WP-ADMIN-03 Phase 2 — Executive Overview + System Health sections).
 *
 * RESPONSIBILITIES:
 *  - Compose useSystemHealth() with real counts pulled from APIs that
 *    already exist (Admin CMS Skills, Roles catalogue, Admin Users
 *    directory) into one stable return type for the dashboard page.
 *  - Surface an explicit `isUnavailable` flag per metric the dashboard has
 *    no backing API for yet (active users, job families, education levels,
 *    salary benchmarks, last import) — these are never fetched, never
 *    fabricated, and never given a placeholder number.
 *
 * HARD RULES:
 *  - NO UI logic — pure data composition.
 *  - NO new API endpoints — only calls functions that already exist in
 *    lib/api/adminCmsSkills.ts, lib/api/roles.ts, and lib/api/adminUsers.ts.
 *  - NO mock data, no hardcoded metric values.
 *
 * Architecture position: Hooks layer (second tier)
 *   API → Hooks → UI → Pages → Guards → Context
 */

import { useQuery } from '@tanstack/react-query';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import type { UseSystemHealthReturn } from '@/hooks/useSystemHealth';
import { listAdminSkills } from '@/lib/api/adminCmsSkills';
import { getRoles } from '@/lib/api/roles';
import { listAdminUsers } from '@/lib/api/adminUsers';
import { queryKeys } from '@/lib/query';

// ─────────────────────────────────────────────────────────────────────────────
// EXECUTIVE OVERVIEW METRIC KEYS
//
// Every key the dashboard's Executive Overview section knows about.
// 'skills', 'roles', and 'registeredUsers' are backed by an existing API
// today — the rest are declared here purely so the page layer can render a
// consistent "Unavailable" tile for each, without inventing a value for
// any of them.
// ─────────────────────────────────────────────────────────────────────────────

export interface ExecutiveOverviewMetric {
  value: number | null;
  isLoading: boolean;
  /** True when there is no backing API for this metric — value is always null. */
  isUnavailable: boolean;
}

const UNAVAILABLE_METRIC: ExecutiveOverviewMetric = {
  value: null,
  isLoading: false,
  isUnavailable: true,
};

export interface UseAdminDashboardReturn {
  health: UseSystemHealthReturn;

  // Backed by existing APIs
  skills: ExecutiveOverviewMetric;
  roles: ExecutiveOverviewMetric;
  registeredUsers: ExecutiveOverviewMetric;

  // No backend API exists yet — always the unavailable stub, never fetched.
  activeUsers: ExecutiveOverviewMetric;
  jobFamilies: ExecutiveOverviewMetric;
  educationLevels: ExecutiveOverviewMetric;
  salaryBenchmarks: ExecutiveOverviewMetric;
  lastImport: { value: string | null; isLoading: boolean; isUnavailable: boolean };

  refetchAll: () => void;
}

export function useAdminDashboard(): UseAdminDashboardReturn {
  const health = useSystemHealth();

  // Skills total — reuses the certified Admin CMS Skills endpoint
  // (GET /api/v1/admin/cms/skills). limit:1 because only `total` is needed.
  const skillsQuery = useQuery({
    queryKey: queryKeys.adminMasterData.skills.list({ limit: 1 } as Record<string, unknown>),
    queryFn: () => listAdminSkills({ limit: 1 }),
  });

  // Roles total — reuses the existing Roles catalogue endpoint
  // (GET /api/v1/roles). Same query-key shape useRoles() uses, so this
  // shares cache entries with any other consumer requesting the same params
  // rather than opening a second cache lane for the same endpoint.
  const rolesQuery = useQuery({
    queryKey: [...queryKeys.roles.all(), { limit: 1 }],
    queryFn: () => getRoles({ limit: 1 }),
  });

  // Registered Users total — reuses the certified Admin Users directory
  // endpoint (GET /api/v1/admin/users, adminUsers.repository.js's
  // `count: 'exact'` Supabase query). limit:1 because only `total` is
  // needed here; the same query-key shape useAdminUsersList() uses, so
  // this shares cache entries rather than opening a second cache lane.
  const registeredUsersQuery = useQuery({
    queryKey: queryKeys.adminMasterData.users.list({ limit: 1 } as Record<string, unknown>),
    queryFn: () => listAdminUsers({ limit: 1 }),
  });

  const skills: ExecutiveOverviewMetric = {
    value: skillsQuery.data?.total ?? null,
    isLoading: skillsQuery.isLoading,
    isUnavailable: !skillsQuery.isLoading && (skillsQuery.isError || skillsQuery.data == null),
  };

  const roles: ExecutiveOverviewMetric = {
    value: rolesQuery.data?.total ?? null,
    isLoading: rolesQuery.isLoading,
    isUnavailable: !rolesQuery.isLoading && (rolesQuery.isError || rolesQuery.data == null),
  };

  const registeredUsers: ExecutiveOverviewMetric = {
    value: registeredUsersQuery.data?.total ?? null,
    isLoading: registeredUsersQuery.isLoading,
    isUnavailable: !registeredUsersQuery.isLoading && (registeredUsersQuery.isError || registeredUsersQuery.data == null),
  };

  const refetchAll = (): void => {
    health.refetch();
    void skillsQuery.refetch();
    void rolesQuery.refetch();
    void registeredUsersQuery.refetch();
  };

  return {
    health,
    skills,
    roles,
    registeredUsers,
    activeUsers: UNAVAILABLE_METRIC,
    jobFamilies: UNAVAILABLE_METRIC,
    educationLevels: UNAVAILABLE_METRIC,
    salaryBenchmarks: UNAVAILABLE_METRIC,
    lastImport: { value: null, isLoading: false, isUnavailable: true },
    refetchAll,
  };
}
