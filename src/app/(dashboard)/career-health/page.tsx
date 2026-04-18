'use client';

/**
 * app/(dashboard)/career-health/page.tsx
 * Route: /career-health
 *
 * Career Health Index module entry point.
 * Redirects to /analytics which contains the full CHI breakdown view,
 * or prompts CV onboarding if no profile data exists yet.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/components/AuthProvider';
import { useCareerHealth } from '@/hooks/useCareerHealth';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function CareerHealthPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: chi, isLoading: chiLoading } = useCareerHealth();
  const router = useRouter();

  const isLoading = authLoading || chiLoading;

  useEffect(() => {
    if (isLoading) return;

    if (!user?.onboardingCompleted && !chi?.isReady) {
      // No profile yet — send to CV onboarding which feeds CHI
      router.replace('/cv/onboarding');
    } else {
      // Has data — send to the analytics page which shows full CHI breakdown
      router.replace('/analytics');
    }
  }, [isLoading, user?.onboardingCompleted, chi?.isReady, router]);

  return (
    <div className="flex h-64 items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}