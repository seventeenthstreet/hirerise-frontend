

/**
 * components/app-shell/AppContent.tsx
 *
 * Scrollable main content area of the AppShell.
 *
 * RESPONSIBILITIES:
 *  - Takes remaining viewport height (flex-1 overflow-y-auto)
 *  - Constrains content width to match PageShell semantics
 *  - Provides consistent padding rhythm inside the shell
 *
 * DOES NOT OWN:
 *  - Sidebar layout
 *  - Header
 *  - Page-level spacing (pages handle their own internal spacing via PageShell)
 */

import type { ReactNode } from 'react';

interface AppContentProps {
  children: ReactNode;
  className?: string;
}

export function AppContent({ children, className = '' }: AppContentProps) {
  return (
    <main
      className={`flex-1 overflow-y-auto bg-background ${className}`}
      id="main-content"
      tabIndex={-1} // allows "skip to content" links
    >
      {children}
    </main>
  );
}