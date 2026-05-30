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
  ADMIN_WEIGHTS:           '/admin/weights',
  ADMIN_INTELLIGENCE:      '/admin/intelligence',

  // Error / fallback
  NOT_FOUND:               '/404',
  SERVER_ERROR:            '/500',
} as const;

export type AppRoute = typeof ROUTES[keyof typeof ROUTES];