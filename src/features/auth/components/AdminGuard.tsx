'use client';

// features/auth/components/AdminGuard.tsx
//
// Wraps all /admin/* routes via app/(admin)/layout.tsx.
// Three-state check: loading → unauthenticated → not-admin → render.
//
// AdminGuard enforcement chain:
//   Browser request to /admin/*
//   └── app/(admin)/layout.tsx → <AdminGuard>
//       ├── isLoading         → render spinner
//       ├── !isAuthenticated  → redirect /login
//       └── !isAdmin          → redirect /dashboard
//       └── confirmed admin   → render children

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) { router.replace('/login');     return; }
    if (!isAdmin)         { router.replace('/dashboard'); return; }
  }, [isAuthenticated, isAdmin, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) return null;

  return <>{children}</>;
}
