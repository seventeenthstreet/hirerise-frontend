

/**
 * components/dashboard/layout/DashboardAsync.tsx
 *
 * Shared async UX primitives for dashboard widgets and sections.
 *
 * NORMALIZES (Phase C Task 6):
 *  - Widget loading states (currently each widget has inline patterns)
 *  - Empty state displays
 *  - Info/processing banners (e.g. "resume is being processed")
 *
 * DOES NOT OWN:
 *  - Data fetching
 *  - Error boundaries (system/ErrorBoundary owns those)
 *  - Business logic about when a state applies
 */

import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner }  from '@/components/ui/Spinner';

// ─────────────────────────────────────────────────────────────────────────────
// WIDGET SKELETON
// Normalized card-level skeleton loader.
// ─────────────────────────────────────────────────────────────────────────────

interface DashboardWidgetSkeletonProps {
  /** Number of content rows to show. Default: 3 */
  rows?: number;
  /** Show a header/title skeleton. Default: true */
  showHeader?: boolean;
  className?: string;
}

export function DashboardWidgetSkeleton({
  rows = 3,
  showHeader = true,
  className = '',
}: DashboardWidgetSkeletonProps) {
  return (
    <div className={`rounded-xl border border-border bg-card p-5 shadow-sm ${className}`} aria-busy="true" aria-label="Loading widget">
      {showHeader && (
        <Skeleton className="mb-4 h-4 w-32" />
      )}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton
            key={i}
            className={`h-3 ${i % 2 === 0 ? 'w-full' : 'w-3/4'}`}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// Normalized empty-state display for widgets and sections.
// ─────────────────────────────────────────────────────────────────────────────

interface DashboardEmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Optional icon node. */
  icon?: ReactNode;
  className?: string;
}

export function DashboardEmptyState({
  title,
  description,
  action,
  icon,
  className = '',
}: DashboardEmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-10 text-center ${className}`}>
      {icon && (
        <div className="mb-3 text-muted-foreground/50" aria-hidden="true">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCESSING BANNER
// Normalized processing/info banner (e.g. resume analysis in progress).
// Replaces the inline resumeIsProcessing banner in dashboard/page.tsx.
// ─────────────────────────────────────────────────────────────────────────────

interface DashboardProcessingBannerProps {
  message: string;
  /** 'info' | 'warning' | 'success'. Default: 'info' */
  variant?: 'info' | 'warning' | 'success';
  className?: string;
}

const bannerVariants = {
  info:    'border-blue-200 bg-blue-50 text-blue-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  success: 'border-green-200 bg-green-50 text-green-700',
};

export function DashboardProcessingBanner({
  message,
  variant = 'info',
  className = '',
}: DashboardProcessingBannerProps) {
  return (
    <div
      role="status"
      className={`mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 ${bannerVariants[variant]} ${className}`}
    >
      <Spinner size="sm" label="Processing" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}