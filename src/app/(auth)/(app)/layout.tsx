'use client';

/**
 * (auth)/(app)/layout.tsx — Protected Application Shell
 *
 * PHASE 1 ROUTE RESTRUCTURING:
 *  Previously, AppShell was mounted in (auth)/layout.tsx, which applied it to
 *  ALL (auth)/* routes — including /direction, /onboarding, and all onboarding
 *  variants. This caused the full sidebar + header chrome to render during
 *  pre-app-entry flows where the user has no user_type yet.
 *
 *  This layout now ONLY applies to protected app routes:
 *    /dashboard, /dashboard/analytics, /resume
 *    (/market-insights redirects to /dashboard — MVP scope reduction)
 *
 *  Onboarding routes (/direction, /onboarding, /career/onboarding,
 *  /education/onboarding) are in the sibling (auth)/(onboarding)/ group
 *  and receive their own minimal layout with no AppShell.
 *
 * WHY AppShell belongs here and not at (auth)/layout.tsx:
 *  - Onboarding users are pre-app-entry: no user_type, no profile complete.
 *    Showing sidebar nav during onboarding is incorrect product framing.
 *  - AppShell has internal useState (mobileNavOpen) — isolating it to the
 *    protected app routes prevents unnecessary state creation during onboarding.
 *  - Narrower scope makes StrictMode double-invoke side-effects easier to reason
 *    about: the mobile nav useState only affects routes where it is relevant.
 *
 * PRESERVED:
 *  ✅ Auth gating (per-page guards unchanged)
 *  ✅ Hydration lifecycle (AppContext unchanged)
 *  ✅ React Query semantics (no new queries)
 *  ✅ StrictMode compatibility
 *  ✅ AppShell behavior (identical to previous (auth)/layout.tsx)
 */

import type { ReactNode } from 'react';
import { useAppContext } from '@/context/AppContext';
import { AppShell } from '@/components/app-shell';

export default function ProtectedAppLayout({ children }: { children: ReactNode }) {
  // Read from AppContext — single cached source, no extra fetch.
  // user is null during hydration; AppShell renders a minimal shell state.
  const { user } = useAppContext();

  return (
    <AppShell
      user={user ? { name: user.name, user_type: user.user_type } : null}
    >
      {children}
    </AppShell>
  );
}