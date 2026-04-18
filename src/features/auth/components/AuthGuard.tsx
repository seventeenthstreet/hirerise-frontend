'use client';

// features/auth/components/AuthGuard.tsx
//
// Guard chain (evaluated in order — first match wins):
//
//   Rule 1: Session not yet resolved (isLoading)           → show spinner
//   Rule 2: Not authenticated                              → /login
//   Rule 3: Admin                                          → render (admin bypass)
//   Rule 4: onboarding_completed = true + on /onboarding   → dashboard (prevent re-entry)
//   Rule 5: onboarding_completed = true                    → render children ✅
//   Rule 6: On /onboarding                                 → render (let page manage itself)
//   Rule 7: Onboarding incomplete                          → /onboarding
//
// Bypass paths:
//   Only /onboarding is a real onboarding path.
//   /choose-path, /student-onboarding, /career-onboarding are deprecated redirect
//   stubs — they are NOT listed here. They redirect to /onboarding themselves,
//   so they must pass through the guard normally (no infinite loop risk since they
//   are wrapped in their own minimal layouts, not AuthGuard).
//
// Admin bypass:
//   Admin users skip all onboarding guards entirely.

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

// The only real onboarding path — deprecated stubs are excluded intentionally.
// Including /choose-path here caused redirect loops:
//   AuthGuard redirected unauthenticated users to /login, but /choose-path
//   was treated as "safe" even though it just calls router.replace('/onboarding'),
//   creating a /choose-path → /onboarding → /choose-path chain when both were
//   listed together.
const ONBOARDING_PATHS = new Set(['/onboarding']);

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin, isLoading, user } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();

  const isOnboardingPath = ONBOARDING_PATHS.has(pathname ?? '');

  // ⚠️  MUST match hydrateFromProfile's onboardingComplete logic exactly.
  // See: src/lib/store/userStore.ts → hydrateFromProfile()
  // A divergence between these two causes redirect loops or stale UI banners.
  // Support both camelCase and snake_case aliases that normalizeUser() may return.
  // Also support the legacy dual-flag system.
  // ⚠️  MUST match hydrateFromProfile's onboardingComplete logic exactly.
  // See: src/lib/store/userStore.ts → hydrateFromProfile()
  //
  // SINGLE SOURCE OF TRUTH: Only trust explicit server-side completion flags.
  // Do NOT infer from resumeUploaded or user_type — see userStore comment.
  const isOnboardingComplete =
    user?.onboardingCompleted           === true ||
    (user as any)?.onboarding_completed === true;

  useEffect(() => {
    // Rule 1: Wait until session is resolved — never redirect on stale state
    if (isLoading) return;

    // Rule 2: Not authenticated → /login
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    // Rule 3: Admin bypass — skip all onboarding guards
    if (isAdmin) return;

    // Rule 4 + 5: Onboarding complete
    if (isOnboardingComplete) {
      // Prevent re-entry: redirect away from /onboarding if already done
      if (isOnboardingPath) {
        const dest = user?.user_type === 'student' ? '/student-dashboard' : '/career-dashboard';
        router.replace(dest);
      }
      return;
    }

    // Rule 6: On /onboarding — let the page handle itself, no redirect
    if (isOnboardingPath) return;

    // Rule 7: Incomplete and not on /onboarding → send there
    router.replace('/onboarding');

  }, [isAuthenticated, isAdmin, isLoading, isOnboardingComplete, isOnboardingPath, user, router]);

  // ── Render decisions ────────────────────────────────────────────────────────

  // Rule 1: Block render until session is ready — prevents routing flicker
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Rule 2: Not authenticated — render nothing while redirect fires
  if (!isAuthenticated) return null;

  // Rule 3: Admin — always render
  if (isAdmin) return <>{children}</>;

  // Rule 4/5: Onboarding complete — render if not on an onboarding path
  if (isOnboardingComplete && !isOnboardingPath) return <>{children}</>;

  // Rule 6: On /onboarding — render the onboarding page
  if (isOnboardingPath) return <>{children}</>;

  // Rule 7: Incomplete + not on /onboarding — render nothing while redirect fires
  return null;
}