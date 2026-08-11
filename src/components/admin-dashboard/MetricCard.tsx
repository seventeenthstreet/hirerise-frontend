/**
 * components/admin-dashboard/MetricCard.tsx
 *
 * Single Executive Overview metric tile.
 *
 * WP-ADMIN-03 Phase 2 — Enterprise Dashboard.
 *
 * HARD RULE (per WP-ADMIN-03 spec): never fabricate a value. A metric is
 * rendered only when the caller has real, API-backed data for it. Callers
 * express this with three mutually exclusive states:
 *  - isLoading    → skeleton
 *  - isUnavailable → "Unavailable" (no backing API/data exists yet)
 *  - otherwise    → the real `value`
 *
 * There is no "default to 0" fallback anywhere in this component.
 */

import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui';
import { DashboardCard } from './DashboardCard';
import { StatusBadge } from './StatusBadge';

interface MetricCardProps {
  label: string;
  /** Real value from an existing API. Omit / ignore when isUnavailable is true. */
  value?: string | number | null;
  icon?: ReactNode;
  isLoading?: boolean;
  /** True when no backend API/data exists for this metric yet. */
  isUnavailable?: boolean;
  /** Optional small caption under the value (e.g. "as of 2m ago"). */
  caption?: string;
}

export function MetricCard({
  label,
  value,
  icon,
  isLoading = false,
  isUnavailable = false,
  caption,
}: MetricCardProps) {
  return (
    <DashboardCard>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {icon && (
          <span className="text-muted-foreground/60" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>

      <div className="mt-2">
        {isLoading ? (
          <Skeleton className="h-7 w-20" />
        ) : isUnavailable || value === null || value === undefined ? (
          <StatusBadge variant="unavailable" />
        ) : (
          <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
        )}
      </div>

      {caption && !isUnavailable && !isLoading && (
        <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
      )}
    </DashboardCard>
  );
}
