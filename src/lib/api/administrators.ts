/**
 * @file lib/api/administrators.ts
 * @description Frontend API wrappers for Enterprise Administrator Management (WP-ADMIN-05A).
 *
 * Backend contract:
 *   GET  /api/v1/admin/administrators                  → listAdministrators
 *   GET  /api/v1/admin/administrators/:uid              → getAdministrator
 *   POST /api/v1/admin/administrators/:uid/grant        → grantAdministrator
 *   POST /api/v1/admin/administrators/:uid/suspend      → suspendAdministrator
 *   POST /api/v1/admin/administrators/:uid/reactivate   → reactivateAdministrator
 *   POST /api/v1/admin/administrators/:uid/revoke       → revokeAdministrator
 *
 * Mirrors the shape of lib/api/adminUsers.ts (list + detail + mutation
 * pattern). Every lifecycle mutation here is a thin call to the backend's
 * Administrator Management API, which itself only ever calls the certified
 * Administrator Lifecycle repository — no lifecycle rule is encoded here or
 * in the backend transport layer.
 */

import { apiRequest } from './core';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES — mirror the backend's camelCase response shape exactly
// (administrators.service.js#toDirectoryItem / #toDetail)
// ─────────────────────────────────────────────────────────────────────────────

/** Lifecycle states — mirrors domain/admin/lifecycle/adminLifecycle.states.js STATES. */
export const ADMINISTRATOR_STATUSES = ['active', 'suspended', 'revoked', 'expired'] as const;
export type AdministratorStatus = (typeof ADMINISTRATOR_STATUSES)[number];

/** Roles assignable to an Administrator principal — mirrors admin_principals_role_check. */
export const ADMINISTRATOR_ROLES = ['admin', 'super_admin', 'MASTER_ADMIN'] as const;
export type AdministratorRole = (typeof ADMINISTRATOR_ROLES)[number];

/** One row in the Administrator Directory. `id` aliases `uid` so this plugs directly into MasterDataTable. */
export interface AdministratorListItem {
  id: string;
  uid: string;
  role: string;
  status: AdministratorStatus;
  email: string | null;
  displayName: string | null;
  grantedBy: string | null;
  grantedAt: string | null;
  verifiedAt: string | null;
  lastActionAt: string | null;
}

/** A single lifecycle audit event, read from the existing admin_logs table. */
export interface AdministratorLifecycleEvent {
  action: string;
  actorId: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

/** Full Administrator Detail payload. */
export interface AdministratorDetail extends AdministratorListItem {
  revokedAt: string | null;
  revokedBy: string | null;
  suspendedAt: string | null;
  suspendedBy: string | null;
  suspensionReason: string | null;
  reactivatedAt: string | null;
  reactivatedBy: string | null;
  expiresAt: string | null;
  lifecycleHistory: AdministratorLifecycleEvent[];
}

/** GET /admin/administrators query params. */
export interface ListAdministratorsParams {
  limit?: number;
  offset?: number;
  search?: string;
  status?: AdministratorStatus;
}

/** GET /admin/administrators response — matches the controller's `{ items, total }` payload. */
export interface ListAdministratorsResponse {
  items: AdministratorListItem[];
  total: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = '/api/v1/admin/administrators';

// Every list row is normalized to carry `id` (aliasing `uid`) so callers
// never need to remember which field name MasterDataTable expects.
function withId<T extends { uid: string }>(row: T): T & { id: string } {
  return { ...row, id: row.uid };
}

/** List Administrators with server-side pagination, search, and status filter. */
export async function listAdministrators(
  params?: ListAdministratorsParams
): Promise<ListAdministratorsResponse> {
  const res = await apiRequest<{ items: Omit<AdministratorListItem, 'id'>[]; total: number }>({
    url: BASE_URL,
    method: 'GET',
    params: params as Record<string, unknown>,
  });
  return { items: res.items.map(withId), total: res.total };
}

/** Fetch a single Administrator's detail, including lifecycle history. */
export async function getAdministrator(uid: string): Promise<AdministratorDetail> {
  const res = await apiRequest<Omit<AdministratorDetail, 'id'>>({
    url: `${BASE_URL}/${uid}`,
    method: 'GET',
  });
  return withId(res);
}

/** Grant Administrator access (creates or re-activates the principal). */
export async function grantAdministrator(uid: string, role: AdministratorRole): Promise<AdministratorDetail> {
  const res = await apiRequest<Omit<AdministratorDetail, 'id'>>({
    url: `${BASE_URL}/${uid}/grant`,
    method: 'POST',
    data: { role },
  });
  return withId(res);
}

/** Suspend an active Administrator (reversible via reactivate). */
export async function suspendAdministrator(uid: string, reason?: string): Promise<AdministratorDetail> {
  const res = await apiRequest<Omit<AdministratorDetail, 'id'>>({
    url: `${BASE_URL}/${uid}/suspend`,
    method: 'POST',
    data: reason ? { reason } : {},
  });
  return withId(res);
}

/** Reactivate a suspended Administrator. */
export async function reactivateAdministrator(uid: string): Promise<AdministratorDetail> {
  const res = await apiRequest<Omit<AdministratorDetail, 'id'>>({
    url: `${BASE_URL}/${uid}/reactivate`,
    method: 'POST',
  });
  return withId(res);
}

/** Revoke an Administrator's access permanently (terminal). */
export async function revokeAdministrator(uid: string): Promise<AdministratorDetail> {
  const res = await apiRequest<Omit<AdministratorDetail, 'id'>>({
    url: `${BASE_URL}/${uid}/revoke`,
    method: 'POST',
  });
  return withId(res);
}
