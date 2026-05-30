/**
 * src/layouts/DashboardLayout.tsx
 *
 * Protected Application Shell Layout — Vite-native
 *
 * Applied ONLY to protected app routes:
 *   /dashboard/*
 *   /admin/*
 *
 * Mounts AppShell (sidebar + header) for authenticated users.
 * Onboarding routes use OnboardingLayout instead — no AppShell there.
 *
 * Reads from AppContext (single cached /users/me source, no extra fetch).
 * user is null during hydration; AppShell renders a minimal skeleton state.
 */

import type { ReactNode } from 'react';
import { useAppContext } from '@/context/AppContext';
import { AppShell } from '@/components/app-shell';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user } = useAppContext();

  return (
    <AppShell
      user={user ? { name: user.name, user_type: user.user_type } : null}
    >
      {children}
    </AppShell>
  );
}
