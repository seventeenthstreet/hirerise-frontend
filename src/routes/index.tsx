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

import { Suspense } from 'react';
import {
  createBrowserRouter,
  type RouteObject,
  Navigate,
} from 'react-router-dom';

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE CONSTANTS
// Single source of truth — import from here, never hard-code paths.
// ─────────────────────────────────────────────────────────────────────────────

// Route constants and AppRoute type live in routes.constants.ts
// (separated for Vite Fast Refresh — this file exports the router only).
// Import ROUTES and AppRoute directly from './routes.constants' when needed.
import { ROUTES } from './routes.constants';
import { SuspenseOutlet } from './SuspenseOutlet';

// ─────────────────────────────────────────────────────────────────────────────
// LAZY IMPORTS
// Defined in lazy-imports.ts for Vite Fast Refresh compatibility.
// Keeping React.lazy() assignments in a pure .ts file prevents the
// react-refresh plugin from firing on component-shaped consts in this file.
// ─────────────────────────────────────────────────────────────────────────────

import {
  PublicLayout, AuthLayout, OnboardingLayout, DashboardLayout, AdminLayout,
  AuthGuard, GuestGuard, OnboardingGuard, AdminGuard,
  AppEntryPage, LandingPage, PricingPage, AboutPage, TermsPage, PrivacyPage,
  DirectionPage, ResumePage, ReportPage,
  LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage,
  VerifyEmailPage, AuthCallbackPage,
  OnboardingWelcome, OnboardingProfile, OnboardingAcademics, OnboardingActivities,
  OnboardingCognitive, OnboardingIntelligence, OnboardingComplete, CareerOnboardingPage,
  DashboardHomePage,
  CareerProfilePage, CareerPathPage, CareerGraphPage, CareerReadinessPage,
  DigitalTwinPage, CareerSimulationPage,
  CopilotPage, AdvisorPage, RecommendationsPage, CoverLetterPage,
  AnalyticsPage, ChiDashboardPage, EngagementPage,
  ProfileSettingsPage, BillingPage,
  AdminCmsPage, AdminGraphPage, AdminJobsPage, AdminWeightsPage, AdminIntelligencePage,
  NotFoundPage, ServerErrorPage,
} from './lazy-imports';

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
// ROUTE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

const routes: RouteObject[] = [

  // ── APP ENTRY GATE ────────────────────────────────────────────────────────
  // Routing decision gate: reads auth state and redirects to the correct destination.
  // Runs at "/" — fired by auth callback (SIGNED_IN → navigate('/') → this page routes).
  {
    path: '/',
    element: <Suspense fallback={null}><AppEntryPage /></Suspense>,
  },

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
      { path: 'landing',     element: <Suspense fallback={null}><LandingPage /></Suspense> },
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
  // ── PROFESSIONAL ONBOARDING ORCHESTRATOR ──────────────────────────────────
  // WelcomePage IS the full professional onboarding step-flow orchestrator.
  // (was app/(auth)/(onboarding)/onboarding/page.tsx — served at /onboarding root)
  // Handles its own direction guard, variant detection, and post-submit navigation.
  {
    path: '/onboarding',
    element: (
      <Suspense fallback={null}>
        <AuthGuard>
          <OnboardingLayout>
            <OnboardingWelcome />
          </OnboardingLayout>
        </AuthGuard>
      </Suspense>
    ),
  },

  // ── ONBOARDING STUDENT + CAREER SUB-ROUTES ─────────────────────────────────
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

  // ── DIRECTION, RESUME, REPORT ────────────────────────────────────────────────
  // Pre-app-entry and post-onboarding utility routes — require auth, no onboarding gate.
  {
    path: '/direction',
    element: (
      <Suspense fallback={null}>
        <AuthGuard>
          <DirectionPage />
        </AuthGuard>
      </Suspense>
    ),
  },
  {
    path: '/resume',
    element: (
      <Suspense fallback={null}>
        <AuthGuard>
          <ResumePage />
        </AuthGuard>
      </Suspense>
    ),
  },
  {
    path: '/report',
    element: (
      <Suspense fallback={null}>
        <AuthGuard>
          <ReportPage />
        </AuthGuard>
      </Suspense>
    ),
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