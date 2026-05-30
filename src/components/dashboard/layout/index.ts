

/**
 * components/dashboard/layout/index.ts
 *
 * Barrel export for the dashboard layout system.
 * Import from '@/components/dashboard/layout' for all layout primitives.
 */

export {
  DashboardShell,
  DashboardHeader,
  DashboardSection,
  DashboardGrid,
  DashboardCard,
} from './DashboardLayout';

export {
  DashboardWidgetSkeleton,
  DashboardEmptyState,
  DashboardProcessingBanner,
} from './DashboardAsync';