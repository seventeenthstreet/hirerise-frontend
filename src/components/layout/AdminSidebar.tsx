'use client';

// components/layout/AdminSidebar.tsx
//
// Role-aware sidebar:
//   MASTER_ADMIN / admin / super_admin — full nav including Approval Queue and Contributors
//   contributor                        — limited nav: Dashboard + Submit Entry only

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/features/auth/components/AuthProvider';
import { cn } from '@/utils/cn';

// ─── Icons ────────────────────────────────────────────────────────────────────

const Icons = {
  dashboard:    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  skill:        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
  role:         <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  jobFamily:    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  education:    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 14l9-5-9-5-9 5 9 5zm0 7v-7.5l4-2.222" /></svg>,
  salary:       <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  import:       <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
  approval:     <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  contributors: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  submit:       <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4v16m8-8H4" /></svg>,
  myentries:    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
  secrets:      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>,
  careerDomain: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  skillCluster: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
  transition:   <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>,
  link:         <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
  shield:       <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  logs:         <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
  importCenter: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
  // Graph Intelligence
  explore:      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  skillExplore: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
  pathSim:      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  impact:       <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  market:       <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
};

// ─── Nav config ───────────────────────────────────────────────────────────────

const ADMIN_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', href: '/admin/dashboard', icon: Icons.dashboard },
    ],
  },
  {
    label: 'Career Graph',
    items: [
      { label: 'Manage Roles',        href: '/admin/graph/career',      icon: Icons.role       },
      { label: 'Career Transitions',  href: '/admin/graph/transitions', icon: Icons.transition },
      { label: 'Role Skills',         href: '/admin/graph/role-skills', icon: Icons.link       },
    ],
  },
  {
    label: 'Skill Graph',
    items: [
      { label: 'Manage Skills',       href: '/admin/graph/skills',     icon: Icons.skill      },
      { label: 'Skill Relationships', href: '/admin/graph/skill-rels', icon: Icons.link       },
    ],
  },
  {
    label: 'Market Intelligence',
    items: [
      { label: 'Education Mapping', href: '/admin/graph/education', icon: Icons.education },
      { label: 'Salary Benchmarks', href: '/admin/graph/salary',    icon: Icons.salary    },
    ],
  },
  {
    label: 'Data Tools',
    items: [
      { label: 'Import Center',   href: '/admin/import-center',   icon: Icons.importCenter },
      { label: 'Graph Validator', href: '/admin/graph/validator', icon: Icons.shield       },
      { label: 'Import Logs',     href: '/admin/graph/logs',      icon: Icons.logs         },
    ],
  },
  {
    label: 'Graph Intelligence',
    items: [
      { label: 'Career Graph Explorer', href: '/admin/graph-intelligence/career-graph',       icon: Icons.explore      },
      { label: 'Skill Graph Explorer',  href: '/admin/graph-intelligence/skill-graph',        icon: Icons.skillExplore },
      { label: 'Path Simulator',        href: '/admin/graph-intelligence/path-simulator',     icon: Icons.pathSim      },
      { label: 'Role Impact Analyzer',  href: '/admin/graph-intelligence/role-impact',        icon: Icons.impact       },
      { label: 'Market Intelligence',   href: '/admin/graph-intelligence/market-intelligence', icon: Icons.market       },
    ],
  },
  {
    label: 'CMS',
    items: [
      { label: 'Career Domains',   href: '/admin/cms/career-domains',  icon: Icons.careerDomain },
      { label: 'Job Families',     href: '/admin/cms/job-families',    icon: Icons.jobFamily    },
      { label: 'Skill Clusters',   href: '/admin/cms/skill-clusters',  icon: Icons.skillCluster },
      { label: 'Education Levels', href: '/admin/cms/education-levels', icon: Icons.education   },
    ],
  },
  {
    label: 'Approvals',
    items: [
      { label: 'Approval Queue', href: '/admin/approvals',    icon: Icons.approval     },
      { label: 'Contributors',   href: '/admin/contributors', icon: Icons.contributors },
    ],
  },
  {
    label: 'Market APIs',
    masterAdminOnly: true,
    items: [
      { label: 'Market Data Sources', href: '/admin/market-intelligence',               icon: Icons.market  },
      { label: 'API Configuration',   href: '/admin/market-intelligence?tab=config',    icon: Icons.secrets },
      { label: 'Market Analytics',    href: '/admin/market-intelligence?tab=analytics', icon: Icons.impact  },
    ],
  },
  {
    label: 'Platform Intelligence',
    masterAdminOnly: true,
    items: [
      { label: 'AI Engine Control',   href: '/admin/platform-intelligence?tab=ai-engine',    icon: Icons.skill      },
      { label: 'Market Data APIs',    href: '/admin/platform-intelligence?tab=market-data',  icon: Icons.market     },
      { label: 'Career Datasets',     href: '/admin/platform-intelligence?tab=datasets',     icon: Icons.importCenter },
      { label: 'CHI Configuration',   href: '/admin/platform-intelligence?tab=chi',          icon: Icons.impact     },
      { label: 'Skill Taxonomy',      href: '/admin/platform-intelligence?tab=taxonomy',     icon: Icons.skillCluster },
      { label: 'Career Path Rules',   href: '/admin/platform-intelligence?tab=career-paths', icon: Icons.transition },
      { label: 'Training Providers',  href: '/admin/platform-intelligence?tab=training',     icon: Icons.education  },
      { label: 'User Plans',          href: '/admin/platform-intelligence?tab=plans',        icon: Icons.salary     },
      { label: 'AI Usage Analytics',  href: '/admin/platform-intelligence?tab=usage',        icon: Icons.logs       },
      { label: 'Feature Flags',       href: '/admin/platform-intelligence?tab=flags',        icon: Icons.shield     },
      { label: 'AI Prompt Manager',   href: '/admin/platform-intelligence?tab=prompts',      icon: Icons.role       },
    ],
  },
  {
    label: 'Security',
    masterAdminOnly: true,
    items: [
      { label: 'Secrets Manager', href: '/admin/secrets', icon: Icons.secrets },
    ],
  },
];

const CONTRIBUTOR_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', href: '/admin/dashboard', icon: Icons.dashboard },
    ],
  },
  {
    label: 'My Work',
    items: [
      { label: 'Submit Entry', href: '/admin/submit',     icon: Icons.submit    },
      { label: 'My Entries',   href: '/admin/my-entries', icon: Icons.myentries },
    ],
  },
];

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function AdminSidebar() {
  const pathname = usePathname();
  const { isAdmin, isMasterAdmin, isContributor, role } = useAuth();

  const sections = (isAdmin) ? ADMIN_SECTIONS : CONTRIBUTOR_SECTIONS;

  const roleLabel = isMasterAdmin
    ? 'Master Admin'
    : role === 'super_admin'
      ? 'Super Admin'
      : role === 'admin'
        ? 'Admin'
        : 'Contributor';

  const roleBadgeColor = isMasterAdmin
    ? 'bg-violet-100 text-violet-700'
    : isAdmin
      ? 'bg-hr-100 text-hr-700'
      : 'bg-amber-100 text-amber-700';

  return (
    <aside className="flex h-full w-60 flex-col border-r border-surface-100 bg-white">
      {/* Logo */}
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-surface-100 px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-hr-600">
          <span className="text-xs font-bold text-white">HR</span>
        </div>
        <span className="font-display text-sm font-semibold tracking-tight text-surface-900">
          HireRise <span className="font-normal text-surface-400">Admin</span>
        </span>
      </div>

      {/* Role badge */}
      <div className="px-4 py-2 border-b border-surface-50">
        <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider', roleBadgeColor)}>
          {roleLabel}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {sections
          .filter(section => !('masterAdminOnly' in section) || !section.masterAdminOnly || isMasterAdmin)
          .map(section => (
          <div key={section.label}>
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-surface-300">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map(item => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-hr-50 text-hr-700'
                          : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900',
                      )}
                    >
                      <span className={cn('shrink-0', isActive ? 'text-hr-600' : 'text-surface-400')}>
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-surface-100 px-5 py-3">
        <p className="text-[10px] text-surface-400">v1.4.0 · Two-tier admin</p>
      </div>
    </aside>
  );
}