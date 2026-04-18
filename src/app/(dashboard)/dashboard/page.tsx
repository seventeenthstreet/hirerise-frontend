'use client';

/**
 * app/(dashboard)/dashboard/page.tsx — Backward-compatibility redirect
 *
 * The old /dashboard route now redirects to the correct dashboard based
 * on the user's user_type. This ensures any bookmarks or old links
 * continue to work without a 404.
 *
 * Redirect logic:
 *   student      → /student-dashboard
 *   professional → /career-dashboard
 *   null         → /choose-path
 *   admin        → /admin/dashboard  (handled by AuthGuard + dashboard admin check)
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/components/AuthProvider';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function DashboardRedirectPage() {
  const { user, isAdmin, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (isAdmin) {
      router.replace('/admin/dashboard');
      return;
    }

    switch (user?.user_type) {
      case 'student':
        router.replace('/student-dashboard');
        break;
      case 'professional':
        router.replace('/career-dashboard');
        break;
      default:
        // No user_type set yet — send to gateway
        router.replace('/choose-path');
    }
  }, [user, isAdmin, isLoading, router]);

  return (
    <div className="flex h-64 items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}
