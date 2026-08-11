/**
 * @file src/pages/admin/DashboardPage.tsx
 * @description WP-ADMIN-03 Phase 2 — Enterprise Admin Dashboard.
 *
 * Route: /admin (index route, admin-gated via AdminGuard + AdminLayout)
 * Landing page after Google Login → Google Authenticator → /admin.
 *
 * RESPONSIBILITIES (pages layer only):
 *  - Call useAdminDashboard() once — single data source
 *  - Compose section components from components/admin-dashboard
 *  - No business logic, no direct API calls, no mock data
 *
 * LAYOUT: reuses AdminLayout (mounted at the route layer) + PageShell.
 * Does NOT introduce a second layout/shell — see AdminLayout.tsx.
 *
 * Architecture position: Pages layer (fourth tier)
 *   API → Hooks → UI → Pages → Guards → Context
 */

import { PageShell } from '@/components/ui';
import { useAdminDashboard } from '@/hooks/admin/useAdminDashboard';
import {
  DashboardSection,
  DashboardGrid,
  MetricCard,
  QuickActionCard,
  HealthWidget,
} from '@/components/admin-dashboard';
import { ROUTES } from '@/routes/routes.constants';

// ─────────────────────────────────────────────────────────────────────────────
// ICONS — inline SVGs, consistent with the existing admin-shell/app-shell
// dependency-free approach (no icon library dependency introduced).
// ─────────────────────────────────────────────────────────────────────────────

function IconAdministrators() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path fillRule="evenodd" d="M10 1a5.5 5.5 0 0 0-5.5 5.5V9H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V6.5A5.5 5.5 0 0 0 10 1Zm3.5 8V6.5a3.5 3.5 0 1 0-7 0V9h7Zm-3.5 3a1.5 1.5 0 0 1 .82 2.755L11 15.5v.5a1 1 0 1 1-2 0v-.5l.18-.745A1.5 1.5 0 0 1 10 12Z" clipRule="evenodd" />
    </svg>
  );
}
function IconPermissions() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V8H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 7V5.5a3 3 0 1 0-6 0V8h6Zm-3 4a1.5 1.5 0 0 1 .82 2.755L11 15.5v.5a1 1 0 1 1-2 0v-.5l.18-.745A1.5 1.5 0 0 1 10 12Z" clipRule="evenodd" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M10 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-6 9a6 6 0 1 1 12 0H4Z" />
    </svg>
  );
}
function IconSkills() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path fillRule="evenodd" d="M6.28 3.22a.75.75 0 0 1 0 1.06L2.56 8l3.72 3.72a.75.75 0 1 1-1.06 1.06L.97 8.53a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Zm7.44 0a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 1 1-1.06-1.06L17.44 8l-3.72-3.72a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
    </svg>
  );
}
function IconRoles() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path fillRule="evenodd" d="M6 3a2 2 0 0 0-2 2v1H3a1 1 0 0 0-1 1v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a1 1 0 0 0-1-1h-1V5a2 2 0 0 0-2-2H6Zm8 3V5H6v1h8ZM3 9v7h14V9H3Z" clipRule="evenodd" />
    </svg>
  );
}
function IconCms() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path fillRule="evenodd" d="M4 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Zm3 2a1 1 0 0 0 0 2h6a1 1 0 1 0 0-2H7Zm0 4a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H7Zm0 4a1 1 0 1 0 0 2h3a1 1 0 1 0 0-2H7Z" clipRule="evenodd" />
    </svg>
  );
}
function IconGraph() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M4 3a1 1 0 0 1 1 1v11h11a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M17.28 6.28a1 1 0 0 0-1.56-1.25l-3.72 4.65-2.19-2.19a1 1 0 0 0-1.45.06l-3 3.5a1 1 0 1 0 1.51 1.3l2.36-2.75 2.19 2.19a1 1 0 0 0 1.47-.07l4.39-5.44Z" />
    </svg>
  );
}
function IconJobs() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path fillRule="evenodd" d="M6 3a2 2 0 0 0-2 2v1H3a1 1 0 0 0-1 1v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a1 1 0 0 0-1-1h-1V5a2 2 0 0 0-2-2H6Zm8 3V5H6v1h8ZM3 9v7h14V9H3Z" clipRule="evenodd" />
    </svg>
  );
}
function IconWeights() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path fillRule="evenodd" d="M10 2a1 1 0 0 1 1 1v1.07a6.5 6.5 0 0 1 3.9 1.62l.76-.76a1 1 0 1 1 1.41 1.41l-.76.76A6.5 6.5 0 0 1 17.93 11H19a1 1 0 1 1 0 2h-1.07a6.5 6.5 0 0 1-1.62 3.9l.76.76a1 1 0 0 1-1.41 1.41l-.76-.76A6.5 6.5 0 0 1 11 17.93V19a1 1 0 1 1-2 0v-1.07a6.5 6.5 0 0 1-3.9-1.62l-.76.76a1 1 0 0 1-1.41-1.41l.76-.76A6.5 6.5 0 0 1 2.07 11H1a1 1 0 1 1 0-2h1.07a6.5 6.5 0 0 1 1.62-3.9l-.76-.76a1 1 0 0 1 1.41-1.41l.76.76A6.5 6.5 0 0 1 9 2.07V1a1 1 0 0 1 1-1Zm0 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" clipRule="evenodd" />
    </svg>
  );
}
function IconIntelligence() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M10 2a1 1 0 0 1 1 1v.09a6.02 6.02 0 0 1 3.32 1.72l.06.06a1 1 0 0 1-1.41 1.42l-.06-.06A4 4 0 1 0 14 10a1 1 0 1 1 2 0 6 6 0 1 1-6-6c.34 0 .67.03 1 .09V3a1 1 0 0 1-1-1Z" />
      <path fillRule="evenodd" d="M10 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-2 4a2 2 0 1 1 4 0 2 2 0 0 1-4 0Z" clipRule="evenodd" />
    </svg>
  );
}
function IconXai() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path fillRule="evenodd" d="M10 1a1 1 0 0 1 1 1v1.05A7.002 7.002 0 0 1 16.95 9H18a1 1 0 1 1 0 2h-1.05A7.002 7.002 0 0 1 11 16.95V18a1 1 0 1 1-2 0v-1.05A7.002 7.002 0 0 1 3.05 11H2a1 1 0 1 1 0-2h1.05A7.002 7.002 0 0 1 9 3.05V2a1 1 0 0 1 1-1Zm0 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z" clipRule="evenodd" />
    </svg>
  );
}
function IconMasterData() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M10 2 3 5.5 10 9l7-3.5L10 2Z" />
      <path d="M3 9.5 10 13l7-3.5v2.02L10 15l-7-3.48V9.5Z" />
      <path d="M3 13.5 10 17l7-3.5v2.02L10 19l-7-3.48v-2.02Z" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const dashboard = useAdminDashboard();
  const { health, skills, roles, registeredUsers, activeUsers, jobFamilies, educationLevels, salaryBenchmarks, lastImport } = dashboard;

  return (
    <PageShell>
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Enterprise Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of HireRise administration, master data, and AI operations.
        </p>
      </div>

      {/* ── Executive Overview ─────────────────────────────────────────────── */}
      <DashboardSection
        title="Executive Overview"
        description="Headline counts. Metrics without a backing API show as Unavailable rather than a fabricated value."
      >
        <DashboardGrid columns={4}>
          <MetricCard
            label="Registered Users"
            icon={<IconUsers />}
            value={registeredUsers.value ?? undefined}
            isLoading={registeredUsers.isLoading}
            isUnavailable={registeredUsers.isUnavailable}
          />
          <MetricCard
            label="Active Users"
            icon={<IconUsers />}
            isLoading={activeUsers.isLoading}
            isUnavailable={activeUsers.isUnavailable}
          />
          <MetricCard
            label="Skills"
            icon={<IconSkills />}
            value={skills.value ?? undefined}
            isLoading={skills.isLoading}
            isUnavailable={skills.isUnavailable}
          />
          <MetricCard
            label="Roles"
            icon={<IconRoles />}
            value={roles.value ?? undefined}
            isLoading={roles.isLoading}
            isUnavailable={roles.isUnavailable}
          />
          <MetricCard
            label="Job Families"
            isLoading={jobFamilies.isLoading}
            isUnavailable={jobFamilies.isUnavailable}
          />
          <MetricCard
            label="Education Levels"
            isLoading={educationLevels.isLoading}
            isUnavailable={educationLevels.isUnavailable}
          />
          <MetricCard
            label="Salary Benchmarks"
            isLoading={salaryBenchmarks.isLoading}
            isUnavailable={salaryBenchmarks.isUnavailable}
          />
          <MetricCard
            label="Last Import"
            isLoading={lastImport.isLoading}
            isUnavailable={lastImport.isUnavailable}
          />
        </DashboardGrid>
      </DashboardSection>

      {/* ── AI Operations ───────────────────────────────────────────────────── */}
      <DashboardSection
        title="AI Operations"
        description="XAI explanation pipeline usage and tier distribution."
      >
        <DashboardGrid columns={3}>
          <QuickActionCard
            title="XAI Operations"
            description="Explanation pipeline usage, tier distribution, and system health."
            icon={<IconXai />}
            href={ROUTES.ADMIN_XAI_OPERATIONS}
          />
        </DashboardGrid>
      </DashboardSection>

      {/* ── Master Data ─────────────────────────────────────────────────────── */}
      {/* WP-ADMIN-COMP-05: every Master Data module below has a certified,
          mounted admin page (see routes/index.tsx) — all eight are
          operational Dashboard links, none render disabled. */}
      <DashboardSection
        title="Master Data"
        description="Reference data shared across the platform."
      >
        <DashboardGrid columns={4}>
          <QuickActionCard
            title="Skills"
            description="Manage the skills taxonomy."
            icon={<IconSkills />}
            href={ROUTES.ADMIN_MASTER_DATA_SKILLS}
          />
          <QuickActionCard
            title="Roles"
            description="Role catalogue management."
            icon={<IconRoles />}
            href={ROUTES.ADMIN_MASTER_DATA_ROLES}
          />
          <QuickActionCard
            title="Career Domains"
            description="Career domain taxonomy."
            icon={<IconMasterData />}
            href={ROUTES.ADMIN_MASTER_DATA_CAREER_DOMAINS}
          />
          <QuickActionCard
            title="Skill Clusters"
            description="Grouped skill clusters."
            icon={<IconMasterData />}
            href={ROUTES.ADMIN_MASTER_DATA_SKILL_CLUSTERS}
          />
          <QuickActionCard
            title="Job Families"
            description="Job family taxonomy."
            icon={<IconMasterData />}
            href={ROUTES.ADMIN_MASTER_DATA_JOB_FAMILIES}
          />
          <QuickActionCard
            title="Education Levels"
            description="Education level reference data."
            icon={<IconMasterData />}
            href={ROUTES.ADMIN_MASTER_DATA_EDUCATION_LEVELS}
          />
          <QuickActionCard
            title="Salary Benchmarks"
            description="Salary benchmark reference data."
            icon={<IconMasterData />}
            href={ROUTES.ADMIN_MASTER_DATA_SALARY_BENCHMARKS}
          />
          <QuickActionCard
            title="Import"
            description="Bulk import master data records."
            icon={<IconMasterData />}
            href={ROUTES.ADMIN_MASTER_DATA_IMPORT}
          />
        </DashboardGrid>
      </DashboardSection>

      {/* ── Administration ──────────────────────────────────────────────────── */}
      <DashboardSection
        title="Administration"
        description="User directory, administrator accounts, and permission management."
      >
        <DashboardGrid columns={3}>
          <QuickActionCard
            title="Users"
            description="Enterprise user directory."
            icon={<IconUsers />}
            href={ROUTES.ADMIN_USERS}
          />
          <QuickActionCard
            title="Administrators"
            description="Manage administrator accounts."
            icon={<IconAdministrators />}
            href={ROUTES.ADMIN_ADMINISTRATORS}
          />
          <QuickActionCard
            title="Permissions"
            description="Permission catalog, assignments, and evaluation."
            icon={<IconPermissions />}
            href={ROUTES.ADMIN_PERMISSIONS}
          />
        </DashboardGrid>
      </DashboardSection>

      {/* ── CMS ──────────────────────────────────────────────────────────────── */}
      <DashboardSection title="CMS">
        <DashboardGrid columns={3}>
          <QuickActionCard
            title="Content Management"
            description="Site content and page management."
            icon={<IconCms />}
            href={ROUTES.ADMIN_CMS}
            badge={{ variant: 'coming-soon' }}
          />
        </DashboardGrid>
      </DashboardSection>

      {/* ── Operations ───────────────────────────────────────────────────────── */}
      {/* WP-ADMIN-COMP-06: Jobs is now a genuinely operational module (List,
          Detail, Trigger Sync, sync status/history — see JobsPage.tsx) and
          no longer carries a Coming Soon badge. Intelligence, Graph, and
          Weights remain genuinely incomplete — routes are mounted (so the
          pages are reachable for whoever is verifying them) but each is
          explicitly badged Coming Soon rather than presented as
          operational. */}
      <DashboardSection title="Operations">
        <DashboardGrid columns={4}>
          <QuickActionCard title="Jobs" description="Job listings & ingestion sync." icon={<IconJobs />} href={ROUTES.ADMIN_JOBS} />
          <QuickActionCard title="Intelligence" description="Career intelligence pipeline." icon={<IconIntelligence />} href={ROUTES.ADMIN_INTELLIGENCE} badge={{ variant: 'coming-soon' }} />
          <QuickActionCard title="Graph" description="Career graph administration." icon={<IconGraph />} href={ROUTES.ADMIN_GRAPH} badge={{ variant: 'coming-soon' }} />
          <QuickActionCard title="Weights" description="Adaptive scoring weights." icon={<IconWeights />} href={ROUTES.ADMIN_WEIGHTS} badge={{ variant: 'coming-soon' }} />
        </DashboardGrid>
      </DashboardSection>

      {/* ── System Health ────────────────────────────────────────────────────── */}
      <DashboardSection
        title="System Health"
        description="Only fields the health API actually exposes are shown here."
      >
        <HealthWidget health={health} />
      </DashboardSection>
    </PageShell>
  );
}
