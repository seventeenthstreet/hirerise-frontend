/**
 * @file lib/api/adminPermissions.ts
 * @description Frontend API wrappers for the certified Enterprise
 * Permission Administration API (WP-ADMIN-04F-08). WP-ADMIN-04F-09 —
 * Enterprise Permission Management UI's presentation layer consumes
 * this module only; it never talks to the Registry, Assignment Service,
 * or Evaluation Engine directly, and never reimplements any of their
 * logic here — this file forwards request/response shapes 1:1.
 *
 * Backend contract (audited from core/src/modules/admin/permissions/):
 *   GET    /api/v1/admin/permissions/registry                        → listPermissions
 *   GET    /api/v1/admin/permissions/registry/:id                     → getPermissionById
 *   GET    /api/v1/admin/permissions/registry/identity/:identity      → getPermissionByIdentity
 *   GET    /api/v1/admin/permissions/registry/resource/:resource      → findPermissionsByResource
 *   GET    /api/v1/admin/permissions/registry/action/:action          → findPermissionsByAction
 *   GET    /api/v1/admin/permissions/registry/category/:category      → findPermissionsByCategory
 *   POST   /api/v1/admin/permissions/assignments                      → assignPermission
 *   DELETE /api/v1/admin/permissions/assignments                      → revokePermission
 *   GET    /api/v1/admin/permissions/assignments/check                → checkAssignment
 *   GET    /api/v1/admin/permissions/assignments/principal/:principalId → getAssignmentsForPrincipal
 *   POST   /api/v1/admin/permissions/evaluate                         → evaluatePermission
 *   POST   /api/v1/admin/permissions/:id/approve                      → approveAdminPermission   (WP-ADMIN-05C)
 *   POST   /api/v1/admin/permissions/:id/publish                      → publishAdminPermission   (WP-ADMIN-05C)
 *   POST   /api/v1/admin/permissions/:id/adopt                        → adoptAdminPermission     (WP-ADMIN-05C)
 *   POST   /api/v1/admin/permissions/:id/deprecate                    → deprecateAdminPermission (WP-ADMIN-05C)
 *   POST   /api/v1/admin/permissions/:id/retire                       → retireAdminPermission    (WP-ADMIN-05C)
 *   GET    /api/v1/admin/permissions/:id/history                       → getAdminPermissionHistory (WP-ADMIN-05D)
 *
 * NOT wrapped here (deliberately — no client capability exists for
 * them and none is being added): `GET /assignments` (requires resource
 * AND action query params server-side; no "list all assignments"
 * capability exists, so there is nothing for a catalog-style UI to call).
 * `GET /permissions/history` (the cross-Permission audit view) exists
 * server-side (WP-ADMIN-05D) but has no page that needs an
 * every-Permission timeline yet — every consumer of History today is
 * the single-Permission Detail page, via getAdminPermissionHistory()
 * below.
 *
 * Registry Discovery has NO free-text search or sort parameter — only
 * pagination (limit/offset) plus the three single-dimension lookups
 * above. Per WP-ADMIN-04F-09's audit: the Catalog page filters via these
 * three lookups (dropdowns), never via a fabricated client-side search.
 *
 * Mirrors the shape of lib/api/adminUsers.ts (one function per endpoint,
 * typed request/response, no logic) — the established pattern for admin
 * list + detail + mutation modules in this codebase.
 */

import { apiRequest } from './core';

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS — Permission Status is the certified, fixed AUTH-04 §6
// lifecycle vocabulary (kept here for PermissionStatusBadge.tsx's
// label/color mapping). It is NOT part of the Resource/Action/Category
// catalog: as of WP-ADMIN-04F-13B those hardcoded arrays
// (`PERMISSION_RESOURCES` / `PERMISSION_ACTIONS` / `PERMISSION_CATEGORIES`)
// were removed — the Registry (via `listAdminPermissions()` /
// `findAdminPermissionsBy*()` below) is now the only Permission
// vocabulary source. See hooks/admin/usePermissionsAdmin.ts's
// `useAdminPermissionVocabulary`.
// ─────────────────────────────────────────────────────────────────────────────

const PERMISSION_STATUSES = ['proposed', 'approved', 'published', 'adopted', 'deprecated', 'retired'] as const;
export type PermissionStatus = (typeof PERMISSION_STATUSES)[number];

// ─────────────────────────────────────────────────────────────────────────────
// TYPES — mirror the backend's camelCase response shapes exactly.
// ─────────────────────────────────────────────────────────────────────────────

/** Lifecycle Visibility positioning for a Permission (AUTH-04 §6), as returned by
 * `describeLifecycleStage()` (permission.registry.lifecycle.js). */
export interface LifecycleStage {
  status: string;
  label: string;
  stageIndex: number;
  isTerminal: boolean;
}

/** A single Permission Registry entry (permission.registry.js's `_toRegistryEntry()`). */
export interface AdminPermission {
  id: string;
  identity: string;
  name: string;
  resource: string;
  action: string;
  category: string | null;
  status: string;
  description: string | null;
  capabilityOwner: string | null;
  lifecycleStage: LifecycleStage | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListAdminPermissionsParams {
  limit?: number;
  offset?: number;
  /**
   * WP-ADMIN-04F-13B — additive Registry Discovery filter. When true,
   * only Permissions the certified Assignment Policy currently
   * considers assignable (PUBLISHED / ADOPTED) are returned. Omitted,
   * every endpoint behaves exactly as before this WP.
   */
  assignableOnly?: boolean;
}

export interface ListAdminPermissionsResponse {
  items: AdminPermission[];
  total: number;
}

/** A single Permission Assignment (permission.assignment.model.js's `createAssignment()`). */
export interface AdminPermissionAssignment {
  assignmentIdentity: string;
  principalId: string;
  permissionIdentity: string;
  resource: string;
  action: string;
  assignedAt: string;
}

export interface AssignmentMutationInput {
  principalId: string;
  resource: string;
  action: string;
}

export interface EvaluatePermissionInput {
  principalId: string;
  resource: string;
  action: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

/** Result of POST /evaluate — permission.evaluation.engine.js's EvaluationResult. */
export interface EvaluationResult {
  decision: {
    outcome: 'allow' | 'deny';
    context: {
      userId: string;
      resource: string;
      action: string;
      resourceId: string | null;
      metadata: Record<string, unknown>;
    };
    reason: string | null;
    decidedAt: string;
  };
  explanation: {
    permission: string;
    resource: string;
    action: string;
    decision: 'allow' | 'deny';
    reason: string | null;
    metadata: {
      permissionStatus: string;
      lifecycleStage: LifecycleStage | null;
      category: string | null;
      deprecated: boolean;
    };
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = '/api/v1/admin/permissions';

/** Paginated Permission catalog. No search/sort — see file header. */
export function listAdminPermissions(params?: ListAdminPermissionsParams): Promise<ListAdminPermissionsResponse> {
  return apiRequest<ListAdminPermissionsResponse>({
    url: `${BASE_URL}/registry`,
    method: 'GET',
    params: params as Record<string, unknown>,
  });
}

/** Single Permission by its stable identity (`resource:action`). Used by the Detail page. */
export function getAdminPermissionByIdentity(identity: string): Promise<AdminPermission> {
  return apiRequest<AdminPermission>({
    url: `${BASE_URL}/registry/identity/${encodeURIComponent(identity)}`,
    method: 'GET',
  });
}

/** One Registry-Discovery dimension filter — Catalog page's Resource dropdown. */
export function findAdminPermissionsByResource(
  resource: string,
  params?: ListAdminPermissionsParams,
): Promise<ListAdminPermissionsResponse> {
  return apiRequest<ListAdminPermissionsResponse>({
    url: `${BASE_URL}/registry/resource/${encodeURIComponent(resource)}`,
    method: 'GET',
    params: params as Record<string, unknown>,
  });
}

/** One Registry-Discovery dimension filter — Catalog page's Action dropdown. */
export function findAdminPermissionsByAction(
  action: string,
  params?: ListAdminPermissionsParams,
): Promise<ListAdminPermissionsResponse> {
  return apiRequest<ListAdminPermissionsResponse>({
    url: `${BASE_URL}/registry/action/${encodeURIComponent(action)}`,
    method: 'GET',
    params: params as Record<string, unknown>,
  });
}

/** One Registry-Discovery dimension filter — Catalog page's Category dropdown. */
export function findAdminPermissionsByCategory(
  category: string,
  params?: ListAdminPermissionsParams,
): Promise<ListAdminPermissionsResponse> {
  return apiRequest<ListAdminPermissionsResponse>({
    url: `${BASE_URL}/registry/category/${encodeURIComponent(category)}`,
    method: 'GET',
    params: params as Record<string, unknown>,
  });
}

/** All Assignments held by one principal — Assignment UI's "principal assignment list". */
export function getAdminAssignmentsForPrincipal(principalId: string): Promise<{ assignments: AdminPermissionAssignment[] }> {
  return apiRequest<{ assignments: AdminPermissionAssignment[] }>({
    url: `${BASE_URL}/assignments/principal/${encodeURIComponent(principalId)}`,
    method: 'GET',
  });
}

/** Grants a Permission to a principal. */
export function assignAdminPermission(input: AssignmentMutationInput): Promise<AdminPermissionAssignment> {
  return apiRequest<AdminPermissionAssignment>({
    url: `${BASE_URL}/assignments`,
    method: 'POST',
    data: input,
  });
}

/** Revokes a Permission from a principal. Idempotent server-side (repeat revoke is a no-op). */
export function revokeAdminPermission(input: AssignmentMutationInput): Promise<{ revoked: boolean }> {
  return apiRequest<{ revoked: boolean }>({
    url: `${BASE_URL}/assignments`,
    method: 'DELETE',
    data: input,
  });
}

/** Evaluates an Authorization Decision for an arbitrary (principal, resource, action) triple. */
export function evaluateAdminPermission(input: EvaluatePermissionInput): Promise<EvaluationResult> {
  return apiRequest<EvaluationResult>({
    url: `${BASE_URL}/evaluate`,
    method: 'POST',
    data: input,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// GOVERNANCE — WP-ADMIN-05C. One function per certified Governance
// Lifecycle stage (AUTH-04 §6: Proposal -> Approval -> Publication ->
// Adoption -> Deprecation -> Retirement). Every call returns the updated
// Permission Registry entry — the same `AdminPermission` shape as
// `getAdminPermissionByIdentity` — so no new frontend type is needed.
// Legality of the requested transition (forward-only, no skipping, no
// acting on a retired Permission) is decided exclusively by the backend
// Governance service; this file never validates a transition itself.
// ─────────────────────────────────────────────────────────────────────────────

function transitionAdminPermission(id: string, stage: 'approve' | 'publish' | 'adopt' | 'deprecate' | 'retire'): Promise<AdminPermission> {
  return apiRequest<AdminPermission>({
    url: `${BASE_URL}/${encodeURIComponent(id)}/${stage}`,
    method: 'POST',
  });
}

/** Proposal -> Approval. */
export function approveAdminPermission(id: string): Promise<AdminPermission> {
  return transitionAdminPermission(id, 'approve');
}

/** Approval -> Publication. */
export function publishAdminPermission(id: string): Promise<AdminPermission> {
  return transitionAdminPermission(id, 'publish');
}

/** Publication -> Adoption. */
export function adoptAdminPermission(id: string): Promise<AdminPermission> {
  return transitionAdminPermission(id, 'adopt');
}

/** Adoption -> Deprecation. */
export function deprecateAdminPermission(id: string): Promise<AdminPermission> {
  return transitionAdminPermission(id, 'deprecate');
}

/** Deprecation -> Retirement (terminal — no further transition is possible). */
export function retireAdminPermission(id: string): Promise<AdminPermission> {
  return transitionAdminPermission(id, 'retire');
}

/** The certified Governance Lifecycle stage order (AUTH-04 §6), for UI "what's next" display only — never used to validate a transition (the backend is authoritative). */
export const GOVERNANCE_NEXT_STAGE: Record<string, { stage: 'approve' | 'publish' | 'adopt' | 'deprecate' | 'retire'; label: string } | undefined> = {
  proposed: { stage: 'approve', label: 'Approve' },
  approved: { stage: 'publish', label: 'Publish' },
  published: { stage: 'adopt', label: 'Adopt' },
  adopted: { stage: 'deprecate', label: 'Deprecate' },
  deprecated: { stage: 'retire', label: 'Retire' },
};

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY — WP-ADMIN-05D. Read-only Permission audit timeline, unifying
// the Assignment (WP-ADMIN-05B) and Governance (WP-ADMIN-05C) audit
// events already written to the certified `admin_logs` table — this
// module introduces no new audit mechanism, just a reader.
// ─────────────────────────────────────────────────────────────────────────────

/** The 7 certified Permission audit actions (permissionAudit.constants.js's ACTIONS). */
export const PERMISSION_HISTORY_ACTIONS = [
  'PERMISSION_ASSIGNED',
  'PERMISSION_REVOKED',
  'PERMISSION_APPROVED',
  'PERMISSION_PUBLISHED',
  'PERMISSION_ADOPTED',
  'PERMISSION_DEPRECATED',
  'PERMISSION_RETIRED',
] as const;
export type PermissionHistoryAction = (typeof PERMISSION_HISTORY_ACTIONS)[number];

/** One unified Assignment + Governance timeline event (permissionHistory.integration.js's toHistoryEvent()). */
export interface PermissionHistoryEvent {
  id: string;
  action: string;
  adminId: string | null;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  occurredAt: string;
}

export interface PermissionHistoryFilterParams {
  limit?: number;
  offset?: number;
  action?: PermissionHistoryAction;
  adminId?: string;
  /** ISO 8601 date/datetime, inclusive lower bound. */
  dateFrom?: string;
  /** ISO 8601 date/datetime, inclusive upper bound. */
  dateTo?: string;
  sort?: 'asc' | 'desc';
}

export interface PermissionHistoryResponse {
  permission: { id: string; identity: string };
  items: PermissionHistoryEvent[];
  total: number;
}

/** One Permission's unified Assignment + Governance timeline (Permission Detail page). */
export function getAdminPermissionHistory(id: string, params?: PermissionHistoryFilterParams): Promise<PermissionHistoryResponse> {
  return apiRequest<PermissionHistoryResponse>({
    url: `${BASE_URL}/${encodeURIComponent(id)}/history`,
    method: 'GET',
    params: params as Record<string, unknown>,
  });
}