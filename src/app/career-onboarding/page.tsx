'use client';
/**
 * app/career-onboarding/page.tsx — REDIRECT STUB
 *
 * Deprecated. All onboarding now goes through /onboarding.
 * Keep this file to avoid 404s for any existing bookmarks or links.
 *
 * NOTE: This stub is NOT listed in AuthGuard's ONBOARDING_PATHS.
 * It is a plain redirect — it does not need guard awareness, and
 * including it there caused redirect loops with /onboarding.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CareerOnboardingRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/onboarding'); }, [router]);
  return null;
}