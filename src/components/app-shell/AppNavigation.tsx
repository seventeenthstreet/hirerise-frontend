'use client';

/**
 * components/app-shell/AppNavigation.tsx
 *
 * Role-aware navigation composition layer.
 *
 * RESPONSIBILITIES:
 *  - Defines which nav sections/items are shown per user_type
 *  - Composes AppNavSection + AppNavItem
 *  - Exposes the nav items list (used by AppSidebar)
 *
 * DOES NOT OWN:
 *  - Sidebar layout/positioning (AppSidebar owns that)
 *  - Auth logic
 *  - Any state other than active-route detection (delegated to AppNavItem)
 *
 * DESIGN:
 *  Explicit, readable arrays — NOT a config engine or permission framework.
 *  Adding a new nav item = adding one object to the relevant array.
 *
 * ROLE AWARENESS:
 *  - null / undefined user_type → minimal nav (direction not chosen yet)
 *  - 'student'      → student-oriented links
 *  - 'professional' → career/resume links
 *  - 'market'       → market insights links
 *
 * FUTURE INSERTION POINTS (marked with comments):
 *  - AI Copilot panel link
 *  - Notifications badge
 *  - Workspace switcher
 *  - Admin section
 */

import type { ReactNode } from 'react';
import { AppNavSection } from './AppNavSection';
import { AppNavItem }    from './AppNavItem';
import type { NavItemDef } from './AppNavItem';

// ─────────────────────────────────────────────────────────────────────────────
// ICONS — inline SVGs keep the shell dependency-free (no icon library needed)
// ─────────────────────────────────────────────────────────────────────────────

function IconDashboard() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M2 10a8 8 0 1 1 16 0A8 8 0 0 1 2 10Zm8-5a1 1 0 0 1 1 1v3.586l2.707 2.707a1 1 0 0 1-1.414 1.414l-3-3A1 1 0 0 1 9 10V6a1 1 0 0 1 1-1Z" />
    </svg>
  );
}
function IconResume() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path fillRule="evenodd" d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Zm2 6a1 1 0 0 1 1-1h6a1 1 0 0 1 0 2H7a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H7Z" clipRule="evenodd" />
    </svg>
  );
}
function IconInsights() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M15.5 2A1.5 1.5 0 0 0 14 3.5v13a1.5 1.5 0 0 0 3 0v-13A1.5 1.5 0 0 0 15.5 2ZM9.5 7A1.5 1.5 0 0 0 8 8.5v8a1.5 1.5 0 0 0 3 0v-8A1.5 1.5 0 0 0 9.5 7ZM3.5 12A1.5 1.5 0 0 0 2 13.5v3a1.5 1.5 0 0 0 3 0v-3A1.5 1.5 0 0 0 3.5 12Z" />
    </svg>
  );
}
function IconOnboarding() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-6-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm-2 4a5 5 0 0 0-4.546 2.916A5.986 5.986 0 0 0 10 16a5.986 5.986 0 0 0 4.546-2.084A5 5 0 0 0 10 11Z" clipRule="evenodd" />
    </svg>
  );
}
function IconAnalytics() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M12 9a1 1 0 0 1-1-1V3c0-.552.45-1.007.997-.93a7.004 7.004 0 0 1 5.933 5.933c.078.547-.378.997-.93.997h-5Z" />
      <path d="M8.005 12c.074.612.108 1.234.1 1.859C8.096 15.95 7 17 5 17a6 6 0 0 1-6-6c0-2 1.05-3.097 3.141-3.105.625-.008 1.247.026 1.859.1A1 1 0 0 1 5 9h3a1 1 0 0 1 1 1v3a1 1 0 0 1-.995.995v.005Z" />
    </svg>
  );
}
// FUTURE INSERTION POINT: add IconAICopilot, IconNotifications, IconSettings here

// ─────────────────────────────────────────────────────────────────────────────
// NAV DEFINITIONS — role-scoped item arrays
// ─────────────────────────────────────────────────────────────────────────────

type UserType = 'student' | 'professional' | 'market' | null | undefined;

/** Core items shown to all authenticated users */
const CORE_ITEMS: NavItemDef[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <IconDashboard />, exact: true },
];

/** Items only for professional users */
const PROFESSIONAL_ITEMS: NavItemDef[] = [
  { label: 'Resume',    href: '/resume',    icon: <IconResume /> },
  { label: 'Insights',  href: '/dashboard/analytics', icon: <IconAnalytics /> },
];

/** Items only for student users */
const STUDENT_ITEMS: NavItemDef[] = [
  { label: 'Education Onboarding', href: '/education/onboarding', icon: <IconOnboarding /> },
  { label: 'Insights',             href: '/dashboard/analytics',  icon: <IconAnalytics /> },
];

// MVP SCOPE: MARKET_ITEMS removed. Re-add post-MVP when Market Insights launches.
// FUTURE INSERTION POINT: ADMIN_ITEMS, ENTERPRISE_ITEMS

// ─────────────────────────────────────────────────────────────────────────────
// HOOK — resolves nav items from user_type
// ─────────────────────────────────────────────────────────────────────────────

export function useNavItems(userType: UserType): {
  coreItems: NavItemDef[];
  roleItems: NavItemDef[];
} {
  const roleItems: NavItemDef[] =
    userType === 'professional' ? PROFESSIONAL_ITEMS
    : userType === 'student'    ? STUDENT_ITEMS
    : /* 'market' and unknown fall through to core-only nav in MVP */  [];

  return { coreItems: CORE_ITEMS, roleItems };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface AppNavigationProps {
  userType: UserType;
  iconOnly?: boolean;
  onNavigate?: () => void;
}

export function AppNavigation({ userType, iconOnly, onNavigate }: AppNavigationProps) {
  const { coreItems, roleItems } = useNavItems(userType);

  return (
    <nav aria-label="Application navigation" className="flex flex-col gap-4">
      {/* Core section — always visible */}
      <AppNavSection>
        {coreItems.map((item) => (
          <AppNavItem
            key={item.href}
            {...item}
            iconOnly={iconOnly}
            onClick={onNavigate}
          />
        ))}
      </AppNavSection>

      {/* Role-specific section */}
      {roleItems.length > 0 && (
        <AppNavSection label={iconOnly ? undefined : 'Tools'}>
          {roleItems.map((item) => (
            <AppNavItem
              key={item.href}
              {...item}
              iconOnly={iconOnly}
              onClick={onNavigate}
            />
          ))}
        </AppNavSection>
      )}

      {/*
        FUTURE INSERTION POINT — bottom slot (AI copilot, notifications)
        <AppNavSection label="AI" className="mt-auto">
          <AppNavItem label="Career Copilot" href="/copilot" icon={<IconAICopilot />} />
        </AppNavSection>
      */}
    </nav>
  );
}