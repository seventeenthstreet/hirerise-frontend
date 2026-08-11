/**
 * components/admin-dashboard/DashboardCard.tsx
 *
 * Generic card wrapper for Enterprise Dashboard content.
 *
 * WP-ADMIN-03 Phase 2 — Enterprise Dashboard.
 *
 * Thin wrapper around the existing `Card` primitive (components/ui/Card) —
 * no new visual language, no duplicate CSS. Adds an optional header row
 * (title + icon + trailing slot) that every dashboard surface needs, so
 * MetricCard / QuickActionCard / HealthWidget can share one shape instead
 * of each re-implementing the header markup.
 */

import type { ReactNode } from 'react';
import { Card } from '@/components/ui';

interface DashboardCardProps {
  title?: string;
  icon?: ReactNode;
  /** Right-aligned slot next to the title — typically a StatusBadge. */
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function DashboardCard({ title, icon, trailing, children, className = '' }: DashboardCardProps) {
  return (
    <Card className={`p-5 ${className}`}>
      {(title || icon || trailing) && (
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {icon && (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
                {icon}
              </span>
            )}
            {title && (
              <h3 className="truncate text-sm font-semibold text-foreground">{title}</h3>
            )}
          </div>
          {trailing && <div className="shrink-0">{trailing}</div>}
        </div>
      )}
      {children}
    </Card>
  );
}
