/**
 * @file lib/api/roles.ts
 * @description Frontend API wrappers for the Roles module.
 *
 * Endpoints:
 *   GET /api/v1/roles          → getRoles
 *   GET /api/v1/roles/:roleId  → getRoleDetails
 */

import { apiRequest } from './core';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** A single role as surfaced by the backend. */
export type Role = {
  id:             string;
  title:          string;
  category:       string | null;
  aliases:        string[];
  seniorityLevel: string | null;
  active:         boolean;
  createdAt:      string;
  updatedAt:      string;
};

/** Optional filters accepted by GET /api/v1/roles */
export type GetRolesParams = {
  search?:   string;
  category?: string;
  limit?:    number;
};

/** Response from GET /api/v1/roles */
export type GetRolesResponse = {
  roles: Role[];
  total: number;
};

/**
 * Response from GET /api/v1/roles/:roleId
 * Backend nests the record under a `role` key — preserved as-is.
 */
export type GetRoleDetailsResponse = {
  role: Role;
};

// ─────────────────────────────────────────────────────────────────────────────
// FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch a list of roles, optionally filtered by search term or category.
 *
 * @param params.search   - Free-text role name filter.
 * @param params.category - Filter by role family / category.
 * @param params.limit    - Max results to return (default: 20, max: 50).
 */
export function getRoles(params?: GetRolesParams): Promise<GetRolesResponse> {
  return apiRequest<GetRolesResponse>({
    url:    '/roles',
    method: 'GET',
    params: params as Record<string, unknown>,
  });
}

/**
 * Fetch full details for a single role by its ID.
 *
 * @param roleId - The role's unique identifier.
 */
export function getRoleDetails(roleId: string): Promise<GetRoleDetailsResponse> {
  return apiRequest<GetRoleDetailsResponse>({
    url:    `/roles/${roleId}`,
    method: 'GET',
  });
}