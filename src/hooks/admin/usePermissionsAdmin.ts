/**
 * @file hooks/admin/usePermissionsAdmin.ts
 * @description React Query hooks for the Enterprise Permission
 * Management UI (WP-ADMIN-04F-09), wrapping the certified Permission
 * Administration API (WP-ADMIN-04F-08) via lib/api/adminPermissions.
 *
 * RESPONSIBILITIES:
 *  - Wrap each lib/api/adminPermissions function in useQuery/useMutation
 *  - Apply the same retry strategy as the rest of the app (shouldRetry / retryDelay)
 *  - Invalidate the right query-key branches on mutation success
 *
 * HARD RULES (mirrors hooks/admin/useAdminUsers.ts and every other hooks
 * file in this layer):
 *  - NO UI logic here — callers (pages/components) own loading/success/error rendering
 *  - NO direct fetch/axios — always through lib/api/adminPermissions
 *  - NO authorization/evaluation/assignment logic — every decision comes
 *    back from the certified backend response, never computed here
 *  - Errors surface as ApiClientError — branch on `err.category` in the UI
 *
 * Architecture position: Hooks layer
 *   API (lib/api/adminPermissions) → Hooks (this file) → UI (pages/admin/permissions, components/permissions)
 */

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listAdminPermissions,
  findAdminPermissionsByResource,
  findAdminPermissionsByAction,
  findAdminPermissionsByCategory,
  getAdminPermissionByIdentity,
  getAdminAssignmentsForPrincipal,
  assignAdminPermission,
  revokeAdminPermission,
  evaluateAdminPermission,
  approveAdminPermission,
  publishAdminPermission,
  adoptAdminPermission,
  deprecateAdminPermission,
  retireAdminPermission,
  getAdminPermissionHistory,
  type AdminPermission,
  type AdminPermissionAssignment,
  type AssignmentMutationInput,
  type EvaluatePermissionInput,
  type EvaluationResult,
  type ListAdminPermissionsResponse,
  type PermissionHistoryFilterParams,
  type PermissionHistoryResponse,
} from '@/lib/api/adminPermissions';
import type { ApiClientError } from '@/lib/api/core';
import { shouldRetry, retryDelay, queryKeys } from '@/lib/query';

// ─────────────────────────────────────────────────────────────────────────────
// QUERIES — Registry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * At most one of `resource` / `action` / `category` may be set — the
 * Catalog page's three filter dropdowns are mutually exclusive (the
 * certified Registry API exposes them as separate single-dimension
 * lookup endpoints, not a combinable filter — see
 * lib/api/adminPermissions.ts's header). When none are set, this calls
 * the plain paginated `/registry` listing.
 */
export interface AdminPermissionsListParams {
  limit?: number;
  offset?: number;
  resource?: string;
  action?: string;
  category?: string;
}

/**
 * Fetch one page of the Permission catalog, server-paginated via
 * offset/limit, optionally narrowed to one Registry-Discovery dimension.
 * Re-fetches automatically whenever `params` changes (new query key).
 */
export function useAdminPermissionsList(params: AdminPermissionsListParams) {
  const { limit, offset, resource, action, category } = params;

  return useQuery<ListAdminPermissionsResponse, ApiClientError>({
    queryKey: queryKeys.adminPermissions.registry.list(params as Record<string, unknown>),
    queryFn: () => {
      if (resource) return findAdminPermissionsByResource(resource, { limit, offset });
      if (action) return findAdminPermissionsByAction(action, { limit, offset });
      if (category) return findAdminPermissionsByCategory(category, { limit, offset });
      return listAdminPermissions({ limit, offset });
    },
    retry: (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
    placeholderData: (previousData: ListAdminPermissionsResponse | undefined) => previousData, // keep old page visible while the next page loads
  });
}

/** Fetch a single Permission's detail (Detail page), by its stable identity. Disabled until provided. */
export function useAdminPermissionDetail(identity: string | null) {
  return useQuery<AdminPermission, ApiClientError>({
    queryKey: queryKeys.adminPermissions.registry.detail(identity ?? ''),
    queryFn: () => getAdminPermissionByIdentity(identity as string),
    enabled: Boolean(identity),
    retry: (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERIES — Registry-driven Permission vocabulary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * WP-ADMIN-04F-13B — the Registry-driven replacement for the removed
 * `PERMISSION_RESOURCES` / `PERMISSION_ACTIONS` / `PERMISSION_CATEGORIES`
 * constants (lib/api/adminPermissions.ts). The certified Permission
 * vocabulary is small enough (every Resource × Action combination the
 * domain defines — see permission.constants.js) to fit in a single
 * `/registry` page, so this derives the whole vocabulary client-side
 * from one paginated fetch rather than issuing a request per dropdown.
 *
 * No lifecycle rule of any kind lives in this hook: `assignableOnly`
 * only forwards the option to the already-certified backend filter
 * (permissionRegistry.controller.js's `applyAssignableOnlyFilter`,
 * built on the certified `DefaultAssignmentPolicy`) — this file never
 * decides which Permission Statuses count as assignable.
 */
const VOCABULARY_PAGE_LIMIT = 200;

export interface AdminPermissionVocabulary {
  /** Every distinct Resource present in the fetched Registry page, sorted. */
  resources: string[];
  /** Every distinct Action present anywhere in the fetched Registry page, sorted. */
  actions: string[];
  /** Every distinct Category present in the fetched Registry page, sorted. */
  categories: string[];
  /** The raw Registry entries backing this vocabulary (e.g. for status/lifecycle display). */
  permissions: AdminPermission[];
  /** Every distinct Action registered under one Resource, sorted. Empty until that Resource has been fetched. */
  actionsForResource: (resource: string) => string[];
}

export interface UseAdminPermissionVocabularyOptions {
  /** Narrow to Permissions the certified Assignment Policy currently considers assignable. */
  assignableOnly?: boolean;
}

export function useAdminPermissionVocabulary(options?: UseAdminPermissionVocabularyOptions) {
  const assignableOnly = options?.assignableOnly ?? false;
  const params = { limit: VOCABULARY_PAGE_LIMIT, offset: 0, assignableOnly };

  const query = useQuery<ListAdminPermissionsResponse, ApiClientError>({
    queryKey: queryKeys.adminPermissions.registry.list(params as Record<string, unknown>),
    queryFn: () => listAdminPermissions(params),
    retry: (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
  });

  const vocabulary = useMemo<AdminPermissionVocabulary>(() => {
    const items = query.data?.items ?? [];
    const resources = Array.from(new Set(items.map((item) => item.resource))).sort();
    const actions = Array.from(new Set(items.map((item) => item.action))).sort();
    const categories = Array.from(
      new Set(items.map((item) => item.category).filter((category): category is string => Boolean(category))),
    ).sort();

    return {
      resources,
      actions,
      categories,
      permissions: items,
      actionsForResource: (resource: string) =>
        Array.from(new Set(items.filter((item) => item.resource === resource).map((item) => item.action))).sort(),
    };
  }, [query.data]);

  return {
    vocabulary,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERIES — Assignments
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch every Assignment held by one principal (Assignment UI's principal lookup). Disabled until provided. */
export function useAdminAssignmentsForPrincipal(principalId: string | null) {
  return useQuery<{ assignments: AdminPermissionAssignment[] }, ApiClientError>({
    queryKey: queryKeys.adminPermissions.assignments.forPrincipal(principalId ?? ''),
    queryFn: () => getAdminAssignmentsForPrincipal(principalId as string),
    enabled: Boolean(principalId),
    retry: (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MUTATIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Grants a Permission to a principal. Invalidates that principal's assignment list on success. */
export function useAssignAdminPermission() {
  const queryClient = useQueryClient();

  return useMutation<AdminPermissionAssignment, ApiClientError, AssignmentMutationInput>({
    mutationFn: (input) => assignAdminPermission(input),
    // POST here is not idempotent (a second identical call is a
    // conflict, per ASSIGNMENT_DUPLICATE) — no auto-retry.
    retry: false,
    onSuccess: (assignment) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.adminPermissions.assignments.forPrincipal(assignment.principalId),
      });
    },
  });
}

/** Revokes a Permission from a principal. Idempotent server-side, so transient failures retry safely. */
export function useRevokeAdminPermission() {
  const queryClient = useQueryClient();

  return useMutation<{ revoked: boolean }, ApiClientError, AssignmentMutationInput>({
    mutationFn: (input) => revokeAdminPermission(input),
    retry: (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.adminPermissions.assignments.forPrincipal(variables.principalId),
      });
    },
  });
}

/**
 * Evaluates an Authorization Decision for an arbitrary (principal,
 * resource, action) triple. One-shot — never cached (the same request
 * can legitimately produce different decisions moments apart as
 * Assignments/lifecycle status change), so this is a mutation rather
 * than a query even though it doesn't itself write anything.
 */
export function useEvaluateAdminPermission() {
  return useMutation<EvaluationResult, ApiClientError, EvaluatePermissionInput>({
    mutationFn: (input) => evaluateAdminPermission(input),
    retry: false,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MUTATIONS — Governance (WP-ADMIN-05C)
// ─────────────────────────────────────────────────────────────────────────────

const GOVERNANCE_TRANSITION_FN = {
  approve: approveAdminPermission,
  publish: publishAdminPermission,
  adopt: adoptAdminPermission,
  deprecate: deprecateAdminPermission,
  retire: retireAdminPermission,
} as const;

export type GovernanceTransitionStage = keyof typeof GOVERNANCE_TRANSITION_FN;

export interface GovernanceTransitionInput {
  id: string;
  stage: GovernanceTransitionStage;
}

/**
 * Advances a Permission one step through the certified Governance
 * Lifecycle (approve/publish/adopt/deprecate/retire). No lifecycle rule
 * lives here — a request for an illegal transition is rejected by the
 * backend (422 GOVERNANCE_INVALID_LIFECYCLE_TRANSITION) and surfaces as
 * an ApiClientError, exactly like any other domain error from this
 * module. On success, invalidates both this Permission's detail query
 * (by identity, from the response) and the Registry list, since the
 * catalog's status column also reflects this Permission's new stage.
 */
export function useGovernanceTransition() {
  const queryClient = useQueryClient();

  return useMutation<AdminPermission, ApiClientError, GovernanceTransitionInput>({
    mutationFn: ({ id, stage }) => GOVERNANCE_TRANSITION_FN[stage](id),
    // Not idempotent (a second identical call is a lifecycle-order
    // conflict, not a transient failure) — no auto-retry, mirroring
    // useAssignAdminPermission()'s POST above.
    retry: false,
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminPermissions.registry.detail(updated.identity) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminPermissions.registry.all() });
      // WP-ADMIN-05D — a Governance transition writes a new admin_logs
      // row (permissionGovernance.integration.js's fire-and-forget
      // logAdminAction()), so this Permission's History timeline is now
      // stale too. Invalidated by root (not a specific params key) since
      // the History query key includes the caller's filter/pagination
      // params, which this hook has no visibility into.
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminPermissions.history.all() });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERIES — History (WP-ADMIN-05D)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One Permission's unified Assignment + Governance timeline (Permission
 * Detail page), most recent first unless `params.sort === 'asc'`.
 * Disabled until `id` is provided, mirroring `useAdminPermissionDetail`.
 * No history-assembly logic here — the response is exactly what
 * `GET /permissions/:id/history` returns.
 */
export function useAdminPermissionHistory(id: string | null, params: PermissionHistoryFilterParams = {}) {
  return useQuery<PermissionHistoryResponse, ApiClientError>({
    queryKey: queryKeys.adminPermissions.history.forPermission(id ?? '', params as Record<string, unknown>),
    queryFn: () => getAdminPermissionHistory(id as string, params),
    enabled: Boolean(id),
    retry: (failureCount, error) => shouldRetry(failureCount, error, 2),
    retryDelay,
    placeholderData: (previousData: PermissionHistoryResponse | undefined) => previousData, // keep old page visible while the next page loads
  });
}
