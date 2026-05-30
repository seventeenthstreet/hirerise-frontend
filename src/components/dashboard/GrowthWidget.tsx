/**
 * components/dashboard/GrowthWidget.tsx
 *
 * Displays multi-year career growth projection toward the user's target role.
 * Backed by GET /api/v1/growth/projection (fetched via useDashboard).
 */

import React from 'react';
import type { GrowthDataPoint } from '@/hooks/useDashboard';

interface TargetRole {
  id: string;
  title: string;
}

interface GrowthWidgetProps {
  growthData?: GrowthDataPoint[];
  targetRole?: TargetRole;
  isLoading: boolean;
  /**
   * Phase 3A Step 5 — Empty-state determinism:
   * When the parent dashboard fetch failed, dashboardData is null so targetRole
   * is undefined. Without this flag, GrowthWidget renders the "Set a target role"
   * empty state — which misleads the user into thinking they haven't set a role,
   * when the real issue is a fetch failure. hasError=true shows a neutral "data
   * unavailable" message instead, preventing an ambiguous blank state.
   */
  hasError?: boolean;
}

export const GrowthWidget = React.memo(function GrowthWidget({ growthData, targetRole, isLoading, hasError = false }: GrowthWidgetProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm animate-pulse">
        <div className="h-4 w-48 rounded bg-muted mb-4" />
        <div className="h-32 rounded bg-muted" />
      </div>
    );
  }

  // Phase 3A Step 5: Distinguish fetch failure from genuine "no target role" state.
  // When the dashboard query errored, show a neutral unavailable message — not
  // the "Set a target role" CTA which would be incorrect and confusing.
  if (hasError && !targetRole) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-2 text-base font-semibold text-foreground">Growth Projection</h2>
        <p className="text-sm text-muted-foreground">
          Growth data is currently unavailable. Please refresh the page.
        </p>
      </div>
    );
  }

  if (!targetRole) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-2 text-base font-semibold text-foreground">Growth Projection</h2>
        <p className="text-sm text-muted-foreground">
          <a href="/settings" className="underline hover:text-foreground">
            Set a target role
          </a>{' '}
          to see your multi-year growth projection.
        </p>
      </div>
    );
  }

  const points = growthData ?? [];

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-1 text-base font-semibold text-foreground">Growth Projection</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Toward <strong>{targetRole.title}</strong>
      </p>

      {points.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Growth data is being calculated. Check back shortly.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Year</th>
                <th className="pb-2 pr-4 font-medium">Level</th>
                <th className="pb-2 pr-4 font-medium">Est. Salary</th>
                <th className="pb-2 font-medium">Probability</th>
              </tr>
            </thead>
            <tbody>
              {points.map((pt) => (
                <tr key={pt.year} className="border-t border-border">
                  <td className="py-2 pr-4 text-foreground">{pt.year}</td>
                  <td className="py-2 pr-4 text-foreground">{pt.level ?? '—'}</td>
                  <td className="py-2 pr-4 text-foreground">
                    {pt.salary != null
                      ? new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          maximumFractionDigits: 0,
                        }).format(pt.salary)
                      : '—'}
                  </td>
                  <td className="py-2 text-foreground">
                    {pt.probability != null ? `${Math.round(pt.probability * 100)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});

GrowthWidget.displayName = 'GrowthWidget';