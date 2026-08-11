/**
 * @file src/test/msw/fixtures.ts
 * @description Shared fixture data for Permission Administration API mocks.
 * Shapes mirror the certified backend contract exactly (WP-ADMIN-04F-08):
 *   - registry entry: permission.registry.js's `_toRegistryEntry()`
 *   - assignment: permission.assignment.model.js's `createAssignment()`
 *   - evaluation result: permission.evaluation.engine.js's `_explain()`
 */

export interface FixtureLifecycleStage {
  status: string;
  label: string;
  stageIndex: number;
  isTerminal: boolean;
}

export interface FixturePermission {
  id: string;
  identity: string;
  name: string;
  resource: string;
  action: string;
  category: string | null;
  status: string;
  description: string | null;
  capabilityOwner: string | null;
  lifecycleStage: FixtureLifecycleStage | null;
  createdAt: string;
  updatedAt: string;
}

export const PERMISSION_FIXTURES: FixturePermission[] = [
  {
    id: 'perm-1',
    identity: 'user:view',
    name: 'user:view',
    resource: 'user',
    action: 'view',
    category: 'administration',
    status: 'published',
    description: 'View enterprise user records.',
    capabilityOwner: 'Administration',
    lifecycleStage: { status: 'published', label: 'Published', stageIndex: 2, isTerminal: false },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  },
  {
    id: 'perm-2',
    identity: 'cms_entry:publish',
    name: 'cms_entry:publish',
    resource: 'cms_entry',
    action: 'publish',
    category: 'cms',
    status: 'adopted',
    description: 'Publish a CMS entry.',
    capabilityOwner: 'CMS',
    lifecycleStage: { status: 'adopted', label: 'Adopted', stageIndex: 3, isTerminal: false },
    createdAt: '2026-01-03T00:00:00.000Z',
    updatedAt: '2026-01-03T00:00:00.000Z',
  },
  {
    id: 'perm-3',
    identity: 'skill:delete',
    name: 'skill:delete',
    resource: 'skill',
    action: 'delete',
    category: 'skills',
    status: 'deprecated',
    description: null,
    capabilityOwner: 'Skills',
    lifecycleStage: { status: 'deprecated', label: 'Deprecated', stageIndex: 4, isTerminal: false },
    createdAt: '2026-01-04T00:00:00.000Z',
    updatedAt: '2026-01-05T00:00:00.000Z',
  },
  // WP-ADMIN-04F-13B — additional fixtures under the SAME Resource
  // ('user'), with a mix of assignable and non-assignable statuses, so
  // Registry-driven Assignment UI tests can exercise Action-narrowing
  // and assignableOnly filtering. Appended at the end so the existing
  // index-based fixtures above (PERMISSION_FIXTURES[0..2]) are untouched.
  {
    id: 'perm-1b',
    identity: 'user:create',
    name: 'user:create',
    resource: 'user',
    action: 'create',
    category: 'administration',
    status: 'adopted',
    description: 'Create enterprise user records.',
    capabilityOwner: 'Administration',
    lifecycleStage: { status: 'adopted', label: 'Adopted', stageIndex: 3, isTerminal: false },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  },
  {
    id: 'perm-1c',
    identity: 'user:delete',
    name: 'user:delete',
    resource: 'user',
    action: 'delete',
    category: 'administration',
    status: 'proposed',
    description: 'Delete enterprise user records — not yet published.',
    capabilityOwner: 'Administration',
    lifecycleStage: { status: 'proposed', label: 'Proposed', stageIndex: 0, isTerminal: false },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  },
];

export const ASSIGNMENT_FIXTURES = [
  {
    assignmentIdentity: 'user-123::user:view',
    principalId: 'user-123',
    permissionIdentity: 'user:view',
    resource: 'user',
    action: 'view',
    assignedAt: '2026-01-10T00:00:00.000Z',
  },
];

// WP-ADMIN-05D — Enterprise Permission Audit & Governance History.
export const PERMISSION_HISTORY_FIXTURES = [
  {
    id: 'log-2',
    action: 'PERMISSION_APPROVED',
    adminId: 'admin-1',
    entityType: 'permission',
    entityId: 'user:view',
    metadata: { permissionId: 'perm-1', toStatus: 'approved' },
    ipAddress: '203.0.113.9',
    occurredAt: '2026-01-05T00:00:00.000Z',
  },
  {
    id: 'log-1',
    action: 'PERMISSION_ASSIGNED',
    adminId: 'admin-2',
    entityType: 'permission',
    entityId: 'user:view',
    metadata: { principalId: 'user-123' },
    ipAddress: '203.0.113.9',
    occurredAt: '2026-01-04T00:00:00.000Z',
  },
];

export const EVALUATION_ALLOW_RESULT = {
  decision: {
    outcome: 'allow',
    context: {
      userId: 'user-123',
      resource: 'user',
      action: 'view',
      resourceId: null,
      metadata: {},
    },
    reason: 'Principal holds an active assignment for this Permission.',
    decidedAt: '2026-01-10T00:00:00.000Z',
  },
  explanation: {
    permission: 'user:view',
    resource: 'user',
    action: 'view',
    decision: 'allow',
    reason: 'Principal holds an active assignment for this Permission.',
    metadata: {
      permissionStatus: 'published',
      lifecycleStage: { status: 'published', label: 'Published', stageIndex: 2, isTerminal: false },
      category: 'administration',
      deprecated: false,
    },
  },
};

export const ADMIN_USER_FIXTURES = [
  { id: 'user-123', email: 'ada@hirerise.example', displayName: 'Ada Lovelace', role: 'admin', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'user-456', email: 'grace@hirerise.example', displayName: 'Grace Hopper', role: 'user', createdAt: '2026-01-02T00:00:00.000Z' },
];
// ─────────────────────────────────────────────────────────────────────────
// WP-ADMIN-COMP-03 — CMS Master Data fixtures
// ─────────────────────────────────────────────────────────────────────────

export const CAREER_DOMAIN_FIXTURES = [
  {
    id: 'cd-1', name: 'Software Engineering', description: 'Building software.',
    normalized_name: 'software engineering', status: 'active',
    created_by_admin_id: 'admin-1', updated_by_admin_id: 'admin-1', soft_deleted: false,
    created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'cd-2', name: 'Data Science', description: 'Working with data.',
    normalized_name: 'data science', status: 'active',
    created_by_admin_id: 'admin-1', updated_by_admin_id: 'admin-1', soft_deleted: false,
    created_at: '2026-01-02T00:00:00.000Z', updated_at: '2026-01-02T00:00:00.000Z',
  },
];

export const ROLE_FIXTURES = [
  {
    id: 'role-1', name: 'Senior Backend Engineer', jobFamilyId: 'jf-1', level: 'Senior',
    track: 'individual_contributor', description: 'Backend role.', alternativeTitles: ['Staff Engineer'],
    status: 'active', createdByAdminId: 'admin-1', updatedByAdminId: 'admin-1', sourceAgency: null,
    softDeleted: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

export const SKILL_CLUSTER_FIXTURES = [
  {
    id: 'sc-1', name: 'Frontend Development', normalizedName: 'frontend development',
    description: 'UI work.', status: 'active', domainId: 'cd-1',
    createdByAdminId: 'admin-1', updatedByAdminId: 'admin-1', sourceAgency: null,
    softDeleted: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

export const JOB_FAMILY_FIXTURES = [
  {
    id: 'jf-1', name: 'Engineering', normalizedName: 'engineering', description: 'Eng roles.',
    status: 'active', createdByAdminId: 'admin-1', updatedByAdminId: 'admin-1', sourceAgency: null,
    softDeleted: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

export const EDUCATION_LEVEL_FIXTURES = [
  {
    id: 'el-1', name: "Bachelor's Degree", normalizedName: "bachelor's degree", description: null,
    sortOrder: 2, status: 'active', createdByAdminId: 'admin-1', updatedByAdminId: 'admin-1',
    sourceAgency: null, softDeleted: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'el-2', name: "Master's Degree", normalizedName: "master's degree", description: null,
    sortOrder: 1, status: 'active', createdByAdminId: 'admin-1', updatedByAdminId: 'admin-1',
    sourceAgency: null, softDeleted: false, createdAt: '2026-01-02T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z',
  },
];

export const SALARY_BENCHMARK_FIXTURES = [
  {
    id: 'sb-1', name: 'Senior Backend Engineer — Bangalore', normalizedName: 'senior backend engineer bangalore',
    description: null, minSalary: 1800000, maxSalary: 3200000, medianSalary: 2400000, year: 2026,
    status: 'active', createdByAdminId: 'admin-1', updatedByAdminId: 'admin-1', sourceAgency: null,
    softDeleted: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  },
];
