/**
 * @file lib/api/adminCmsRoles.ts
 * @description Frontend API wrappers for the Admin CMS Roles module (WP-ADMIN-COMP-03).
 *
 * Backend contract (verified against adminCmsRoles.routes.js / .controller.js / .service.js):
 *   GET   /api/v1/admin/cms/roles         → listAdminRoles (limit + jobFamilyId filter only —
 *                                            NO search, NO offset/pagination, NO status filter)
 *   POST  /api/v1/admin/cms/roles         → createAdminRole
 *   PATCH /api/v1/admin/cms/roles/:roleId → updateAdminRole
 *
 * There is NO DELETE route for CMS Roles. Do not add one here or expose an
 * archive/delete action in the UI — the backend genuinely does not support it.
 *
 * Naming: this module is `adminCmsRoles` (not `roles`) because `lib/api/roles.ts`
 * already exists for the unrelated application Roles catalogue (/api/v1/roles).
 */

import { apiRequest } from './core';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES — mirror the backend's camelCase response shape (adminCmsRoles.repository)
// ─────────────────────────────────────────────────────────────────────────────

export type RoleTrack = 'individual_contributor' | 'management' | 'specialist';

export interface AdminCmsRole {
  id:                 string;
  name:               string;
  jobFamilyId:        string;
  level:              string | null;
  track:              RoleTrack | null;
  description:        string | null;
  alternativeTitles:  string[];
  status:              string;
  createdByAdminId:   string | null;
  updatedByAdminId:   string | null;
  sourceAgency:       string | null;
  softDeleted:        boolean;
  createdAt:          string;
  updatedAt:          string;
}

/** GET /admin/cms/roles query params — backend only supports these two. */
export interface ListAdminCmsRolesParams {
  limit?:       number;
  jobFamilyId?: string;
}

export interface ListAdminCmsRolesResponse {
  items: AdminCmsRole[];
  total: number;
}

/** Payload accepted by POST /admin/cms/roles — jobFamilyId is required by the backend. */
export interface CreateAdminCmsRoleInput {
  name:               string;
  jobFamilyId:        string;
  level?:             string;
  track?:             RoleTrack;
  description?:       string;
  alternativeTitles?: string[];
}

/** Payload accepted by PATCH /admin/cms/roles/:roleId — all fields optional. */
export interface UpdateAdminCmsRoleInput {
  name?:               string;
  jobFamilyId?:        string;
  level?:              string;
  track?:              RoleTrack;
  description?:        string;
  alternativeTitles?:  string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = '/api/v1/admin/cms/roles';

/** List roles. Server supports only `limit` + `jobFamilyId` filtering — no search, no offset. */
export function listAdminCmsRoles(params?: ListAdminCmsRolesParams): Promise<ListAdminCmsRolesResponse> {
  return apiRequest<ListAdminCmsRolesResponse>({
    url:    BASE_URL,
    method: 'GET',
    params: params as Record<string, unknown>,
  });
}

/** Create a role. Backend enforces (name, jobFamilyId) composite-key uniqueness (409 on duplicate). */
export function createAdminCmsRole(input: CreateAdminCmsRoleInput): Promise<AdminCmsRole> {
  return apiRequest<AdminCmsRole>({
    url:    BASE_URL,
    method: 'POST',
    data:   input,
  });
}

/** Update a role. */
export function updateAdminCmsRole(roleId: string, input: UpdateAdminCmsRoleInput): Promise<AdminCmsRole> {
  return apiRequest<AdminCmsRole>({
    url:    `${BASE_URL}/${roleId}`,
    method: 'PATCH',
    data:   input,
  });
}
