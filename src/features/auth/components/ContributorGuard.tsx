'use client';

// features/auth/components/ContributorGuard.tsx
//
// Wraps all /admin/* routes for contributor-level users.
// Allows: contributor, admin, super_admin, MASTER_ADMIN
// Blocks: regular users → /dashboard

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export function ContributorGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin, isContributor, isLoading } = useAuth();
  const router = useRouter();

  const hasAccess = isAdmin || isContributor;

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) { router.replace('/login');     return; }
    if (!hasAccess)       { router.replace('/dashboard'); return; }
  }, [isAuthenticated, hasAccess, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated || !hasAccess) return null;

  return <>{children}</>;
}