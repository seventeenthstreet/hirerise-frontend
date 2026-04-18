'use client';

// app/(dashboard)/layout.tsx
// Wraps all user-facing dashboard routes.
// AuthGuard redirects unauthenticated users to /login.
// DashboardLayout renders Sidebar + Topbar + content area.

import { AuthGuard } from '@/features/auth/components/AuthGuard';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <DashboardLayout>{children}</DashboardLayout>
    </AuthGuard>
  );
}