'use client';

/**
 * components/onboarding/shell/OnboardingFooter.tsx
 *
 * Onboarding shell footer.
 *
 * Currently a passthrough — exists as an architectural slot for:
 *   - Legal/privacy links
 *   - Help / support links
 *   - Step navigation summary
 *
 * Preserved as a composition boundary so pages don't need to
 * be touched when footer content is added.
 */

import type { ReactNode } from 'react';

interface OnboardingFooterProps {
  children?: ReactNode;
  className?: string;
}

export function OnboardingFooter({ children, className = '' }: OnboardingFooterProps) {
  if (!children) return null;

  return (
    <footer className={`mt-8 ${className}`}>
      {children}
    </footer>
  );
}