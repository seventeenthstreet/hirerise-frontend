/**
 * src/layouts/DashboardLayout.tsx
 *
 * Protected Application Shell Layout — Vite-native
 *
 * Applied ONLY to protected app routes:
 *   /dashboard/*
 *
 * Mounts AppShell (sidebar + header) for authenticated users.
 * Onboarding routes use OnboardingLayout instead — no AppShell there.
 *
 * Reads from AppContext (single cached /users/me source, no extra fetch).
 * user is null during hydration; AppShell renders a minimal skeleton state.
 *
 * FIX-06 (HIGH): Added a "Log out" control, wired to the centralized
 * useLogout() hook (FIX-05). Previously the only logout entry point in the
 * entire app was a button on /direction — a pre-onboarding page that
 * authenticated users with completed onboarding never visit. Users landing
 * on /dashboard had no UI path to sign out.
 *
 * PLACEMENT: AppShell does not currently accept a `headerActions` prop to
 * forward into AppHeader's `actions` slot, and changing AppShell's public
 * API is out of scope for this fix (it is shared with AdminLayout and other
 * future consumers). To avoid touching AppShell/AppHeader/AppSidebar, the
 * logout button is rendered as a small fixed-position control layered above
 * the shell — always visible, regardless of which dashboard page is active.
 *
 * Once AppShell is updated to accept a `headerActions`/`actions` prop (see
 * the commented alternative at the bottom of this file), the fixed button
 * can be replaced with a properly-integrated header action.
 */

import type { ReactNode } from 'react';
import { useAppContext } from '@/context/AppContext';
import { AppShell } from '@/components/app-shell';
import { useLogout } from '@/hooks/useLogout';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user } = useAppContext();
  const logout = useLogout();

  return (
    <AppShell
      user={user ? { name: user.name, user_type: user.user_type } : null}
    >
      {/* FIX-06: Always-visible logout control for the authenticated shell. */}
      <button
        type="button"
        onClick={logout}
        className="fixed top-3 right-4 z-40 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm hover:text-foreground hover:bg-muted transition-colors"
      >
        Log out
      </button>

      {children}
    </AppShell>
  );
}

/*
 * ALTERNATIVE (preferred once AppShell supports it):
 *
 *   <AppShell
 *     user={user ? { name: user.name, user_type: user.user_type } : null}
 *     headerActions={
 *       <button type="button" onClick={logout} className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
 *         Log out
 *       </button>
 *     }
 *   >
 *     {children}
 *   </AppShell>
 *
 * AppShell would need a small update to forward `headerActions` into:
 *   <AppHeader ... actions={headerActions} />
 * This was not done here to keep this fix scoped to logout wiring only.
 */