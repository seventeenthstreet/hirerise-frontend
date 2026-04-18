'use client';

// app/career-dashboard/layout.tsx
// Layer 2 — Professional Dashboard shell.
// Identical pattern to (dashboard)/layout.tsx — AuthGuard + DashboardLayout.
// The sidebar renders professional-specific nav items (see Sidebar.tsx update).

import { AuthGuard } from '@/features/auth/components/AuthGuard';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function CareerDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <DashboardLayout>{children}</DashboardLayout>
    </AuthGuard>
  );
}
