import type { ReactNode } from 'react';

/**
 * (auth)/dashboard/layout.tsx — Dashboard-scoped nested layout.
 *
 * PHASE C: Promoted from a passthrough to a proper layout boundary.
 *
 * Responsibilities:
 *  - Shared layout boundary for /dashboard and /dashboard/analytics
 *  - Future home for dashboard-specific nav tabs / date range picker
 *  - Dashboard-scoped error boundaries (future)
 *
 * Does NOT gate auth — page-level guards own that.
 * Does NOT add visual chrome yet beyond the structural boundary.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}