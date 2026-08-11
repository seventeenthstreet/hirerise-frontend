/**
 * @file lib/api/adminCmsCareerDomains.ts
 * @description Frontend API wrappers for the Admin CMS Career Domains module (WP-ADMIN-COMP-03).
 *
 * Backend contract (verified against adminCmsCareerDomains.module.js):
 *   GET    /api/v1/admin/cms/career-domains       → listAdminCareerDomains
 *          (returns a raw array — NO search, NO pagination, NO total count)
 *   POST   /api/v1/admin/cms/career-domains       → createAdminCareerDomain
 *   PUT    /api/v1/admin/cms/career-domains/:id   → updateAdminCareerDomain
 *   DELETE /api/v1/admin/cms/career-domains/:id   → deleteAdminCareerDomain (soft delete)
 */

import { apiRequest } from './core';

export type CareerDomainStatus = 'active' | 'inactive';

export interface AdminCareerDomain {
  id:                  string;
  name:                string;
  description:         string | null;
  normalized_name:     string;
  status:              CareerDomainStatus;
  created_by_admin_id: string | null;
  updated_by_admin_id: string | null;
  soft_deleted:        boolean;
  created_at:          string;
  updated_at:          string;
}

export interface CreateAdminCareerDomainInput {
  name:        string;
  description?: string;
}

export interface UpdateAdminCareerDomainInput {
  name?:        string;
  description?: string;
  status?:      CareerDomainStatus;
}

const BASE_URL = '/api/v1/admin/cms/career-domains';

/**
 * List all career domains. The backend returns every non-deleted row with no
 * server-side search or pagination — do not pass params it doesn't support.
 */
export function listAdminCareerDomains(): Promise<AdminCareerDomain[]> {
  return apiRequest<AdminCareerDomain[]>({
    url:    BASE_URL,
    method: 'GET',
  });
}

/** Create a career domain. Backend enforces normalized-name uniqueness (409 on duplicate). */
export function createAdminCareerDomain(input: CreateAdminCareerDomainInput): Promise<AdminCareerDomain> {
  return apiRequest<AdminCareerDomain>({
    url:    BASE_URL,
    method: 'POST',
    data:   input,
  });
}

/** Update a career domain. */
export function updateAdminCareerDomain(id: string, input: UpdateAdminCareerDomainInput): Promise<AdminCareerDomain> {
  return apiRequest<AdminCareerDomain>({
    url:    `${BASE_URL}/${id}`,
    method: 'PUT',
    data:   input,
  });
}

/** Archive (soft delete) a career domain. */
export function deleteAdminCareerDomain(id: string): Promise<null> {
  return apiRequest<null>({
    url:    `${BASE_URL}/${id}`,
    method: 'DELETE',
  });
}
