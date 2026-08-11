/**
 * components/admin-dashboard/HealthWidget.tsx
 *
 * System Health widget for the Enterprise Dashboard.
 *
 * WP-ADMIN-03 Phase 2 — Enterprise Dashboard.
 *
 * HARD RULE: only renders fields already exposed by GET /api/v1/system/health
 * (status, environment, build_version — see SystemHealthResponse in
 * lib/api/metrics-types.ts). Redis / Queue / Workers / Database are
 * deliberately NOT rendered anywhere in this widget — the backend does not
 * expose them, and the spec explicitly forbids fabricating them.
 */

import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui';
import type { UseSystemHealthReturn } from '@/hooks/useSystemHealth';
import { DashboardCard } from './DashboardCard';
import { StatusBadge, type StatusBadgeVariant } from './StatusBadge';

interface HealthWidgetProps {
  health: UseSystemHealthReturn;
}

function statusVariant(health: UseSystemHealthReturn): StatusBadgeVariant {
  if (health.isHealthy) return 'healthy';
  if (health.isDegraded) return 'degraded';
  if (health.isDown) return 'down';
  return 'unavailable';
}

export function HealthWidget({ health }: HealthWidgetProps) {
  const { data, isLoading, error } = health;
  const hasData = data !== null;

  return (
    <DashboardCard
      title="System Health"
      trailing={
        !isLoading && hasData ? (
          <StatusBadge variant={statusVariant(health)} />
        ) : !isLoading && error ? (
          <StatusBadge variant="unavailable" />
        ) : undefined
      }
    >
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <HealthField label="API Health" isLoading={isLoading}>
          {hasData ? (
            <StatusBadge variant={statusVariant(health)} />
          ) : (
            <StatusBadge variant="unavailable" />
          )}
        </HealthField>

        <HealthField label="Environment" isLoading={isLoading}>
          {hasData ? (
            <span className="text-sm font-medium text-foreground">{data.environment}</span>
          ) : (
            <StatusBadge variant="unavailable" />
          )}
        </HealthField>

        <HealthField label="Version" isLoading={isLoading}>
          {hasData ? (
            <span className="text-sm font-medium text-foreground">{data.build_version}</span>
          ) : (
            <StatusBadge variant="unavailable" />
          )}
        </HealthField>
      </dl>
    </DashboardCard>
  );
}

function HealthField({
  label,
  isLoading,
  children,
}: {
  label: string;
  isLoading: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1">{isLoading ? <Skeleton className="h-5 w-16" /> : children}</dd>
    </div>
  );
}
