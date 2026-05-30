

/**
 * components/onboarding/shell/OnboardingShell.tsx
 *
 * The onboarding layout shell.
 *
 * RESPONSIBILITIES (owns):
 *   - Page-level spacing (padding, centering)
 *   - Max-width container
 *   - Responsive layout (single-col mobile, constrained desktop)
 *   - Slot-based composition: header, progress, content, footer
 *   - Step transition container (key-driven animation wrapper)
 *   - Loading / error placement boundary
 *
 * Does NOT own:
 *   - Step rendering or orchestration
 *   - Navigation or redirect logic
 *   - Backend API calls
 *   - Auth gating
 *   - Quota logic
 *   - Analytics
 *
 * USAGE:
 *   <OnboardingShell>
 *     <OnboardingHeader title="Set up your profile" />
 *     <OnboardingProgress completedCount={2} totalCount={5} />
 *     <OnboardingContent>
 *       <ActiveStepComponent />
 *     </OnboardingContent>
 *   </OnboardingShell>
 *
 * Visual hierarchy is preserved from the existing onboarding pages.
 * This is an architectural extraction — NOT a visual redesign.
 */

import type { ReactNode } from 'react';

interface OnboardingShellProps {
  children: ReactNode;
  /** Override max-width. Default: 'max-w-2xl' (matches current onboarding layout). */
  maxWidth?: string;
  /** Override padding. Default: 'px-4 py-12'. */
  padding?: string;
  className?: string;
}

export function OnboardingShell({
  children,
  maxWidth = 'max-w-2xl',
  padding = 'px-4 py-12',
  className = '',
}: OnboardingShellProps) {
  return (
    <div className={className}>
      <div className={`mx-auto ${maxWidth} ${padding}`}>
        {children}
      </div>
    </div>
  );
}