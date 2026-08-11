/**
 * components/admin-shell/AdminNavigation.tsx
 *
 * Static navigation for the /admin/* console.
 *
 * Unlike AppNavigation (role-resolved via useNavItems/userType), admin nav
 * is not persona-driven — it's a fixed set of console sections. Reuses the
 * same generic AppNavSection / AppNavItem primitives from the app-shell
 * system so the two shells share one visual language and one nav-item
 * contract (NavItemDef), per the "do not create a second design system"
 * constraint.
 *
 * WP-ADMIN-03 Phase 2: Dashboard is now the /admin index route (see
 * routes/index.tsx) and is linked here with `exact` so it only highlights
 * on the index route itself, not on every /admin/* sub-route. AI Operations
 * (XaiOperationsDashboardPage) previously existed on disk with a route
 * constant but no mounted route — it is now mounted and linked here,
 * resolving the orphan noted in the WP-ADMIN-01C-FIX certification report.
 * Settings remains a placeholder landing page only (no implementation);
 * Users, Administrators, and Permissions are live modules. All four get
 * their own "System" section so they're grouped apart from the Console
 * modules above.
 *
 * WP-ADMIN-02A: the "Master Data" section went live with its first module,
 * Skills. WP-ADMIN-COMP-03 completed the remaining Master Data admin pages
 * (Roles, Career Domains, Skill Clusters, Job Families, Education Levels,
 * Salary Benchmarks, Import) — all are mounted routes and linked below.
 */

import { AppNavSection } from '@/components/app-shell';
import { AppNavItem } from '@/components/app-shell';
import type { NavItemDef } from '@/components/app-shell';
import { ROUTES } from '@/routes/routes.constants';

// ─────────────────────────────────────────────────────────────────────────────
// ICONS — inline SVGs, consistent with app-shell's dependency-free approach
// ─────────────────────────────────────────────────────────────────────────────

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
function IconMasterData() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M10 2 3 5.5 10 9l7-3.5L10 2Z" />
      <path d="M3 9.5 10 13l7-3.5v2.02L10 15l-7-3.48V9.5Z" />
      <path d="M3 13.5 10 17l7-3.5v2.02L10 19l-7-3.48v-2.02Z" />
    </svg>
  );
}
function IconDashboard() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M3 3h6v6H3V3Zm8 0h6v4h-6V3ZM3 11h6v6H3v-6Zm8 2h6v4h-6v-4Z" />
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
function IconUsers() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M10 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-6 9a6 6 0 1 1 12 0H4Z" />
    </svg>
  );
}
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
function IconSettings() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567l-.091.549a.798.798 0 0 1-.517.608 7.45 7.45 0 0 0-.478.198.798.798 0 0 1-.796-.064l-.453-.324a1.875 1.875 0 0 0-2.416.2l-.243.243a1.875 1.875 0 0 0-.2 2.416l.324.453a.798.798 0 0 1 .064.796 7.448 7.448 0 0 0-.198.478.798.798 0 0 1-.608.517l-.549.091A1.875 1.875 0 0 0 1.5 11.078v.344c0 .917.663 1.699 1.567 1.85l.549.091c.281.047.514.238.608.517.06.162.127.321.198.478a.798.798 0 0 1-.064.796l-.324.453a1.875 1.875 0 0 0 .2 2.416l.243.243c.648.648 1.67.71 2.416.2l.453-.324a.798.798 0 0 1 .796-.064c.157.071.316.138.478.198.279.094.47.327.517.608l.091.549a1.875 1.875 0 0 0 1.85 1.567h.344c.917 0 1.699-.663 1.85-1.567l.091-.549a.798.798 0 0 1 .517-.608 7.52 7.52 0 0 0 .478-.198.798.798 0 0 1 .796.064l.453.324a1.875 1.875 0 0 0 2.416-.2l.243-.243c.648-.648.71-1.67.2-2.416l-.324-.453a.798.798 0 0 1-.064-.796c.071-.157.138-.316.198-.478.094-.279.327-.47.608-.517l.549-.091a1.875 1.875 0 0 0 1.567-1.85v-.344c0-.917-.663-1.699-1.567-1.85l-.549-.091a.798.798 0 0 1-.608-.517 7.507 7.507 0 0 0-.198-.478.798.798 0 0 1 .064-.796l.324-.453a1.875 1.875 0 0 0-.2-2.416l-.243-.243a1.875 1.875 0 0 0-2.416-.2l-.453.324a.798.798 0 0 1-.796.064 7.462 7.462 0 0 0-.478-.198.798.798 0 0 1-.517-.608l-.091-.549A1.875 1.875 0 0 0 11.422 2.25h-.344ZM10 13.75a3.75 3.75 0 1 1 0-7.5 3.75 3.75 0 0 1 0 7.5Z" clipRule="evenodd" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NAV DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

const CONSOLE_ITEMS: NavItemDef[] = [
  { label: 'Dashboard',    href: ROUTES.ADMIN_ROOT,         icon: <IconDashboard />, exact: true },
  { label: 'CMS',          href: ROUTES.ADMIN_CMS,          icon: <IconCms /> },
  { label: 'Graph',        href: ROUTES.ADMIN_GRAPH,        icon: <IconGraph /> },
  { label: 'Jobs',         href: ROUTES.ADMIN_JOBS,         icon: <IconJobs /> },
  { label: 'Weights',      href: ROUTES.ADMIN_WEIGHTS,      icon: <IconWeights /> },
  { label: 'Intelligence', href: ROUTES.ADMIN_INTELLIGENCE, icon: <IconIntelligence /> },
  { label: 'AI Operations', href: ROUTES.ADMIN_XAI_OPERATIONS, icon: <IconXai /> },
];

// WP-ADMIN-02A: Skills is the first Master Data module.
// WP-ADMIN-COMP-03: Roles / Career Domains / Skill Clusters / Job Families /
// Education Levels / Salary Benchmarks / Import are now connected — this is
// the implementation work package referenced in the WP-ADMIN-02A comment.
const MASTER_DATA_ITEMS: NavItemDef[] = [
  { label: 'Skills',             href: ROUTES.ADMIN_MASTER_DATA_SKILLS,             icon: <IconMasterData /> },
  { label: 'Roles',              href: ROUTES.ADMIN_MASTER_DATA_ROLES,              icon: <IconMasterData /> },
  { label: 'Career Domains',     href: ROUTES.ADMIN_MASTER_DATA_CAREER_DOMAINS,     icon: <IconMasterData /> },
  { label: 'Skill Clusters',     href: ROUTES.ADMIN_MASTER_DATA_SKILL_CLUSTERS,     icon: <IconMasterData /> },
  { label: 'Job Families',       href: ROUTES.ADMIN_MASTER_DATA_JOB_FAMILIES,       icon: <IconMasterData /> },
  { label: 'Education Levels',   href: ROUTES.ADMIN_MASTER_DATA_EDUCATION_LEVELS,   icon: <IconMasterData /> },
  { label: 'Salary Benchmarks',  href: ROUTES.ADMIN_MASTER_DATA_SALARY_BENCHMARKS,  icon: <IconMasterData /> },
  { label: 'Import',             href: ROUTES.ADMIN_MASTER_DATA_IMPORT,             icon: <IconMasterData /> },
];

// WP-ADMIN-03 Phase 2 originally shipped Users as a placeholder landing
// page (no implementation); WP-ADMIN-04/04C/COMP-04 made it a fully live
// module (User Directory, Edit Profile, Manage Roles, Manage Permissions,
// Enable/Disable Account, Audit History). Settings remains a placeholder
// landing page today. Kept in its own "System" section so it's visually
// distinct from the Console modules above.
//
// WP-ADMIN-04F-09: Permissions consumes the certified Permission
// Administration API (WP-ADMIN-04F-08) end to end (Catalog, Detail,
// Assignments, Evaluation). Placed next to Users since every Permission
// Assignment's principal is an enterprise User.
// WP-ADMIN-05A — Administrators (admin_principals) is a distinct entity
// from application Users (public.users) above; own link, own detail route.
const SYSTEM_ITEMS: NavItemDef[] = [
  { label: 'Users',          href: ROUTES.ADMIN_USERS,           icon: <IconUsers /> },
  { label: 'Administrators', href: ROUTES.ADMIN_ADMINISTRATORS,  icon: <IconAdministrators /> },
  { label: 'Permissions',    href: ROUTES.ADMIN_PERMISSIONS,     icon: <IconPermissions /> },
  { label: 'Settings',       href: ROUTES.ADMIN_SETTINGS,        icon: <IconSettings /> },
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface AdminNavigationProps {
  iconOnly?: boolean;
  onNavigate?: () => void;
}

export function AdminNavigation({ iconOnly, onNavigate }: AdminNavigationProps) {
  return (
    <nav aria-label="Admin navigation" className="flex flex-col gap-4">
      <AppNavSection label={iconOnly ? undefined : 'Console'}>
        {CONSOLE_ITEMS.map((item) => (
          <AppNavItem key={item.href} {...item} iconOnly={iconOnly} onClick={onNavigate} />
        ))}
      </AppNavSection>

      {MASTER_DATA_ITEMS.length > 0 && (
        <AppNavSection label={iconOnly ? undefined : 'Master Data'}>
          {MASTER_DATA_ITEMS.map((item) => (
            <AppNavItem key={item.href} {...item} iconOnly={iconOnly} onClick={onNavigate} />
          ))}
        </AppNavSection>
      )}

      <AppNavSection label={iconOnly ? undefined : 'System'}>
        {SYSTEM_ITEMS.map((item) => (
          <AppNavItem key={item.href} {...item} iconOnly={iconOnly} onClick={onNavigate} />
        ))}
      </AppNavSection>
    </nav>
  );
}
