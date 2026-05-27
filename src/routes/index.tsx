/**
 * src/routes/index.tsx
 *
 * HireRise — Centralized Routing Architecture
 *
 * Structure:
 *   Public routes     — Landing, marketing, legal, auth pages
 *   Auth routes       — Login, register, password reset, email verification
 *   Onboarding routes — Student & career onboarding multi-step flows
 *   Dashboard routes  — Main product shell: career intelligence, analytics, AI tools
 *   Admin routes      — CMS, graph intelligence, job sync (role-gated)
 *   Error routes      — 404, 500, maintenance
 *
 * Patterns:
 *   • All feature routes are lazy-loaded (code-split per route group)
 *   • Protected routes check auth state before rendering
 *   • Onboarding guard prevents skipping incomplete flows
 *   • Layout components are hoisted to the route layer (not inside pages)
 *   • Route constants are typed to prevent typos at call sites
 */

import React, { Suspense } from 'react';
import {
  createBrowserRouter,
  type RouteObject,
  Outlet,
  Navigate,
} from 'react-router-dom';

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE CONSTANTS
// Single source of truth — import from here, never hard-code paths.
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// LAZY IMPORTS
// Each route group is a separate async chunk. Layouts are bundled with their
// group since they are always co-loaded.
// ─────────────────────────────────────────────────────────────────────────────

// ── Layouts ──────────────────────────────────────────────────────────────────
const PublicLayout       = React.lazy(() => import('../layouts/PublicLayout'));
const AuthLayout         = React.lazy(() => import('../layouts/AuthLayout'));
const OnboardingLayout   = React.lazy(() => import('../layouts/OnboardingLayout'));
const DashboardLayout    = React.lazy(() => import('../layouts/DashboardLayout'));
const AdminLayout        = React.lazy(() => import('../layouts/AdminLayout'));

// ── Guards ───────────────────────────────────────────────────────────────────
const AuthGuard          = React.lazy(() => import('./guards/AuthGuard'));
const GuestGuard         = React.lazy(() => import('./guards/GuestGuard'));
const OnboardingGuard    = React.lazy(() => import('./guards/OnboardingGuard'));
const AdminGuard         = React.lazy(() => import('./guards/AdminGuard'));

// ── Public pages ─────────────────────────────────────────────────────────────
const LandingPage        = React.lazy(() => import('../pages/public/LandingPage'));
const PricingPage        = React.lazy(() => import('../pages/public/PricingPage'));
const AboutPage          = React.lazy(() => import('../pages/public/AboutPage'));
const TermsPage          = React.lazy(() => import('../pages/public/TermsPage'));
const PrivacyPage        = React.lazy(() => import('../pages/public/PrivacyPage'));

// ── Auth pages ───────────────────────────────────────────────────────────────
const LoginPage          = React.lazy(() => import('../pages/auth/LoginPage'));
const RegisterPage       = React.lazy(() => import('../pages/auth/RegisterPage'));
const ForgotPasswordPage = React.lazy(() => import('../pages/auth/ForgotPasswordPage'));
const ResetPasswordPage  = React.lazy(() => import('../pages/auth/ResetPasswordPage'));
const VerifyEmailPage    = React.lazy(() => import('../pages/auth/VerifyEmailPage'));
const AuthCallbackPage   = React.lazy(() => import('../pages/auth/AuthCallbackPage'));

// ── Onboarding pages ─────────────────────────────────────────────────────────
const OnboardingWelcome      = React.lazy(() => import('../pages/onboarding/WelcomePage'));
const OnboardingProfile      = React.lazy(() => import('../pages/onboarding/ProfilePage'));
const OnboardingAcademics    = React.lazy(() => import('../pages/onboarding/student/AcademicsPage'));
const OnboardingActivities   = React.lazy(() => import('../pages/onboarding/student/ActivitiesPage'));
const OnboardingCognitive    = React.lazy(() => import('../pages/onboarding/student/CognitivePage'));
const OnboardingIntelligence = React.lazy(() => import('../pages/onboarding/student/IntelligencePage'));
const OnboardingComplete     = React.lazy(() => import('../pages/onboarding/CompletePage'));
const CareerOnboardingPage   = React.lazy(() => import('../pages/onboarding/career/CareerOnboardingPage'));

// ── Dashboard pages ──────────────────────────────────────────────────────────
const DashboardHomePage      = React.lazy(() => import('../pages/dashboard/DashboardHomePage'));

const CareerProfilePage      = React.lazy(() => import('../pages/dashboard/career/CareerProfilePage'));
const CareerPathPage         = React.lazy(() => import('../pages/dashboard/career/CareerPathPage'));
const CareerGraphPage        = React.lazy(() => import('../pages/dashboard/career/CareerGraphPage'));
const CareerReadinessPage    = React.lazy(() => import('../pages/dashboard/career/CareerReadinessPage'));
const DigitalTwinPage        = React.lazy(() => import('../pages/dashboard/career/DigitalTwinPage'));
const CareerSimulationPage   = React.lazy(() => import('../pages/dashboard/career/CareerSimulationPage'));

const CopilotPage            = React.lazy(() => import('../pages/dashboard/ai/CopilotPage'));
const AdvisorPage            = React.lazy(() => import('../pages/dashboard/ai/AdvisorPage'));
const RecommendationsPage    = React.lazy(() => import('../pages/dashboard/ai/RecommendationsPage'));
const CoverLetterPage        = React.lazy(() => import('../pages/dashboard/ai/CoverLetterPage'));

const AnalyticsPage          = React.lazy(() => import('../pages/dashboard/analytics/AnalyticsPage'));
const ChiDashboardPage       = React.lazy(() => import('../pages/dashboard/analytics/ChiDashboardPage'));
const EngagementPage         = React.lazy(() => import('../pages/dashboard/analytics/EngagementPage'));

const ProfileSettingsPage    = React.lazy(() => import('../pages/dashboard/settings/ProfileSettingsPage'));
const BillingPage            = React.lazy(() => import('../pages/dashboard/settings/BillingPage'));

// ── Admin pages ───────────────────────────────────────────────────────────────
const AdminCmsPage           = React.lazy(() => import('../pages/admin/CmsPage'));
const AdminGraphPage         = React.lazy(() => import('../pages/admin/GraphPage'));
const AdminJobsPage          = React.lazy(() => import('../pages/admin/JobsPage'));
const AdminWeightsPage       = React.lazy(() => import('../pages/admin/WeightsPage'));
const AdminIntelligencePage  = React.lazy(() => import('../pages/admin/IntelligencePage'));

// ── Error pages ───────────────────────────────────────────────────────────────
const NotFoundPage           = React.lazy(() => import('../pages/errors/NotFoundPage'));
const ServerErrorPage        = React.lazy(() => import('../pages/errors/ServerErrorPage'));

// ─────────────────────────────────────────────────────────────────────────────
// SUSPENSE WRAPPER
// Applied at each layout boundary so partial hydration doesn't block the shell.
// ─────────────────────────────────────────────────────────────────────────────

function SuspenseOutlet(): React.JSX.Element {
  // PageLoader component handles branded loading state
  // Replace with your actual loading component
  return (
    <Suspense fallback={<div aria-busy="true" />}>
      <Outlet />
    </Suspense>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

const routes: RouteObject[] = [

  // ── PUBLIC GROUP ───────────────────────────────────────────────────────────
  {
    element: (
      <Suspense fallback={null}>
        <PublicLayout>
          <SuspenseOutlet />
        </PublicLayout>
      </Suspense>
    ),
    children: [
      { index: true,         element: <Suspense fallback={null}><LandingPage /></Suspense> },
      { path: ROUTES.ABOUT,   element: <Suspense fallback={null}><AboutPage /></Suspense> },
      { path: ROUTES.PRICING, element: <Suspense fallback={null}><PricingPage /></Suspense> },
      { path: ROUTES.TERMS,   element: <Suspense fallback={null}><TermsPage /></Suspense> },
      { path: ROUTES.PRIVACY, element: <Suspense fallback={null}><PrivacyPage /></Suspense> },
    ],
  },

  // ── AUTH GROUP (unauthenticated only) ──────────────────────────────────────
  // GuestGuard redirects authenticated users to /dashboard
  {
    path: '/auth',
    element: (
      <Suspense fallback={null}>
        <GuestGuard>
          <AuthLayout>
            <SuspenseOutlet />
          </AuthLayout>
        </GuestGuard>
      </Suspense>
    ),
    children: [
      { index: true,                   element: <Navigate to={ROUTES.LOGIN} replace /> },
      { path: 'login',                 element: <Suspense fallback={null}><LoginPage /></Suspense> },
      { path: 'register',              element: <Suspense fallback={null}><RegisterPage /></Suspense> },
      { path: 'forgot-password',       element: <Suspense fallback={null}><ForgotPasswordPage /></Suspense> },
      { path: 'reset-password',        element: <Suspense fallback={null}><ResetPasswordPage /></Suspense> },
      { path: 'verify-email',          element: <Suspense fallback={null}><VerifyEmailPage /></Suspense> },
      // Auth callback is NOT behind GuestGuard — Supabase redirects here after OAuth
      { path: 'callback',              element: <Suspense fallback={null}><AuthCallbackPage /></Suspense> },
    ],
  },

  // ── ONBOARDING GROUP ───────────────────────────────────────────────────────
  // AuthGuard: must be logged in
  // OnboardingGuard: enforces step sequencing, blocks skipping
  {
    path: '/onboarding',
    element: (
      <Suspense fallback={null}>
        <AuthGuard>
          <OnboardingLayout>
            <SuspenseOutlet />
          </OnboardingLayout>
        </AuthGuard>
      </Suspense>
    ),
    children: [
      { index: true,           element: <Navigate to={ROUTES.ONBOARDING_WELCOME} replace /> },
      { path: 'welcome',       element: <Suspense fallback={null}><OnboardingWelcome /></Suspense> },
      {
        path: 'profile',
        element: (
          <Suspense fallback={null}>
            <OnboardingGuard requiredStep="welcome">
              <OnboardingProfile />
            </OnboardingGuard>
          </Suspense>
        ),
      },
      // Student onboarding sub-flow (maps to /api/v1/student-onboarding/*)
      {
        path: 'student',
        children: [
          { index: true, element: <Navigate to={ROUTES.ONBOARDING_ACADEMICS} replace /> },
          {
            path: 'academics',
            element: (
              <Suspense fallback={null}>
                <OnboardingGuard requiredStep="profile">
                  <OnboardingAcademics />
                </OnboardingGuard>
              </Suspense>
            ),
          },
          {
            path: 'activities',
            element: (
              <Suspense fallback={null}>
                <OnboardingGuard requiredStep="academics">
                  <OnboardingActivities />
                </OnboardingGuard>
              </Suspense>
            ),
          },
          {
            path: 'cognitive',
            element: (
              <Suspense fallback={null}>
                <OnboardingGuard requiredStep="activities">
                  <OnboardingCognitive />
                </OnboardingGuard>
              </Suspense>
            ),
          },
          {
            path: 'intelligence',
            element: (
              <Suspense fallback={null}>
                <OnboardingGuard requiredStep="cognitive">
                  <OnboardingIntelligence />
                </OnboardingGuard>
              </Suspense>
            ),
          },
        ],
      },
      // Career onboarding sub-flow (maps to /api/v1/career-onboarding/*)
      {
        path: 'career',
        element: (
          <Suspense fallback={null}>
            <OnboardingGuard requiredStep="profile">
              <CareerOnboardingPage />
            </OnboardingGuard>
          </Suspense>
        ),
      },
      // Completion — AI recommendation generation (POST /generate-recommendations)
      {
        path: 'complete',
        element: (
          <Suspense fallback={null}>
            <OnboardingComplete />
          </Suspense>
        ),
      },
    ],
  },

  // ── DASHBOARD GROUP ────────────────────────────────────────────────────────
  // Full auth + onboarding required
  {
    path: '/dashboard',
    element: (
      <Suspense fallback={null}>
        <AuthGuard requireOnboarding>
          <DashboardLayout>
            <SuspenseOutlet />
          </DashboardLayout>
        </AuthGuard>
      </Suspense>
    ),
    children: [
      { index: true, element: <Navigate to={ROUTES.DASHBOARD_HOME} replace /> },
      { path: 'home', element: <Suspense fallback={null}><DashboardHomePage /></Suspense> },

      // Career Intelligence sub-group
      {
        path: 'career',
        children: [
          { index: true,               element: <Navigate to={ROUTES.CAREER_PROFILE} replace /> },
          { path: 'profile',           element: <Suspense fallback={null}><CareerProfilePage /></Suspense> },
          { path: 'path',              element: <Suspense fallback={null}><CareerPathPage /></Suspense> },
          { path: 'graph',             element: <Suspense fallback={null}><CareerGraphPage /></Suspense> },
          { path: 'readiness',         element: <Suspense fallback={null}><CareerReadinessPage /></Suspense> },
          { path: 'digital-twin',      element: <Suspense fallback={null}><DigitalTwinPage /></Suspense> },
          { path: 'simulation',        element: <Suspense fallback={null}><CareerSimulationPage /></Suspense> },
        ],
      },

      // AI Tools sub-group
      {
        path: 'ai',
        children: [
          { index: true,               element: <Navigate to={ROUTES.AI_COPILOT} replace /> },
          { path: 'copilot',           element: <Suspense fallback={null}><CopilotPage /></Suspense> },
          { path: 'advisor',           element: <Suspense fallback={null}><AdvisorPage /></Suspense> },
          { path: 'recommendations',   element: <Suspense fallback={null}><RecommendationsPage /></Suspense> },
          { path: 'cover-letter',      element: <Suspense fallback={null}><CoverLetterPage /></Suspense> },
        ],
      },

      // Analytics sub-group
      {
        path: 'analytics',
        children: [
          { index: true,               element: <Navigate to={ROUTES.ANALYTICS} replace /> },
          { path: '',                  element: <Suspense fallback={null}><AnalyticsPage /></Suspense> },
          { path: 'chi',               element: <Suspense fallback={null}><ChiDashboardPage /></Suspense> },
          { path: 'engagement',        element: <Suspense fallback={null}><EngagementPage /></Suspense> },
        ],
      },

      // Settings sub-group
      {
        path: 'settings',
        children: [
          { index: true,               element: <Navigate to={ROUTES.PROFILE_SETTINGS} replace /> },
          { path: 'profile',           element: <Suspense fallback={null}><ProfileSettingsPage /></Suspense> },
          { path: 'billing',           element: <Suspense fallback={null}><BillingPage /></Suspense> },
        ],
      },
    ],
  },

  // ── ADMIN GROUP ────────────────────────────────────────────────────────────
  // Requires admin role — maps to requireAdmin.middleware.js
  {
    path: '/admin',
    element: (
      <Suspense fallback={null}>
        <AdminGuard>
          <AdminLayout>
            <SuspenseOutlet />
          </AdminLayout>
        </AdminGuard>
      </Suspense>
    ),
    children: [
      { index: true,           element: <Navigate to={ROUTES.ADMIN_CMS} replace /> },
      { path: 'cms',           element: <Suspense fallback={null}><AdminCmsPage /></Suspense> },
      { path: 'graph',         element: <Suspense fallback={null}><AdminGraphPage /></Suspense> },
      { path: 'jobs',          element: <Suspense fallback={null}><AdminJobsPage /></Suspense> },
      { path: 'weights',       element: <Suspense fallback={null}><AdminWeightsPage /></Suspense> },
      { path: 'intelligence',  element: <Suspense fallback={null}><AdminIntelligencePage /></Suspense> },
    ],
  },

  // ── ERROR / UTILITY ────────────────────────────────────────────────────────
  { path: '/404',  element: <Suspense fallback={null}><NotFoundPage /></Suspense> },
  { path: '/500',  element: <Suspense fallback={null}><ServerErrorPage /></Suspense> },
  { path: '*',     element: <Navigate to={ROUTES.NOT_FOUND} replace /> },
];

// ─────────────────────────────────────────────────────────────────────────────
// ROUTER
// createBrowserRouter enables the v7 data router features (loaders, actions,
// error boundaries per route) when the team is ready to adopt them.
// ─────────────────────────────────────────────────────────────────────────────

export const router = createBrowserRouter(routes, {
  future: {
    // Opt into v7 behaviour flags now to ease the future upgrade
    v7_relativeSplatPath:             true,
    v7_fetcherPersist:                true,
    v7_normalizeFormMethod:           true,
    v7_partialHydration:              true,
    v7_skipActionErrorRevalidation:   true,
  },
});
