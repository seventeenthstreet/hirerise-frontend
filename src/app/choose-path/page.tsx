'use client';
/**
 * app/choose-path/page.tsx — REDIRECT STUB
 *
 * Deprecated. User type selection now happens in Step 1 of /onboarding.
 *
 * NOTE: This page is intentionally NOT wrapped in AuthGuard (see layout.tsx).
 * Including it in AuthGuard's ONBOARDING_PATHS caused redirect loops when
 * unauthenticated users landed here:
 *   /choose-path (treated as safe) → router.replace('/onboarding')
 *   → AuthGuard sees incomplete onboarding → /onboarding
 *   → page re-runs → loop
 *
 * The correct fix: remove from ONBOARDING_PATHS and keep this as a plain
 * redirect that does not need guard awareness.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ChoosePathRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/onboarding'); }, [router]);
  return null;
}