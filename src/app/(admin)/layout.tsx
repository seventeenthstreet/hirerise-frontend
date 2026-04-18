'use client';

// app/(admin)/layout.tsx
// Wraps ALL /admin/* routes.
// AdminGuard enforces: authenticated + isAdmin. See features/auth/components/AdminGuard.tsx.

import { AdminGuard } from '@/features/auth/components/AdminGuard';
import { AdminSidebar } from '@/components/layout/AdminSidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <div className="flex h-screen overflow-hidden bg-surface-50">
        <AdminSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto scrollbar-thin">
            {children}
          </main>
        </div>
      </div>
    </AdminGuard>
  );
}
