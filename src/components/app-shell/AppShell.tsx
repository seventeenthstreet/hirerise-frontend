'use client';

/**
 * components/app-shell/AppShell.tsx
 *
 * Root application shell.
 *
 * RESPONSIBILITIES (owns):
 *  - Viewport layout: sidebar + header + content (CSS flex)
 *  - Mobile drawer open/close state
 *  - Responsive shell behavior: desktop rail vs mobile drawer
 *  - Composition of: AppSidebar + AppHeader + AppContent
 *  - Shell persistence across route transitions
 *    (placed in (auth)/layout.tsx — never unmounts on navigation)
 *
 * DOES NOT OWN:
 *  - User data fetching (caller passes user)
 *  - Auth gating (pages own their guards)
 *  - Navigation items (AppNavigation owns those)
 *  - Page content (children slot)
 *  - Any React Query calls
 *
 * USAGE (in (auth)/layout.tsx):
 *   <AppShell user={user}>
 *     {children}
 *   </AppShell>
 *
 * FUTURE INSERTION POINTS (marked with comments):
 *  - Command palette overlay
 *  - Notification panel
 *  - AI copilot side panel
 *  - Activity feed drawer
 */

import { useState, type ReactNode } from 'react';
import { AppSidebar }    from './AppSidebar';
import { AppHeader }     from './AppHeader';
import { AppContent }    from './AppContent';

interface AppShellUser {
  name?: string;
  user_type: 'student' | 'professional' | 'market' | null;
}

interface AppShellProps {
  children: ReactNode;
  /**
   * User object — drives role-aware navigation.
   * Shell renders even when null (during hydration); nav shows minimal items.
   */
  user: AppShellUser | null;
  /**
   * Optional header title. Passed to AppHeader.
   * Pages can override this via a layout prop or context in the future.
   */
  headerTitle?: string;
}

export function AppShell({ children, user, headerTitle }: AppShellProps) {
  // Mobile drawer state — local to shell, never lifted
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    /*
      Root viewport container.
      flex-row: sidebar | main-column
      h-screen + overflow-hidden: prevents body scroll; main-column scrolls internally.
    */
    <div className="flex h-screen overflow-hidden bg-background">

      {/*
        FUTURE INSERTION POINT — command palette overlay:
        <CommandPalette />
      */}

      {/* Sidebar — persistent on lg+, drawer on mobile */}
      <AppSidebar
        userType={user?.user_type ?? null}
        userName={user?.name}
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />

      {/*
        Main column: header stacked above scrollable content.
        flex-col + flex-1 fills remaining width after sidebar.
        min-w-0 prevents flex children from overflowing.
      */}
      <div className="flex min-w-0 flex-1 flex-col">

        <AppHeader
          onMenuOpen={() => setMobileNavOpen(true)}
          title={headerTitle}
          /*
            FUTURE INSERTION POINT — actions slot:
            actions={<NotificationBell count={3} />}
          */
        />

        {/* Scrollable content area */}
        <AppContent>
          {children}
        </AppContent>

        {/*
          FUTURE INSERTION POINT — AI copilot side panel:
          {copilotOpen && <CopilotPanel onClose={() => setCopilotOpen(false)} />}
        */}

      </div>
    </div>
  );
}