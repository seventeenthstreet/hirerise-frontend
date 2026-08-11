/**
 * @file lib/api/adminCmsJobFamilies.ts
 * @description Frontend API wrappers for the Admin CMS Job Families module (WP-ADMIN-COMP-03).
 *
 * Backend: generic factory instance (adminCmsGeneric.factory.js → jobFamiliesModule),
 * allowedFields: ['description'] only.
 *
 *   GET    /api/v1/admin/cms/job-families       → listAdminJobFamilies (status/limit/offset)
 *   POST   /api/v1/admin/cms/job-families       → createAdminJobFamily
 *   PATCH  /api/v1/admin/cms/job-families/:id   → updateAdminJobFamily
 *   DELETE /api/v1/admin/cms/job-families/:id   → deleteAdminJobFamily (soft delete)
 *
 * NOTE (documented, non-blocking defect, shared with Skill Clusters): the
 * factory's list `total` is `items.length` for the current page, not a true
 * table count — not real server-side pagination.
 */

import { apiRequest } from './core';

export interface AdminJobFamily {
  id:                string;
  name:              string;
  normalizedName:    string;
  description:       string | null;
  status:            string;
  createdByAdminId:  string | null;
  updatedByAdminId:  string | null;
  sourceAgency:      string | null;
  softDeleted:       boolean;
  createdAt:         string;
  updatedAt:         string;
}

export interface ListAdminJobFamiliesParams {
  status?: string;
  limit?:  number;
  offset?: number;
}

export interface ListAdminJobFamiliesResponse {
  items: AdminJobFamily[];
  total: number;
}

export interface CreateAdminJobFamilyInput {
  name:        string;
  description?: string;
}

export interface UpdateAdminJobFamilyInput {
  name?:        string;
  description?: string;
}

const BASE_URL = '/api/v1/admin/cms/job-families';

export function listAdminJobFamilies(params?: ListAdminJobFamiliesParams): Promise<ListAdminJobFamiliesResponse> {
  return apiRequest<ListAdminJobFamiliesResponse>({ url: BASE_URL, method: 'GET', params: params as Record<string, unknown> });
}

export function createAdminJobFamily(input: CreateAdminJobFamilyInput): Promise<AdminJobFamily> {
  return apiRequest<AdminJobFamily>({ url: BASE_URL, method: 'POST', data: input });
}

export function updateAdminJobFamily(id: string, input: UpdateAdminJobFamilyInput): Promise<AdminJobFamily> {
  return apiRequest<AdminJobFamily>({ url: `${BASE_URL}/${id}`, method: 'PATCH', data: input });
}

export function deleteAdminJobFamily(id: string): Promise<null> {
  return apiRequest<null>({ url: `${BASE_URL}/${id}`, method: 'DELETE' });
}
