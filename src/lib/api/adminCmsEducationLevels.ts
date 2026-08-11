/**
 * @file lib/api/adminCmsEducationLevels.ts
 * @description Frontend API wrappers for the Admin CMS Education Levels module (WP-ADMIN-COMP-03).
 *
 * Backend: generic factory instance (adminCmsGeneric.factory.js → educationLevelsModule),
 * allowedFields: ['description', 'sortOrder'].
 *
 *   GET    /api/v1/admin/cms/education-levels       → listAdminEducationLevels
 *   POST   /api/v1/admin/cms/education-levels       → createAdminEducationLevel
 *   PATCH  /api/v1/admin/cms/education-levels/:id   → updateAdminEducationLevel
 *   DELETE /api/v1/admin/cms/education-levels/:id   → deleteAdminEducationLevel (soft delete)
 */

import { apiRequest } from './core';

export interface AdminEducationLevel {
  id:                string;
  name:              string;
  normalizedName:    string;
  description:       string | null;
  sortOrder:         number | null;
  status:            string;
  createdByAdminId:  string | null;
  updatedByAdminId:  string | null;
  sourceAgency:      string | null;
  softDeleted:       boolean;
  createdAt:         string;
  updatedAt:         string;
}

export interface ListAdminEducationLevelsParams {
  status?: string;
  limit?:  number;
  offset?: number;
}

export interface ListAdminEducationLevelsResponse {
  items: AdminEducationLevel[];
  total: number;
}

export interface CreateAdminEducationLevelInput {
  name:        string;
  description?: string;
  sortOrder?:  number;
}

export interface UpdateAdminEducationLevelInput {
  name?:        string;
  description?: string;
  sortOrder?:  number;
}

const BASE_URL = '/api/v1/admin/cms/education-levels';

export function listAdminEducationLevels(params?: ListAdminEducationLevelsParams): Promise<ListAdminEducationLevelsResponse> {
  return apiRequest<ListAdminEducationLevelsResponse>({ url: BASE_URL, method: 'GET', params: params as Record<string, unknown> });
}

export function createAdminEducationLevel(input: CreateAdminEducationLevelInput): Promise<AdminEducationLevel> {
  return apiRequest<AdminEducationLevel>({ url: BASE_URL, method: 'POST', data: input });
}

export function updateAdminEducationLevel(id: string, input: UpdateAdminEducationLevelInput): Promise<AdminEducationLevel> {
  return apiRequest<AdminEducationLevel>({ url: `${BASE_URL}/${id}`, method: 'PATCH', data: input });
}

export function deleteAdminEducationLevel(id: string): Promise<null> {
  return apiRequest<null>({ url: `${BASE_URL}/${id}`, method: 'DELETE' });
}
