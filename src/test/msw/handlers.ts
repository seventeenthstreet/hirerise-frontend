/**
 * @file src/test/msw/handlers.ts
 * @description Default MSW handlers for the certified Permission
 * Administration API (WP-ADMIN-04F-08) and the Admin Users API (consumed
 * by PrincipalPicker). Individual test files override these with
 * `server.use(...)` for error-path scenarios — these defaults only cover
 * the happy path.
 */

import { http, HttpResponse } from 'msw';
import {
  PERMISSION_FIXTURES,
  ASSIGNMENT_FIXTURES,
  EVALUATION_ALLOW_RESULT,
  ADMIN_USER_FIXTURES,
  PERMISSION_HISTORY_FIXTURES,
  CAREER_DOMAIN_FIXTURES,
  ROLE_FIXTURES,
  SKILL_CLUSTER_FIXTURES,
  JOB_FAMILY_FIXTURES,
  EDUCATION_LEVEL_FIXTURES,
  SALARY_BENCHMARK_FIXTURES,
} from './fixtures';

// WP-ADMIN-COMP-04 — mutable, in-memory account-status map, reset per test
// file via resetAdminUserAccountStatus() (see below). Not exported from
// fixtures.ts since it's mutable test state, not a fixture. Defaults both
// fixture users to 'active' so AccountStatusRow has a valid next action
// (Disable) to test out of the box.
const DEFAULT_ADMIN_USER_ACCOUNT_STATUS: Record<string, 'active' | 'disabled'> = {
  'user-123': 'active',
  'user-456': 'active',
};
let ADMIN_USER_ACCOUNT_STATUS: Record<string, 'active' | 'disabled'> = { ...DEFAULT_ADMIN_USER_ACCOUNT_STATUS };

export function resetAdminUserAccountStatus() {
  ADMIN_USER_ACCOUNT_STATUS = { ...DEFAULT_ADMIN_USER_ACCOUNT_STATUS };
}

// WP-ADMIN-COMP-04 — audit-history fixture, keyed by userId.
const ADMIN_USER_AUDIT_HISTORY_FIXTURES: Record<string, Array<{
  id: number; adminId: string; action: string; entityType: string; entityId: string; metadata: Record<string, unknown>; createdAt: string;
}>> = {
  'user-123': [
    { id: 1, adminId: 'admin-1', action: 'USER_ROLE_UPDATED', entityType: 'user', entityId: 'user-123', metadata: { toRole: 'admin' }, createdAt: '2026-02-01T00:00:00.000Z' },
  ],
  'user-456': [],
};

const BASE = '/api/v1/admin/permissions';

// Mirrors the certified backend's DefaultAssignmentPolicy
// (permission.assignment.policy.js) — PUBLISHED/ADOPTED only — purely so
// this mock server's `assignableOnly=true` behaves like the real API.
// This is test-fixture plumbing, not a frontend copy of the policy: no
// application code imports or relies on this constant.
const MOCK_ASSIGNABLE_STATUSES = new Set(['published', 'adopted']);

function applyAssignableOnly(items: typeof PERMISSION_FIXTURES, request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get('assignableOnly') !== 'true') return items;
  return items.filter((item) => MOCK_ASSIGNABLE_STATUSES.has(item.status));
}

export const handlers = [
  http.get(`${BASE}/registry`, ({ request }) => {
    const items = applyAssignableOnly(PERMISSION_FIXTURES, request);
    return HttpResponse.json({ success: true, data: { items, total: items.length } });
  }),

  http.get(`${BASE}/registry/identity/:identity`, ({ params }) => {
    const entry = PERMISSION_FIXTURES.find((p) => p.identity === params.identity);
    if (!entry) {
      return HttpResponse.json(
        { success: false, error: { code: 'PERMISSION_NOT_FOUND', message: 'Not found.' }, meta: { requestId: null, timestamp: new Date().toISOString() } },
        { status: 404 },
      );
    }
    return HttpResponse.json({ success: true, data: entry });
  }),

  http.get(`${BASE}/registry/resource/:resource`, ({ params, request }) => {
    const items = applyAssignableOnly(PERMISSION_FIXTURES.filter((p) => p.resource === params.resource), request);
    return HttpResponse.json({ success: true, data: { items, total: items.length } });
  }),

  http.get(`${BASE}/registry/action/:action`, ({ params, request }) => {
    const items = applyAssignableOnly(PERMISSION_FIXTURES.filter((p) => p.action === params.action), request);
    return HttpResponse.json({ success: true, data: { items, total: items.length } });
  }),

  http.get(`${BASE}/registry/category/:category`, ({ params, request }) => {
    const items = applyAssignableOnly(PERMISSION_FIXTURES.filter((p) => p.category === params.category), request);
    return HttpResponse.json({ success: true, data: { items, total: items.length } });
  }),

  http.get(`${BASE}/assignments/principal/:principalId`, () => {
    return HttpResponse.json({ success: true, data: { assignments: ASSIGNMENT_FIXTURES } });
  }),

  http.post(`${BASE}/assignments`, () => {
    return HttpResponse.json(
      { success: true, data: { assignmentIdentity: 'user-123::user:view', principalId: 'user-123', permissionIdentity: 'user:view', resource: 'user', action: 'view', assignedAt: new Date().toISOString() } },
      { status: 201 },
    );
  }),

  http.delete(`${BASE}/assignments`, () => {
    return HttpResponse.json({ success: true, data: { revoked: true } });
  }),

  http.post(`${BASE}/evaluate`, () => {
    return HttpResponse.json({ success: true, data: EVALUATION_ALLOW_RESULT });
  }),

  // WP-ADMIN-05D — Enterprise Permission Audit & Governance History.
  http.get(`${BASE}/:id/history`, ({ params, request }) => {
    const permission = PERMISSION_FIXTURES.find((p) => p.id === params.id);
    if (!permission) {
      return HttpResponse.json(
        { success: false, error: { code: 'PERMISSION_NOT_FOUND', message: 'Not found.' }, meta: { requestId: null, timestamp: new Date().toISOString() } },
        { status: 404 },
      );
    }
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? PERMISSION_HISTORY_FIXTURES.length);
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const items = PERMISSION_HISTORY_FIXTURES.slice(offset, offset + limit);
    return HttpResponse.json({
      success: true,
      data: { permission: { id: permission.id, identity: permission.identity }, items, total: PERMISSION_HISTORY_FIXTURES.length },
    });
  }),

  http.get('/api/v1/admin/users', () => {
    return HttpResponse.json({ success: true, data: { items: ADMIN_USER_FIXTURES, total: ADMIN_USER_FIXTURES.length } });
  }),

  http.get('/api/v1/admin/users/:userId', ({ params }) => {
    const user = ADMIN_USER_FIXTURES.find((u) => u.id === params.userId);
    if (!user) {
      return HttpResponse.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: 'Not found.' }, meta: { requestId: null, timestamp: new Date().toISOString() } },
        { status: 404 },
      );
    }
    return HttpResponse.json({
      success: true,
      data: {
        ...user,
        authenticationProvider: null,
        accountStatus: ADMIN_USER_ACCOUNT_STATUS[params.userId as string] ?? null,
        mfaStatus: null,
        lastLogin: null,
        updatedAt: null,
        userType: null,
        careerGoal: null,
        targetRole: null,
        experienceYears: null,
        industry: null,
        location: null,
      },
    });
  }),

  // WP-ADMIN-COMP-04 — Edit Profile
  http.patch('/api/v1/admin/users/:userId/profile', async ({ params, request }) => {
    const user = ADMIN_USER_FIXTURES.find((u) => u.id === params.userId);
    if (!user) {
      return HttpResponse.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: 'Not found.' }, meta: { requestId: null, timestamp: new Date().toISOString() } },
        { status: 404 },
      );
    }
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      success: true,
      data: {
        ...user,
        displayName: (body.displayName as string) ?? user.displayName,
        authenticationProvider: null,
        accountStatus: ADMIN_USER_ACCOUNT_STATUS[params.userId as string] ?? null,
        mfaStatus: null,
        lastLogin: null,
        updatedAt: new Date().toISOString(),
        userType: null,
        careerGoal: (body.careerGoal as string | null) ?? null,
        targetRole: (body.targetRole as string | null) ?? null,
        experienceYears: (body.experienceYears as number | null) ?? null,
        industry: (body.industry as string | null) ?? null,
        location: (body.location as string | null) ?? null,
      },
    });
  }),

  // WP-ADMIN-COMP-04 — Enable/Disable Account. Stateful across requests in
  // a single test run so a Disable-then-refetch flow is faithfully
  // exercised, mirroring the real backend's Supabase Auth persistence.
  http.patch('/api/v1/admin/users/:userId/status', async ({ params, request }) => {
    const user = ADMIN_USER_FIXTURES.find((u) => u.id === params.userId);
    if (!user) {
      return HttpResponse.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: 'Not found.' }, meta: { requestId: null, timestamp: new Date().toISOString() } },
        { status: 404 },
      );
    }
    const body = (await request.json()) as { action: 'enable' | 'disable' };
    const newStatus = body.action === 'disable' ? 'disabled' : 'active';
    ADMIN_USER_ACCOUNT_STATUS[params.userId as string] = newStatus;

    return HttpResponse.json({
      success: true,
      data: {
        ...user,
        authenticationProvider: 'email',
        accountStatus: newStatus,
        mfaStatus: null,
        lastLogin: null,
        updatedAt: null,
        userType: null,
        careerGoal: null,
        targetRole: null,
        experienceYears: null,
        industry: null,
        location: null,
      },
    });
  }),

  // WP-ADMIN-COMP-04 — View User Audit History
  http.get('/api/v1/admin/users/:userId/audit-history', ({ params }) => {
    const user = ADMIN_USER_FIXTURES.find((u) => u.id === params.userId);
    if (!user) {
      return HttpResponse.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: 'Not found.' }, meta: { requestId: null, timestamp: new Date().toISOString() } },
        { status: 404 },
      );
    }
    return HttpResponse.json({
      success: true,
      data: { items: ADMIN_USER_AUDIT_HISTORY_FIXTURES[params.userId as string] ?? [] },
    });
  }),

  // ─────────────────────────────────────────────────────────────────────
  // WP-ADMIN-COMP-03 — CMS Master Data (Roles / Career Domains / Skill
  // Clusters / Job Families / Education Levels / Salary Benchmarks / Import)
  // ─────────────────────────────────────────────────────────────────────

  http.get('/api/v1/admin/cms/roles', () =>
    HttpResponse.json({ success: true, data: { items: ROLE_FIXTURES, total: ROLE_FIXTURES.length } })),
  http.post('/api/v1/admin/cms/roles', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      { success: true, data: { ...ROLE_FIXTURES[0], id: 'role-new', ...body } },
      { status: 201 },
    );
  }),
  http.patch('/api/v1/admin/cms/roles/:id', async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ success: true, data: { ...ROLE_FIXTURES[0], id: params.id, ...body } });
  }),

  http.get('/api/v1/admin/cms/career-domains', () =>
    HttpResponse.json({ success: true, data: CAREER_DOMAIN_FIXTURES })),
  http.post('/api/v1/admin/cms/career-domains', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      { success: true, data: { ...CAREER_DOMAIN_FIXTURES[0], id: 'cd-new', status: 'active', ...body } },
      { status: 201 },
    );
  }),
  http.put('/api/v1/admin/cms/career-domains/:id', async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ success: true, data: { ...CAREER_DOMAIN_FIXTURES[0], id: params.id, ...body } });
  }),
  http.delete('/api/v1/admin/cms/career-domains/:id', () =>
    HttpResponse.json({ success: true, data: null, message: 'Career domain deleted successfully' })),

  http.get('/api/v1/admin/cms/skill-clusters', () =>
    HttpResponse.json({ success: true, data: { items: SKILL_CLUSTER_FIXTURES, total: SKILL_CLUSTER_FIXTURES.length } })),
  http.post('/api/v1/admin/cms/skill-clusters', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      { success: true, data: { ...SKILL_CLUSTER_FIXTURES[0], id: 'sc-new', ...body } },
      { status: 201 },
    );
  }),
  http.patch('/api/v1/admin/cms/skill-clusters/:id', async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ success: true, data: { ...SKILL_CLUSTER_FIXTURES[0], id: params.id, ...body } });
  }),
  http.delete('/api/v1/admin/cms/skill-clusters/:id', () =>
    HttpResponse.json({ success: true, data: null })),

  http.get('/api/v1/admin/cms/job-families', () =>
    HttpResponse.json({ success: true, data: { items: JOB_FAMILY_FIXTURES, total: JOB_FAMILY_FIXTURES.length } })),
  http.post('/api/v1/admin/cms/job-families', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      { success: true, data: { ...JOB_FAMILY_FIXTURES[0], id: 'jf-new', ...body } },
      { status: 201 },
    );
  }),
  http.patch('/api/v1/admin/cms/job-families/:id', async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ success: true, data: { ...JOB_FAMILY_FIXTURES[0], id: params.id, ...body } });
  }),
  http.delete('/api/v1/admin/cms/job-families/:id', () =>
    HttpResponse.json({ success: true, data: null })),

  http.get('/api/v1/admin/cms/education-levels', () =>
    HttpResponse.json({ success: true, data: { items: EDUCATION_LEVEL_FIXTURES, total: EDUCATION_LEVEL_FIXTURES.length } })),
  http.post('/api/v1/admin/cms/education-levels', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      { success: true, data: { ...EDUCATION_LEVEL_FIXTURES[0], id: 'el-new', ...body } },
      { status: 201 },
    );
  }),
  http.patch('/api/v1/admin/cms/education-levels/:id', async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ success: true, data: { ...EDUCATION_LEVEL_FIXTURES[0], id: params.id, ...body } });
  }),
  http.delete('/api/v1/admin/cms/education-levels/:id', () =>
    HttpResponse.json({ success: true, data: null })),

  http.get('/api/v1/admin/cms/salary-benchmarks', () =>
    HttpResponse.json({ success: true, data: { items: SALARY_BENCHMARK_FIXTURES, total: SALARY_BENCHMARK_FIXTURES.length } })),
  http.post('/api/v1/admin/cms/salary-benchmarks', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      { success: true, data: { ...SALARY_BENCHMARK_FIXTURES[0], id: 'sb-new', ...body } },
      { status: 201 },
    );
  }),
  http.patch('/api/v1/admin/cms/salary-benchmarks/:id', async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ success: true, data: { ...SALARY_BENCHMARK_FIXTURES[0], id: params.id, ...body } });
  }),
  http.delete('/api/v1/admin/cms/salary-benchmarks/:id', () =>
    HttpResponse.json({ success: true, data: null })),

  http.post('/api/v1/admin/cms/import', async ({ request }) => {
    const body = (await request.json()) as { rows?: { name: string }[] };
    const rows = body.rows ?? [];
    return HttpResponse.json(
      {
        success: true,
        data: { total: rows.length, inserted: rows.length, skipped: 0, insertedIds: rows.map((_, i) => `id-${i}`), duplicates: [], errors: [] },
        duplicates: [],
        errors: [],
        meta: { datasetType: 'skills', requestId: 'req-1', importedByAdminId: 'admin-1', sourceAgency: null, importedAt: new Date().toISOString() },
      },
      { status: 201 },
    );
  }),
];
