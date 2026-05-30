/**
 * src/routes/lazy-imports.ts
 *
 * All React.lazy() component imports for the router.
 * Extracted from routes/index.tsx for Vite Fast Refresh compatibility.
 *
 * This file is a pure .ts module — no JSX, no component exports at the
 * module boundary that would confuse react-refresh. The lazy() wrappers
 * are typed as React.LazyExoticComponent and consumed by index.tsx.
 *
 * IMPORTANT: Do not add JSX or component function declarations here.
 * Only React.lazy(() => import(...)) assignments belong in this file.
 */

import React from 'react';

// ── Layouts ──────────────────────────────────────────────────────────────────
export const PublicLayout       = React.lazy(() => import('../layouts/PublicLayout'));
export const AuthLayout         = React.lazy(() => import('../layouts/AuthLayout'));
export const OnboardingLayout   = React.lazy(() => import('../layouts/OnboardingLayout'));
export const DashboardLayout    = React.lazy(() => import('../layouts/DashboardLayout'));
export const AdminLayout        = React.lazy(() => import('../layouts/AdminLayout'));

// ── Guards ───────────────────────────────────────────────────────────────────
export const AuthGuard          = React.lazy(() => import('./guards/AuthGuard'));
export const GuestGuard         = React.lazy(() => import('./guards/GuestGuard'));
export const OnboardingGuard    = React.lazy(() => import('./guards/OnboardingGuard'));
export const AdminGuard         = React.lazy(() => import('./guards/AdminGuard'));

// ── Public pages ─────────────────────────────────────────────────────────────
export const AppEntryPage       = React.lazy(() => import('../pages/AppEntryPage'));
export const LandingPage        = React.lazy(() => import('../pages/public/LandingPage'));
export const PricingPage        = React.lazy(() => import('../pages/public/PricingPage'));
export const AboutPage          = React.lazy(() => import('../pages/public/AboutPage'));
export const TermsPage          = React.lazy(() => import('../pages/public/TermsPage'));
export const PrivacyPage        = React.lazy(() => import('../pages/public/PrivacyPage'));

// ── App entry & utility pages ────────────────────────────────────────────────
export const DirectionPage      = React.lazy(() => import('../pages/direction/DirectionPage'));
export const ResumePage         = React.lazy(() => import('../pages/resume/ResumePage'));
export const ReportPage         = React.lazy(() => import('../pages/report/ReportPage'));

// ── Auth pages ───────────────────────────────────────────────────────────────
export const LoginPage          = React.lazy(() => import('../pages/auth/LoginPage'));
export const RegisterPage       = React.lazy(() => import('../pages/auth/RegisterPage'));
export const ForgotPasswordPage = React.lazy(() => import('../pages/auth/ForgotPasswordPage'));
export const ResetPasswordPage  = React.lazy(() => import('../pages/auth/ResetPasswordPage'));
export const VerifyEmailPage    = React.lazy(() => import('../pages/auth/VerifyEmailPage'));
export const AuthCallbackPage   = React.lazy(() => import('../pages/auth/AuthCallbackPage'));

// ── Onboarding pages ─────────────────────────────────────────────────────────
export const OnboardingWelcome      = React.lazy(() => import('../pages/onboarding/WelcomePage'));
export const OnboardingProfile      = React.lazy(() => import('../pages/onboarding/ProfilePage'));
export const OnboardingAcademics    = React.lazy(() => import('../pages/onboarding/student/AcademicsPage'));
export const OnboardingActivities   = React.lazy(() => import('../pages/onboarding/student/ActivitiesPage'));
export const OnboardingCognitive    = React.lazy(() => import('../pages/onboarding/student/CognitivePage'));
export const OnboardingIntelligence = React.lazy(() => import('../pages/onboarding/student/IntelligencePage'));
export const OnboardingComplete     = React.lazy(() => import('../pages/onboarding/CompletePage'));
export const CareerOnboardingPage   = React.lazy(() => import('../pages/onboarding/career/CareerOnboardingPage'));

// ── Dashboard pages ──────────────────────────────────────────────────────────
export const DashboardHomePage      = React.lazy(() => import('../pages/dashboard/DashboardHomePage'));

export const CareerProfilePage      = React.lazy(() => import('../pages/dashboard/career/CareerProfilePage'));
export const CareerPathPage         = React.lazy(() => import('../pages/dashboard/career/CareerPathPage'));
export const CareerGraphPage        = React.lazy(() => import('../pages/dashboard/career/CareerGraphPage'));
export const CareerReadinessPage    = React.lazy(() => import('../pages/dashboard/career/CareerReadinessPage'));
export const DigitalTwinPage        = React.lazy(() => import('../pages/dashboard/career/DigitalTwinPage'));
export const CareerSimulationPage   = React.lazy(() => import('../pages/dashboard/career/CareerSimulationPage'));

export const CopilotPage            = React.lazy(() => import('../pages/dashboard/ai/CopilotPage'));
export const AdvisorPage            = React.lazy(() => import('../pages/dashboard/ai/AdvisorPage'));
export const RecommendationsPage    = React.lazy(() => import('../pages/dashboard/ai/RecommendationsPage'));
export const CoverLetterPage        = React.lazy(() => import('../pages/dashboard/ai/CoverLetterPage'));

export const AnalyticsPage          = React.lazy(() => import('../pages/dashboard/analytics/AnalyticsPage'));
export const ChiDashboardPage       = React.lazy(() => import('../pages/dashboard/analytics/ChiDashboardPage'));
export const EngagementPage         = React.lazy(() => import('../pages/dashboard/analytics/EngagementPage'));

export const ProfileSettingsPage    = React.lazy(() => import('../pages/dashboard/settings/ProfileSettingsPage'));
export const BillingPage            = React.lazy(() => import('../pages/dashboard/settings/BillingPage'));

// ── Admin pages ───────────────────────────────────────────────────────────────
export const AdminCmsPage           = React.lazy(() => import('../pages/admin/CmsPage'));
export const AdminGraphPage         = React.lazy(() => import('../pages/admin/GraphPage'));
export const AdminJobsPage          = React.lazy(() => import('../pages/admin/JobsPage'));
export const AdminWeightsPage       = React.lazy(() => import('../pages/admin/WeightsPage'));
export const AdminIntelligencePage  = React.lazy(() => import('../pages/admin/IntelligencePage'));

// ── Error pages ───────────────────────────────────────────────────────────────
export const NotFoundPage           = React.lazy(() => import('../pages/errors/NotFoundPage'));
export const ServerErrorPage        = React.lazy(() => import('../pages/errors/ServerErrorPage'));