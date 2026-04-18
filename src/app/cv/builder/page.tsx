'use client';

/**
 * src/app/cv/builder/page.tsx
 * Route: /cv/builder
 *
 * CV Optimizer module — builder entry point.
 * Redirects to the existing /cv-builder dashboard page which contains
 * the full AI CV generation UI.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CvBuilderRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/cv-builder');
  }, [router]);

  return null;
}