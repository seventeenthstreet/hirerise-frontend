'use client';

// components/layout/Topbar.tsx
// Dashboard topbar: page title, user avatar, sign out.

import { usePathname } from 'next/navigation';
import { useAuth } from '@/features/auth/components/AuthProvider';
import { cn } from '@/utils/cn';

// ─── Page title map ───────────────────────────────────────────────────────────

const pageTitles: Record<string, { title: string; description: string }> = {
  '/dashboard':  { title: 'Dashboard',  description: 'Your career overview at a glance' },
  '/skills':     { title: 'Skills',     description: 'Explore and track your skill profile' },
  '/profile':    { title: 'Profile',    description: 'Manage your career profile' },
  '/resume':     { title: 'Resume',     description: 'Upload and analyse your resume' },
  '/analytics':  { title: 'Analytics',  description: 'Career Health Index and insights' },
  '/settings':   { title: 'Settings',   description: 'Account preferences and billing' },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface TopbarProps {
  className?: string;
}

export function Topbar({ className }: TopbarProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  // Match the current route to a page title
  const currentPage = Object.entries(pageTitles).find(([route]) =>
    route === pathname || pathname.startsWith(route + '/'),
  );
  const { title, description } = currentPage?.[1] ?? {
    title:       'HireRise',
    description: '',
  };

  const initials = user?.displayName
    ? user.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <header className={cn(
      'flex h-14 flex-shrink-0 items-center justify-between border-b border-surface-100 bg-white px-6',
      className,
    )}>
      {/* Page context */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-surface-900 leading-none">{title}</h1>
          {description && (
            <p className="mt-0.5 text-xs text-surface-400 truncate">{description}</p>
          )}
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        {/* Credits badge */}
        {user && (
          <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-surface-200 bg-surface-50 px-2.5 py-1">
            <svg className="h-3 w-3 text-hr-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd"
                d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                clipRule="evenodd" />
            </svg>
            <span className="text-xs font-medium text-surface-600">
              {user.aiCreditsRemaining} credits
            </span>
          </div>
        )}

        {/* Notification bell (placeholder) */}
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg text-surface-400 transition-colors hover:bg-surface-50 hover:text-surface-700"
          aria-label="Notifications"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </button>

        {/* Divider */}
        <div className="h-5 w-px bg-surface-200" />

        {/* User + sign out */}
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-hr-100 text-xs font-semibold text-hr-700 flex-shrink-0">
            {initials}
          </div>
          <span className="hidden md:block max-w-[140px] truncate text-xs font-medium text-surface-700">
            {user?.email}
          </span>
        </div>

        <button
          onClick={signOut}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-surface-500 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>
      </div>
    </header>
  );
}