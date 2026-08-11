/**
 * @file lib/api/adminUsers.ts
 * @description Frontend API wrappers for the Admin User Directory.
 * WP-ADMIN-04 Phase 1B (read-only); detail payload extended by WP-ADMIN-04C;
 * first write function (role update) added by WP-ADMIN-04E.
 *
 * Backend contract:
 *   GET   /api/v1/admin/users                       → listAdminUsers    (WP-ADMIN-04 Phase 1B)
 *   GET   /api/v1/admin/users/:userId               → getAdminUser      (WP-ADMIN-04 Phase 1B)
 *   PATCH /api/v1/admin/users/:userId/role          → updateAdminUserRole          (WP-ADMIN-04E)
 *   PATCH /api/v1/admin/users/:userId/profile       → updateAdminUserProfile       (WP-ADMIN-COMP-04)
 *   PATCH /api/v1/admin/users/:userId/status        → updateAdminUserAccountStatus (WP-ADMIN-COMP-04)
 *   GET   /api/v1/admin/users/:userId/audit-history → getAdminUserAuditHistory     (WP-ADMIN-COMP-04)
 *
 * MFA reset, password reset, and session management remain out of scope —
 * per the WP-ADMIN-COMP-04 Repository Reconciliation, this codebase has no
 * user-facing MFA system, no password-reset flow (self-service or admin),
 * and no session-listing capability to build on; see that WP's Completion
 * Report for the repository evidence. A separate "Lock Account" action was
 * also not built — Supabase Auth's banned_until is the only authoritative
 * account-status mechanism this codebase has, so Enable/Disable above is
 * that single mechanism, not a second one alongside a "lock".
 *
 * Mirrors the shape of lib/api/adminCmsSkills.ts (the established pattern
 * for admin list + detail + update modules) per the WP-ADMIN-04 Phase 1A
 * audit and updateAdminSkill()'s PATCH-by-id shape.
 *
 * WP-ADMIN-04C: AdminUserDetail gains userType, careerGoal, targetRole,
 * experienceYears, industry, location, and updatedAt — all sourced from
 * pre-existing public.users columns (adminUsers.repository._toCamelDetail).
 * authenticationProvider, accountStatus, mfaStatus, and lastLogin remain
 * out of scope per WP-ADMIN-04C's explicit instruction not to introduce
 * Supabase Admin Auth lookups.
 */

import { apiRequest } from './core';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES — mirror the backend's camelCase response shape exactly (adminUsers.repository._toCamel / .service)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * WP-ADMIN-04E — the roles selectable in the role management UI. Mirrors
 * usersRepo.ROLES on the backend (adminUsers.repository.js), which in turn
 * mirrors public.users' own `users_role_check` CHECK constraint — that
 * backend list (validated via express-validator `isIn`) is the actual
 * source of truth and rejects anything outside it regardless of what the
 * UI offers; this array only drives which options the selector renders.
 */
export const ADMIN_USER_ROLES = ['user', 'admin', 'super_admin', 'MASTER_ADMIN', 'contributor'] as const;
export type AdminUserRole = (typeof ADMIN_USER_ROLES)[number];

/** Fields that exist in the Enterprise User Directory list view. */
export interface AdminUserListItem {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  createdAt: string;
}

/**
 * Fields shown on the User Detail page. authenticationProvider, accountStatus,
 * mfaStatus, and lastLogin are `null` whenever no existing API exposes that
 * data — the UI renders "Unavailable" for a null value. These are never
 * inferred or derived client-side.
 *
 * WP-ADMIN-04C: userType, careerGoal, targetRole, experienceYears, industry,
 * location, and updatedAt follow the same "null → Unavailable" contract —
 * they are `null` whenever the underlying public.users column is unset for
 * that user, never fabricated or derived.
 */
export interface AdminUserDetail extends AdminUserListItem {
  authenticationProvider: string | null;
  accountStatus: string | null;
  mfaStatus: string | null;
  lastLogin: string | null;
  updatedAt: string | null;
  userType: string | null;
  careerGoal: string | null;
  targetRole: string | null;
  experienceYears: number | null;
  industry: string | null;
  location: string | null;
}

/**
 * WP-ADMIN-COMP-04 — Edit Profile. Every field is optional (PATCH is
 * partial) and maps 1:1 to a pre-existing public.users column exposed on
 * AdminUserDetail — see adminUsers.repository.js's PROFILE_FIELDS for the
 * backend's mirror of this exact allow-list.
 */
export interface UpdateAdminUserProfileInput {
  displayName?: string;
  careerGoal?: string | null;
  targetRole?: string | null;
  experienceYears?: number | null;
  industry?: string | null;
  location?: string | null;
}

/** WP-ADMIN-COMP-04 — the only account-status action this codebase supports. */
export type AdminUserAccountAction = 'enable' | 'disable';

/** WP-ADMIN-COMP-04 — one admin_logs row, as returned by GET /:userId/audit-history. */
export interface AdminUserAuditEvent {
  id: string | number | null;
  adminId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/** GET /admin/users query params. */
export interface ListAdminUsersParams {
  limit?: number;
  offset?: number;
  search?: string;
}

/** GET /admin/users response — matches the controller's `{ items, total }` payload. */
export interface ListAdminUsersResponse {
  items: AdminUserListItem[];
  total: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = '/api/v1/admin/users';

/**
 * List users with server-side pagination (offset/limit) and search.
 * Never fetches the full table client-side — filtering happens in Postgres.
 */
export function listAdminUsers(params?: ListAdminUsersParams): Promise<ListAdminUsersResponse> {
  return apiRequest<ListAdminUsersResponse>({
    url: BASE_URL,
    method: 'GET',
    params: params as Record<string, unknown>,
  });
}

/** Fetch a single user's detail (User Detail page). */
export function getAdminUser(userId: string): Promise<AdminUserDetail> {
  return apiRequest<AdminUserDetail>({
    url: `${BASE_URL}/${userId}`,
    method: 'GET',
  });
}

/**
 * WP-ADMIN-04E — Update a user's application role. PATCH is idempotent
 * (same role twice is a no-op on the server), mirroring updateAdminSkill()'s
 * shape in lib/api/adminCmsSkills.ts. Returns the full updated detail
 * payload, same shape as getAdminUser().
 */
export function updateAdminUserRole(userId: string, role: AdminUserRole): Promise<AdminUserDetail> {
  return apiRequest<AdminUserDetail>({
    url: `${BASE_URL}/${userId}/role`,
    method: 'PATCH',
    data: { role },
  });
}

/**
 * WP-ADMIN-COMP-04 — Edit Profile. Sends only the fields the caller
 * provides; the backend rejects any key outside UpdateAdminUserProfileInput.
 */
export function updateAdminUserProfile(userId: string, fields: UpdateAdminUserProfileInput): Promise<AdminUserDetail> {
  return apiRequest<AdminUserDetail>({
    url: `${BASE_URL}/${userId}/profile`,
    method: 'PATCH',
    data: fields,
  });
}

/**
 * WP-ADMIN-COMP-04 — Enable/Disable Account. Backed by Supabase Auth's
 * banned_until (see adminUsers.repository.js#setAccountStatus) — there is
 * no separate "lock" action; see that file's doc comment for why.
 */
export function updateAdminUserAccountStatus(userId: string, action: AdminUserAccountAction): Promise<AdminUserDetail> {
  return apiRequest<AdminUserDetail>({
    url: `${BASE_URL}/${userId}/status`,
    method: 'PATCH',
    data: { action },
  });
}

/** WP-ADMIN-COMP-04 — View User Audit History, reading the existing admin_logs table. */
export function getAdminUserAuditHistory(userId: string, limit = 50): Promise<{ items: AdminUserAuditEvent[] }> {
  return apiRequest<{ items: AdminUserAuditEvent[] }>({
    url: `${BASE_URL}/${userId}/audit-history`,
    method: 'GET',
    params: { limit },
  });
}
