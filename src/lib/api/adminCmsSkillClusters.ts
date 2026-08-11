/**
 * @file lib/api/adminCmsSkillClusters.ts
 * @description Frontend API wrappers for the Admin CMS Skill Clusters module (WP-ADMIN-COMP-03).
 *
 * Backend contract (verified against adminCmsGeneric.factory.js, instantiated as
 * skillClustersModule with datasetType 'skillClusters'):
 *   GET    /api/v1/admin/cms/skill-clusters       → listAdminSkillClusters (status/limit/offset)
 *   POST   /api/v1/admin/cms/skill-clusters       → createAdminSkillCluster
 *   PATCH  /api/v1/admin/cms/skill-clusters/:id   → updateAdminSkillCluster
 *   DELETE /api/v1/admin/cms/skill-clusters/:id   → deleteAdminSkillCluster (soft delete)
 *
 * NOTE (documented, non-blocking defect): the generic factory's `list` response
 * sets `total: items.length` (current page length), not a true table count —
 * so this is NOT true server-side pagination. We fetch a single generously-sized
 * page and don't wire MasterDataPagination against `total`.
 *
 * domainId must be a real Career Domain id — fetch actual options via
 * lib/api/adminCmsCareerDomains, never hard-code them.
 */

import { apiRequest } from './core';

export interface AdminSkillCluster {
  id:                string;
  name:              string;
  normalizedName:    string;
  description:       string | null;
  status:            string;
  domainId:          string | null;
  createdByAdminId:  string | null;
  updatedByAdminId:  string | null;
  sourceAgency:      string | null;
  softDeleted:       boolean;
  createdAt:         string;
  updatedAt:         string;
}

export interface ListAdminSkillClustersParams {
  status?: string;
  limit?:  number;
  offset?: number;
}

export interface ListAdminSkillClustersResponse {
  items: AdminSkillCluster[];
  total: number;
}

export interface CreateAdminSkillClusterInput {
  name:        string;
  domainId:    string;
  description?: string;
}

export interface UpdateAdminSkillClusterInput {
  name?:        string;
  domainId?:    string;
  description?: string;
}

const BASE_URL = '/api/v1/admin/cms/skill-clusters';

export function listAdminSkillClusters(params?: ListAdminSkillClustersParams): Promise<ListAdminSkillClustersResponse> {
  return apiRequest<ListAdminSkillClustersResponse>({
    url:    BASE_URL,
    method: 'GET',
    params: params as Record<string, unknown>,
  });
}

/** Create a skill cluster. Backend enforces normalized-name uniqueness (409 on duplicate). */
export function createAdminSkillCluster(input: CreateAdminSkillClusterInput): Promise<AdminSkillCluster> {
  return apiRequest<AdminSkillCluster>({
    url:    BASE_URL,
    method: 'POST',
    data:   input,
  });
}

export function updateAdminSkillCluster(id: string, input: UpdateAdminSkillClusterInput): Promise<AdminSkillCluster> {
  return apiRequest<AdminSkillCluster>({
    url:    `${BASE_URL}/${id}`,
    method: 'PATCH',
    data:   input,
  });
}

export function deleteAdminSkillCluster(id: string): Promise<null> {
  return apiRequest<null>({
    url:    `${BASE_URL}/${id}`,
    method: 'DELETE',
  });
}
