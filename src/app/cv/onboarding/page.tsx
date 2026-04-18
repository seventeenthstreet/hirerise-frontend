'use client';

/**
 * src/app/cv/onboarding/page.tsx
 * Route: /cv/onboarding
 *
 * CV Optimizer module onboarding entry point.
 * Users arrive here from the Module Dashboard when they select "CV Optimizer".
 *
 * Guard logic:
 *   - Not authenticated           → AuthGuard on the wrapper handles /login redirect
 *   - Already has profile data    → redirect to /cv/builder (skip onboarding)
 *   - No profile yet              → render the full onboarding flow
 *
 * This is a thin shell. All onboarding UI lives in OnboardingPage (shared).
 * We import it directly so the /cv/onboarding URL is canonical for this module.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/components/AuthProvider';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

// Lazy import the full onboarding page component
import dynamic from 'next/dynamic';

const OnboardingPage = dynamic(() => import('@/app/onboarding/page'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-surface-50">
      <LoadingSpinner size="lg" />
    </div>
  ),
});

export default function CvOnboardingPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    // If user has already completed onboarding, skip directly into the CV Builder
    if (user?.onboardingCompleted) {
      router.replace('/cv/builder');
    }
  }, [user?.onboardingCompleted, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // If onboarding is already done, don't flash the form while redirect fires
  if (user?.onboardingCompleted) return null;

  return <OnboardingPage />;
}