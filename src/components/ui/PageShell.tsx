import type { ReactNode } from 'react';

/**
 * components/ui/PageShell.tsx — Standard page spacing + width primitive.
 *
 * PURPOSE:
 *  Provides consistent page-level layout:
 *   - Standard max-width (max-w-7xl)
 *   - Standard horizontal padding (responsive: px-4 sm:px-6 lg:px-8)
 *   - Standard vertical padding (py-8)
 *
 * USAGE:
 *  Wrap page content with <PageShell> for consistent spacing.
 *  This becomes the future layout primitive as pages are standardized.
 *
 *  <PageShell>
 *    <DashboardContent />
 *  </PageShell>
 *
 * Props:
 *  - children: page content
 *  - className: additional classes for special cases
 *  - fullWidth: bypass max-width constraint (for edge-to-edge layouts)
 *  - noPadding: bypass vertical padding (when page manages its own)
 */

interface PageShellProps {
  children: ReactNode;
  className?: string;
  fullWidth?: boolean;
  noPadding?: boolean;
}

export function PageShell({
  children,
  className = '',
  fullWidth = false,
  noPadding = false,
}: PageShellProps) {
  return (
    <div className={`min-h-screen bg-background ${noPadding ? '' : 'py-8'}`}>
      <div
        className={[
          fullWidth ? 'w-full' : 'mx-auto max-w-7xl',
          'px-4 sm:px-6 lg:px-8',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {children}
      </div>
    </div>
  );
}
