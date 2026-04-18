'use client';

import Link from 'next/link';
import { useAuth } from '@/features/auth/components/AuthProvider';
import { SidebarItem } from './SidebarItem';
import { cn } from '@/utils/cn';

// ── Student nav (Issues 1 & 2) ────────────────────────────────────────────────
const STUDENT_NAV_ITEMS = [
  {
    href: '/student-dashboard',
    label: 'Modules',
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>,
  },
  {
    href: '/intelligence',
    label: 'Career Discovery',
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  },
  {
    href: '/advisor',
    label: 'AI Career Assessment',
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
  },
  {
    href: '/education/skills/me',
    label: 'Education Planner',
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
  },
  {
    href: '/career-simulator',
    label: 'Future Career Paths',
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>,
  },
  {
    href: '/analytics',
    label: 'Salary Explorer',
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  {
    href: '/advisor',
    label: 'AI Career Advisor',
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  },
];

// ── Professional nav (existing) ───────────────────────────────────────────────
const PROFESSIONAL_NAV_ITEMS = [
  {
    href: '/dashboard',
    label: 'Modules',
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>,
  },
  {
    href: '/analytics',
    label: 'Career Intelligence',
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  {
    href: '/cv-builder',
    label: 'CV Optimizer',
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  },
  {
    href: '/skills',
    label: 'Skill Demand Intelligence',
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
  },
  {
    href: '/skill-graph',
    label: 'Skill Graph Insights',
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" /></svg>,
  },
  {
    href: '/job-matches',
    label: 'Job Matches',
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  },
  {
    href: '/interview-prep',
    label: 'Interview Prep',
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
  },
  {
    href: '/salary-predictor',
    label: 'Salary Predictor',
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  {
    href: '/career-health',
    label: 'Career Health Index',
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>,
  },
  {
    href: '/career-simulator',
    label: 'Career Digital Twin',
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  },
  {
    href: '/job-fit',
    label: 'Job Fit',
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
}

export function Sidebar({ collapsed, onToggle, className }: SidebarProps) {
  const { user, signOut } = useAuth() as any;

  const isStudent   = user?.user_type === 'student';
  const navItems    = isStudent ? STUDENT_NAV_ITEMS : PROFESSIONAL_NAV_ITEMS;
  const homeHref    = isStudent ? '/student-dashboard' : '/dashboard';
  const accentHex   = isStudent ? '#a78bfa' : '#3d65f6';
  const accentGlow  = isStudent ? 'rgba(167,139,250,0.4)' : 'rgba(61,101,246,0.4)';
  const accentBadgeBg = isStudent ? 'rgba(167,139,250,0.15)' : 'rgba(61,101,246,0.15)';

  return (
    <aside
      className={cn(
        'flex h-full flex-col transition-all duration-300',
        'border-r border-white/[0.06] bg-surface-950',
        collapsed ? 'w-16' : 'w-60',
        className,
      )}
      style={{ boxShadow: '2px 0 16px rgba(0,0,0,0.3)' }}
    >
      {/* Logo */}
      <div className={cn('flex h-14 shrink-0 items-center', collapsed ? 'justify-center px-2' : 'gap-2.5 px-4')}>
        <Link href={homeHref} className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
            style={{ background: accentHex, boxShadow: `0 0 16px ${accentGlow}` }}
          >
            <span className="text-xs font-black text-white tracking-tight">HR</span>
          </div>
          {!collapsed && (
            <div>
              <span className="text-sm font-black tracking-tight text-white">HireRise</span>
              <span
                className="ml-1.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest"
                style={{ background: accentBadgeBg, color: accentHex }}
              >
                {isStudent ? 'Student' : 'Beta'}
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-4 scrollbar-thin">
        <div className="space-y-0.5">
          {navItems.map((item) => (
            <SidebarItem
              key={item.href + item.label}
              href={item.href}
              label={item.label}
              icon={item.icon}
              collapsed={collapsed}
            />
          ))}
        </div>
      </nav>

      {/* User footer */}
      <div
        className={cn('shrink-0 p-3', collapsed ? 'flex justify-center' : '')}
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        {collapsed ? (
          <button
            onClick={onToggle}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/25 hover:bg-white/5 hover:text-white/55 transition-colors"
            title="Expand sidebar"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={{ background: accentBadgeBg, color: accentHex }}
            >
              {user?.displayName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-semibold text-white/75">
                {user?.displayName ?? user?.email?.split('@')[0] ?? 'User'}
              </p>
              <p className="truncate text-[10px] text-white/28">{user?.email ?? ''}</p>
            </div>
            <button
              onClick={onToggle}
              className="shrink-0 flex h-6 w-6 items-center justify-center rounded-md text-white/18 hover:bg-white/5 hover:text-white/45 transition-colors"
              title="Collapse sidebar"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}