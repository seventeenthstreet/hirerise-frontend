/**
 * components/admin-dashboard/DashboardGrid.tsx
 *
 * Responsive grid primitive shared by every Enterprise Dashboard section.
 *
 * WP-ADMIN-03 Phase 2 — Enterprise Dashboard.
 *
 * Avoids each section hand-rolling its own grid-cols-* breakpoints —
 * one shared primitive, tuned per max-columns at the lg breakpoint.
 */

import type { ReactNode } from 'react';

interface DashboardGridProps {
  children: ReactNode;
  /** Max columns at the lg breakpoint. 1–2 columns stack sooner on md. */
  columns?: 2 | 3 | 4;
  className?: string;
}

const COLUMN_CLASSES: Record<2 | 3 | 4, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
};

export function DashboardGrid({ children, columns = 4, className = '' }: DashboardGridProps) {
  return (
    <div className={`grid grid-cols-1 gap-4 ${COLUMN_CLASSES[columns]} ${className}`}>
      {children}
    </div>
  );
}
