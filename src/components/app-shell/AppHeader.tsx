

/**
 * components/app-shell/AppHeader.tsx
 *
 * Top application header bar.
 *
 * RESPONSIBILITIES:
 *  - Mobile: hamburger menu button that toggles the sidebar drawer
 *  - Page title slot (driven by the active route, optional)
 *  - Right-side action slots (future: notifications, search, user menu)
 *
 * DOES NOT OWN:
 *  - Sidebar state (caller owns; passes onMenuOpen)
 *  - User data fetching
 *  - Navigation items
 *
 * FUTURE INSERTION POINTS (marked with comments):
 *  - Global search / command palette trigger
 *  - Notifications bell with badge
 *  - User avatar / account menu
 *  - AI copilot toggle button
 */

import type { ReactNode } from 'react';

interface AppHeaderProps {
  /** Called when the mobile hamburger is clicked. */
  onMenuOpen: () => void;
  /** Optional page title shown in the header. */
  title?: string;
  /** Optional right-side content (actions, user avatar, etc). */
  actions?: ReactNode;
}

export function AppHeader({ onMenuOpen, title, actions }: AppHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-background px-4 lg:px-6">

      {/* Mobile menu toggle — hidden on lg+ (sidebar is always visible) */}
      <button
        type="button"
        onClick={onMenuOpen}
        className="lg:hidden -ml-1 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label="Open navigation menu"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      {/* Page title */}
      {title && (
        <h1 className="text-sm font-semibold text-foreground truncate">
          {title}
        </h1>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/*
        FUTURE INSERTION POINT — right-side global actions:
        - Command palette trigger (⌘K)
        - Notifications bell + badge
        - AI copilot toggle
        - User avatar menu
      */}
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}

    </header>
  );
}