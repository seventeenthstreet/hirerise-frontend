'use client';

// app/student-dashboard/layout.tsx
// Layer 2 — Student Dashboard shell.
// Uses the same AuthGuard + DashboardLayout pattern as (dashboard)/layout.tsx.
// The sidebar will render student-specific nav items (see Sidebar.tsx update).

import { AuthGuard } from '@/features/auth/components/AuthGuard';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function StudentDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <DashboardLayout>{children}</DashboardLayout>
    </AuthGuard>
  );
}
