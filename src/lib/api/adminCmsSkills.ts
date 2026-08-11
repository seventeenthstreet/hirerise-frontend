/**
 * @file lib/api/adminCmsSkills.ts
 * @description Frontend API wrappers for the Admin CMS Skills module (WP-ADMIN-02A).
 *
 * Backend contract (certified in WP-ADMIN-BE-01):
 *   GET    /api/v1/admin/cms/skills            → listAdminSkills
 *   GET    /api/v1/admin/cms/skills/:skillId    → getAdminSkill
 *   POST   /api/v1/admin/cms/skills             → createAdminSkill
 *   PATCH  /api/v1/admin/cms/skills/:skillId    → updateAdminSkill
 *   DELETE /api/v1/admin/cms/skills/:skillId    → deleteAdminSkill (soft delete)
 *
 * All routes require authenticate + requireAdmin (enforced server-side at the
 * mount point in server.js) — this module never sends admin identity in the
 * request body; the backend derives it from the JWT.
 *
 * This is the ONLY module that should build request configs for the Admin
 * CMS Skills endpoints. UI components and hooks must go through the
 * functions here rather than calling apiRequest directly, so the CRUD
 * framework this establishes (WP-ADMIN-02A) can be reused as-is by
 * Roles / Career Domains / Skill Clusters in later work packages.
 */

import { apiRequest } from './core';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES — mirror the backend's camelCase response shape exactly (adminCmsSkills.repository._toCamel)
// ─────────────────────────────────────────────────────────────────────────────

export type SkillCategory = 'technical' | 'soft' | 'domain' | 'tool' | 'language' | 'framework';

export interface AdminSkill {
  id:                string;
  name:              string;
  normalizedName:    string;
  category:          SkillCategory;
  aliases:           string[];
  description:       string | null;
  demandScore:       number | null;
  searchTokens:      string[];
  status:            string;
  createdByAdminId:  string | null;
  updatedByAdminId:  string | null;
  sourceAgency:      string | null;
  softDeleted:       boolean;
  createdAt:         string;
  updatedAt:         string;
}

/** GET /admin/cms/skills query params. */
export interface ListAdminSkillsParams {
  limit?:    number;
  offset?:   number;
  category?: SkillCategory;
  search?:   string;
}

/** GET /admin/cms/skills response — matches the controller's `{ items, total }` payload. */
export interface ListAdminSkillsResponse {
  items: AdminSkill[];
  total: number;
}

/** Payload accepted by POST /admin/cms/skills. */
export interface CreateAdminSkillInput {
  name:         string;
  category?:    SkillCategory;
  aliases?:     string[];
  description?: string;
  demandScore?: number;
}

/** Payload accepted by PATCH /admin/cms/skills/:skillId — all fields optional. */
export interface UpdateAdminSkillInput {
  name?:         string;
  category?:     SkillCategory;
  aliases?:      string[];
  description?:  string;
  demandScore?:  number;
}

export interface DeleteAdminSkillResponse {
  skillId:     string;
  softDeleted: true;
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = '/api/v1/admin/cms/skills';

/**
 * List skills with server-side pagination (offset/limit) and search.
 * Never fetches the full table client-side — filtering happens in Postgres.
 */
export function listAdminSkills(params?: ListAdminSkillsParams): Promise<ListAdminSkillsResponse> {
  return apiRequest<ListAdminSkillsResponse>({
    url:    BASE_URL,
    method: 'GET',
    params: params as Record<string, unknown>,
  });
}

/** Fetch a single skill by id (used for the detail/edit drawer). */
export function getAdminSkill(skillId: string): Promise<AdminSkill> {
  return apiRequest<AdminSkill>({
    url:    `${BASE_URL}/${skillId}`,
    method: 'GET',
  });
}

/** Create a new skill. Backend enforces name-uniqueness (409 on duplicate). */
export function createAdminSkill(input: CreateAdminSkillInput): Promise<AdminSkill> {
  return apiRequest<AdminSkill>({
    url:    BASE_URL,
    method: 'POST',
    data:   input,
  });
}

/** Partially update a skill. Only send the fields that changed. */
export function updateAdminSkill(skillId: string, input: UpdateAdminSkillInput): Promise<AdminSkill> {
  return apiRequest<AdminSkill>({
    url:    `${BASE_URL}/${skillId}`,
    method: 'PATCH',
    data:   input,
  });
}

/** Soft-delete (archive) a skill. Never a hard delete — see backend service. */
export function deleteAdminSkill(skillId: string): Promise<DeleteAdminSkillResponse> {
  return apiRequest<DeleteAdminSkillResponse>({
    url:    `${BASE_URL}/${skillId}`,
    method: 'DELETE',
  });
}
