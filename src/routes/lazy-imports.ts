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
export const OnboardingResumeUpload = React.lazy(() => import('../pages/onboarding/ResumeUploadPage'));
export const OnboardingAcademics    = React.lazy(() => import('../pages/onboarding/student/AcademicsPage'));
export const OnboardingActivities   = React.lazy(() => import('../pages/onboarding/student/ActivitiesPage'));
export const OnboardingCognitive    = React.lazy(() => import('../pages/onboarding/student/CognitivePage'));
export const OnboardingIntelligence = React.lazy(() => import('../pages/onboarding/student/IntelligencePage'));
export const OnboardingComplete     = React.lazy(() => import('../pages/onboarding/CompletePage'));
export const OnboardingProfileReview   = React.lazy(() => import('../pages/onboarding/profile/ReviewPage'));
export const OnboardingProfileComplete = React.lazy(() => import('../pages/onboarding/profile/CompleteProfilePage'));
export const CareerOnboardingPage   = React.lazy(() => import('../pages/onboarding/career/CareerOnboardingPage'));

// ── Guided Profile Builder pages (WP-PRO-09D) ────────────────────────────────
export const GuidedBuilderIndex          = React.lazy(() => import('../pages/onboarding/guided-builder/IndexPage'));
export const GuidedBuilderPersonal       = React.lazy(() => import('../pages/onboarding/guided-builder/PersonalDetailsPage'));
export const GuidedBuilderEducation      = React.lazy(() => import('../pages/onboarding/guided-builder/EducationPage'));
export const GuidedBuilderExperience     = React.lazy(() => import('../pages/onboarding/guided-builder/ExperiencePage'));
export const GuidedBuilderSkills         = React.lazy(() => import('../pages/onboarding/guided-builder/SkillsPage'));
export const GuidedBuilderCareerGoals    = React.lazy(() => import('../pages/onboarding/guided-builder/CareerGoalsPage'));

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
export const AdminJobDetailPage     = React.lazy(() => import('../pages/admin/JobDetailPage')); // WP-ADMIN-COMP-06
export const AdminWeightsPage       = React.lazy(() => import('../pages/admin/WeightsPage'));
export const AdminIntelligencePage  = React.lazy(() => import('../pages/admin/IntelligencePage'));

// WP-ADMIN-03 Phase 2 — Enterprise Dashboard landing page for /admin.
export const AdminDashboardPage     = React.lazy(() => import('../pages/admin/DashboardPage'));

// WP-7 page already existed on disk but was never mounted as a route
// (orphaned). WP-ADMIN-03 Phase 2 registers it — no new page created.
export const AdminXaiOperationsPage = React.lazy(() => import('../pages/admin/XaiOperationsDashboardPage'));

// WP-ADMIN-04/04C/COMP-04 — Users is a fully live module (directory, edit
// profile, roles, permissions, enable/disable, audit history). Settings
// remains a placeholder landing page only.
export const AdminUsersPage         = React.lazy(() => import('../pages/admin/UsersPage'));
export const AdminUserDetailPage    = React.lazy(() => import('../pages/admin/UserDetailPage')); // WP-ADMIN-04 Phase 1B
export const AdminAdministratorsPage      = React.lazy(() => import('../pages/admin/AdministratorsPage')); // WP-ADMIN-05A
export const AdminAdministratorDetailPage = React.lazy(() => import('../pages/admin/AdministratorDetailPage')); // WP-ADMIN-05A
export const AdminSettingsPage      = React.lazy(() => import('../pages/admin/SettingsPage'));

// ── Admin Master Data pages (WP-ADMIN-02A) ─────────────────────────────────────
export const AdminMasterDataSkillsPage = React.lazy(() => import('../pages/admin/master-data/SkillsPage'));
// WP-ADMIN-COMP-03
export const AdminMasterDataRolesPage = React.lazy(() => import('../pages/admin/master-data/RolesPage'));
export const AdminMasterDataCareerDomainsPage = React.lazy(() => import('../pages/admin/master-data/CareerDomainsPage'));
export const AdminMasterDataSkillClustersPage = React.lazy(() => import('../pages/admin/master-data/SkillClustersPage'));
export const AdminMasterDataJobFamiliesPage = React.lazy(() => import('../pages/admin/master-data/JobFamiliesPage'));
export const AdminMasterDataEducationLevelsPage = React.lazy(() => import('../pages/admin/master-data/EducationLevelsPage'));
export const AdminMasterDataSalaryBenchmarksPage = React.lazy(() => import('../pages/admin/master-data/SalaryBenchmarksPage'));
export const AdminMasterDataImportPage = React.lazy(() => import('../pages/admin/master-data/ImportPage'));

// ── Admin Permission Management pages (WP-ADMIN-04F-09) ────────────────────────
export const AdminPermissionsCatalogPage     = React.lazy(() => import('../pages/admin/permissions/PermissionsCatalogPage'));
export const AdminPermissionDetailPage       = React.lazy(() => import('../pages/admin/permissions/PermissionDetailPage'));
export const AdminPermissionAssignmentsPage  = React.lazy(() => import('../pages/admin/permissions/PermissionAssignmentsPage'));
export const AdminPermissionEvaluationPage   = React.lazy(() => import('../pages/admin/permissions/PermissionEvaluationPage'));

// ── Error pages ───────────────────────────────────────────────────────────────
export const NotFoundPage           = React.lazy(() => import('../pages/errors/NotFoundPage'));
export const ServerErrorPage        = React.lazy(() => import('../pages/errors/ServerErrorPage'));