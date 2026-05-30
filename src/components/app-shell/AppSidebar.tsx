

/**
 * components/app-shell/AppSidebar.tsx
 *
 * Application sidebar — desktop persistent rail + mobile drawer overlay.
 *
 * RESPONSIBILITIES:
 *  - Render AppNavigation in a positioned sidebar container
 *  - Desktop: always-visible left rail (w-56)
 *  - Mobile: off-canvas drawer, toggled by AppHeader's menu button
 *  - Wordmark / branding slot
 *  - User identity footer slot (future: avatar + settings)
 *
 * DOES NOT OWN:
 *  - Navigation items (AppNavigation owns those)
 *  - Auth logic
 *  - Page content
 *
 * RESPONSIVE STRATEGY:
 *  - lg+ : static sidebar rendered alongside content (CSS flex layout)
 *  - < lg : overlay drawer, controlled by `isOpen` prop
 *
 * FUTURE INSERTION POINTS (marked with comments):
 *  - Workspace switcher (top of sidebar)
 *  - Notification bell (sidebar header)
 *  - AI copilot panel toggle
 *  - User avatar / settings link (sidebar footer)
 */

import { AppNavigation } from './AppNavigation';

interface AppSidebarProps {
  userType: 'student' | 'professional' | 'market' | null | undefined; // 'market' retained for type compat with existing sessions
  userName?: string;
  /** Mobile drawer open state (ignored on lg+). */
  isOpen: boolean;
  /** Called when the user taps the overlay or a nav item on mobile. */
  onClose: () => void;
}

export function AppSidebar({ userType, userName, isOpen, onClose }: AppSidebarProps) {
  return (
    <>
      {/* ── DESKTOP SIDEBAR ─────────────────────────────────────────────── */}
      <aside
        className="hidden lg:flex lg:flex-shrink-0"
        aria-label="Main navigation"
      >
        <SidebarInner userType={userType} userName={userName} />
      </aside>

      {/* ── MOBILE OVERLAY ──────────────────────────────────────────────── */}
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          aria-hidden="true"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={[
          'fixed inset-y-0 left-0 z-40 flex lg:hidden',
          'transition-transform duration-250 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        aria-label="Mobile navigation"
      >
        <SidebarInner
          userType={userType}
          userName={userName}
          onNavigate={onClose}
        />
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INNER SIDEBAR — shared between desktop and mobile drawer
// ─────────────────────────────────────────────────────────────────────────────

interface SidebarInnerProps {
  userType: AppSidebarProps['userType'];
  userName?: string;
  onNavigate?: () => void;
}

function SidebarInner({ userType, userName, onNavigate }: SidebarInnerProps) {
  return (
    <div className="flex w-56 flex-col bg-background border-r border-border">
      {/* Branding */}
      <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
        {/* FUTURE INSERTION POINT: workspace switcher replaces this wordmark */}
        <span className="text-sm font-bold tracking-tight text-foreground">
          HireRise
        </span>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <AppNavigation
          userType={userType}
          onNavigate={onNavigate}
        />
      </div>

      {/* User footer — FUTURE INSERTION POINT: avatar + settings */}
      {userName && (
        <div className="shrink-0 border-t border-border px-4 py-3">
          <p className="truncate text-xs text-muted-foreground">{userName}</p>
        </div>
      )}
    </div>
  );
}