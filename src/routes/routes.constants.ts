/**
 * src/routes/routes.constants.ts
 *
 * HireRise — Route path constants and AppRoute type.
 * Extracted from routes/index.tsx for Vite Fast Refresh compatibility.
 * Single source of truth — import from here, never hard-code paths.
 */

export const ROUTES = {
  // Public
  HOME:                    '/',
  ABOUT:                   '/about',
  PRICING:                 '/pricing',
  TERMS:                   '/terms',
  PRIVACY:                 '/privacy',

  // Auth
  LOGIN:                   '/auth/login',
  REGISTER:                '/auth/register',
  FORGOT_PASSWORD:         '/auth/forgot-password',
  RESET_PASSWORD:          '/auth/reset-password',
  VERIFY_EMAIL:            '/auth/verify-email',
  AUTH_CALLBACK:           '/auth/callback',

  // Onboarding
  ONBOARDING_ROOT:         '/onboarding',
  ONBOARDING_WELCOME:      '/onboarding/welcome',
  ONBOARDING_PROFILE:      '/onboarding/profile',
  // Professional Guided Profile Builder — WP-PRO-09B / WP-PRO-09C.
  // Additive only: these are new leaf routes under the existing
  // ONBOARDING_PROFILE parent. No existing onboarding route is renamed,
  // removed, or re-pointed. UI for these routes is implemented in a
  // subsequent work package — WP-PRO-09C implements infrastructure only.
  ONBOARDING_RESUME_UPLOAD:        '/onboarding/profile/resume',
  ONBOARDING_BUILDER_ROOT:         '/onboarding/profile/build',
  ONBOARDING_BUILDER_PERSONAL:     '/onboarding/profile/build/personal',
  ONBOARDING_BUILDER_EDUCATION:    '/onboarding/profile/build/education',
  ONBOARDING_BUILDER_EXPERIENCE:   '/onboarding/profile/build/experience',
  ONBOARDING_BUILDER_SKILLS:       '/onboarding/profile/build/skills',
  ONBOARDING_BUILDER_CAREER_GOALS: '/onboarding/profile/build/career-goals',
  ONBOARDING_PROFILE_REVIEW:       '/onboarding/profile/review',
  ONBOARDING_PROFILE_COMPLETE:     '/onboarding/profile/complete',
  // Student onboarding — maps to student-onboarding module routes
  ONBOARDING_ACADEMICS:    '/onboarding/student/academics',
  ONBOARDING_ACTIVITIES:   '/onboarding/student/activities',
  ONBOARDING_COGNITIVE:    '/onboarding/student/cognitive',
  ONBOARDING_INTELLIGENCE: '/onboarding/student/intelligence',
  ONBOARDING_COMPLETE:     '/onboarding/complete',
  // Career onboarding
  CAREER_ONBOARDING:       '/onboarding/career',

  // Dashboard (authenticated product shell)
  DASHBOARD:               '/dashboard',
  DASHBOARD_HOME:          '/dashboard/home',

  // Career Intelligence
  CAREER_PROFILE:          '/dashboard/career/profile',
  CAREER_PATH:             '/dashboard/career/path',
  CAREER_GRAPH:            '/dashboard/career/graph',
  CAREER_READINESS:        '/dashboard/career/readiness',
  CAREER_DIGITAL_TWIN:     '/dashboard/career/digital-twin',
  CAREER_SIMULATION:       '/dashboard/career/simulation',

  // AI Tools
  AI_COPILOT:              '/dashboard/ai/copilot',
  AI_ADVISOR:              '/dashboard/ai/advisor',
  AI_RECOMMENDATIONS:      '/dashboard/ai/recommendations',
  COVER_LETTER:            '/dashboard/ai/cover-letter',

  // Analytics
  ANALYTICS:               '/dashboard/analytics',
  CHI_DASHBOARD:           '/dashboard/analytics/chi',
  ENGAGEMENT:              '/dashboard/analytics/engagement',

  // User
  PROFILE_SETTINGS:        '/dashboard/settings/profile',
  BILLING:                 '/dashboard/settings/billing',

  // Admin
  ADMIN_ROOT:              '/admin',
  ADMIN_CMS:               '/admin/cms',
  ADMIN_GRAPH:             '/admin/graph',
  ADMIN_JOBS:              '/admin/jobs',
  ADMIN_JOB_DETAIL:        '/admin/jobs/:jobId', // WP-ADMIN-COMP-06
  ADMIN_WEIGHTS:           '/admin/weights',
  ADMIN_INTELLIGENCE:      '/admin/intelligence',
  ADMIN_XAI_OPERATIONS:    '/admin/xai-operations', // WP-7
  ADMIN_MASTER_DATA_SKILLS: '/admin/master-data/skills', // WP-ADMIN-02A
  // WP-ADMIN-COMP-03 — Master Data frontend completion.
  ADMIN_MASTER_DATA_ROLES:             '/admin/master-data/roles',
  ADMIN_MASTER_DATA_CAREER_DOMAINS:    '/admin/master-data/career-domains',
  ADMIN_MASTER_DATA_SKILL_CLUSTERS:    '/admin/master-data/skill-clusters',
  ADMIN_MASTER_DATA_JOB_FAMILIES:      '/admin/master-data/job-families',
  ADMIN_MASTER_DATA_EDUCATION_LEVELS:  '/admin/master-data/education-levels',
  ADMIN_MASTER_DATA_SALARY_BENCHMARKS: '/admin/master-data/salary-benchmarks',
  ADMIN_MASTER_DATA_IMPORT:            '/admin/master-data/import',
  // ADMIN_USERS: WP-ADMIN-03 Phase 2 shipped this as a placeholder landing
  // page; WP-ADMIN-04/04C/COMP-04 made it a fully live module (User
  // Directory, Edit Profile, Manage Roles, Manage Permissions,
  // Enable/Disable Account, Audit History).
  ADMIN_USERS:             '/admin/users',
  ADMIN_USER_DETAIL:       '/admin/users/:userId', // WP-ADMIN-04 Phase 1B
  // WP-ADMIN-04F-09 — Enterprise Permission Management UI. Detail is
  // nested under /registry/:identity (not a bare /:identity sibling of
  // /assignments and /evaluate) so the dynamic segment can never shadow
  // those static routes regardless of registration order in routes/index.tsx.
  ADMIN_PERMISSIONS:            '/admin/permissions',
  ADMIN_PERMISSION_DETAIL:      '/admin/permissions/registry/:identity',
  ADMIN_PERMISSION_ASSIGNMENTS: '/admin/permissions/assignments',
  ADMIN_PERMISSION_EVALUATE:    '/admin/permissions/evaluate',
  // WP-ADMIN-05A — Enterprise Administrator Management. Detail is nested
  // under /:uid, same shape as ADMIN_USER_DETAIL.
  ADMIN_ADMINISTRATORS:        '/admin/administrators',
  ADMIN_ADMINISTRATOR_DETAIL:  '/admin/administrators/:uid',
  ADMIN_SETTINGS:          '/admin/settings',

  // Error / fallback
  NOT_FOUND:               '/404',
  SERVER_ERROR:            '/500',
} as const;

export type AppRoute = typeof ROUTES[keyof typeof ROUTES];

/** Build a concrete /admin/users/:userId path for navigation (WP-ADMIN-04 Phase 1B). */
export function adminUserDetailPath(userId: string): string {
  return `/admin/users/${userId}`;
}

/** Build a concrete /admin/administrators/:uid path for navigation (WP-ADMIN-05A). */
export function adminAdministratorDetailPath(uid: string): string {
  return `/admin/administrators/${uid}`;
}

/** Build a concrete /admin/jobs/:jobId path for navigation (WP-ADMIN-COMP-06). */
export function adminJobDetailPath(jobId: string): string {
  return `/admin/jobs/${jobId}`;
}

/** Build a concrete /admin/permissions/registry/:identity path for navigation (WP-ADMIN-04F-09). */
export function adminPermissionDetailPath(identity: string): string {
  return `/admin/permissions/registry/${encodeURIComponent(identity)}`;
}

/** Build /admin/permissions/assignments, optionally pre-filtered to one principal (WP-ADMIN-04F-09). */
export function adminPermissionAssignmentsPath(principalId?: string): string {
  return principalId
    ? `/admin/permissions/assignments?principalId=${encodeURIComponent(principalId)}`
    : '/admin/permissions/assignments';
}