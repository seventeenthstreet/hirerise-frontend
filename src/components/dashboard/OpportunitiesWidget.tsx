/**
 * components/dashboard/OpportunitiesWidget.tsx
 *
 * Displays the Opportunity Radar — top career opportunities and an
 * aggregate opportunity score.
 */

import React from 'react';
import type { Opportunity } from '@/hooks/useOpportunities';

interface OpportunitiesWidgetProps {
  opportunities: Opportunity[];
  opportunityScore: number | null;
  isLoading: boolean;
  error: Error | null;
}

export const OpportunitiesWidget = React.memo(function OpportunitiesWidget({
  opportunities,
  opportunityScore,
  isLoading,
  error,
}: OpportunitiesWidgetProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm animate-pulse">
        <div className="h-4 w-36 rounded bg-muted mb-4" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 rounded bg-muted mb-2" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 shadow-sm">
        <p className="text-sm text-destructive">Could not load opportunities.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Opportunities</h2>
        {opportunityScore !== null && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            Score {opportunityScore}
          </span>
        )}
      </div>

      {opportunities.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No opportunities available yet. Complete your profile to see matches.
        </p>
      ) : (
        <ul className="space-y-2">
          {opportunities.slice(0, 5).map((opp) => (
            <li
              key={opp.id}
              className="rounded-lg border border-border p-3 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{opp.title}</p>
                  {opp.company && (
                    <p className="text-xs text-muted-foreground">{opp.company}</p>
                  )}
                </div>
                {opp.matchScore !== undefined && (
                  <span className="flex-shrink-0 text-xs text-muted-foreground">
                    {opp.matchScore}% match
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

OpportunitiesWidget.displayName = 'OpportunitiesWidget';