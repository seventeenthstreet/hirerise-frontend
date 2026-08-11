/**
 * src/layouts/AdminLayout.tsx
 *
 * Admin console shell for /admin/* routes.
 *
 * WP-ADMIN-01C-FIX — Admin Shell Completion:
 *   Previously a stub ("replace with a real admin shell when the admin UI
 *   is built out — sidebar, nav, etc. are out of scope here") that rendered
 *   only a floating logout button with no navigation at all. The five
 *   existing /admin/* pages (cms, graph, jobs, weights, intelligence) were
 *   only reachable by typing the URL directly.
 *
 *   This now composes a real shell: AdminSidebar (new, static console nav)
 *   + AppHeader + AppContent (reused as-is from the existing app-shell
 *   system — both are already generic/prop-driven and needed no changes).
 *   Mirrors AppShell's responsive structure (desktop rail / mobile drawer)
 *   so the admin and end-user shells share one visual language, per the
 *   "do not create a second design system" / "do not create a second Admin
 *   shell" constraints in WP-ADMIN-02.
 *
 *   The logout button is moved from a fixed-position overlay into
 *   AppHeader's `actions` slot, since AppHeader already supports it —
 *   the workaround comment in the previous version of this file no longer
 *   applies to AdminLayout (AppShell/DashboardLayout's own fixed-button
 *   workaround is unrelated and untouched).
 */

import { useState, type ReactNode } from 'react';
import { AdminSidebar } from '@/components/admin-shell';
import { AppHeader, AppContent } from '@/components/app-shell';
import { useLogout } from '@/hooks/useLogout';

export default function AdminLayout({ children }: { children?: ReactNode }) {
  const logout = useLogout();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          onMenuOpen={() => setMobileNavOpen(true)}
          title="Admin"
          actions={
            <button
              type="button"
              onClick={logout}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm hover:text-foreground hover:bg-muted transition-colors"
            >
              Log out
            </button>
          }
        />

        <AppContent>
          {children}
        </AppContent>
      </div>
    </div>
  );
}
