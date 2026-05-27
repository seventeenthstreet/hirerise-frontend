/**
 * components/intelligence-quality/ClusterStabilityWidget.tsx
 *
 * Displays cluster stability profiles and the latest drift event.
 *
 * States:
 *   loading       → skeleton
 *   no data       → empty state
 *   data present  → per-cluster stability cards + drift banner
 *
 * Pure display component — data provided by caller or composed from hooks.
 */

import React from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Skeleton }                      from '@/components/ui/Skeleton';
import type {
  StabilityProfileWithExplanation,
  ClusterDriftEvent,
  DriftExplanation,
  StabilityLevel,
  TrendDirection,
  DriftLevel,
} from '@/lib/api/endpoints/intelligence-quality';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface ClusterStabilityWidgetProps {
  stabilityProfiles:  StabilityProfileWithExplanation[];
  latestDrift:        ClusterDriftEvent   | null;
  driftExplanation:   DriftExplanation    | null;
  isLoading:          boolean;
  isError:            boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function stabilityBadgeClass(level: StabilityLevel): string {
  if (level === 'HIGH')     return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
  if (level === 'EMERGING') return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
  return 'bg-muted text-muted-foreground';
}

function trendIcon(direction: TrendDirection): string {
  if (direction === 'RISING')   return '↑';
  if (direction === 'DECLINING') return '↓';
  return '→';
}

function trendColour(direction: TrendDirection): string {
  if (direction === 'RISING')   return 'text-green-500';
  if (direction === 'DECLINING') return 'text-red-400';
  return 'text-muted-foreground';
}

function driftBorderClass(level: DriftLevel): string {
  if (level === 'Significant') return 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950';
  if (level === 'Moderate')    return 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950';
  return 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950';
}

function driftTextClass(level: DriftLevel): string {
  if (level === 'Significant') return 'text-red-800 dark:text-red-300';
  if (level === 'Moderate')    return 'text-amber-800 dark:text-amber-300';
  return 'text-blue-800 dark:text-blue-300';
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function StabilitySkeletonState() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-44" />
      </CardHeader>
      <CardContent className="space-y-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function StabilityEmptyState() {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <p className="text-sm text-muted-foreground">
          Complete multiple assessments to track your cluster stability over time.
        </p>
      </CardContent>
    </Card>
  );
}

interface DriftBannerProps {
  drift:       ClusterDriftEvent;
  explanation: DriftExplanation;
}

function DriftBanner({ drift, explanation }: DriftBannerProps) {
  if (drift.driftLevel === 'None') return null;

  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${driftBorderClass(drift.driftLevel)}`}
      role="status"
      aria-label={`Cluster drift detected: ${drift.driftLevel}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={`font-medium ${driftTextClass(drift.driftLevel)}`}>
            {explanation.headline}
          </p>
          {explanation.detail && (
            <p className={`mt-0.5 text-xs ${driftTextClass(drift.driftLevel)} opacity-80`}>
              {explanation.detail}
            </p>
          )}
          {explanation.possibleCauses.length > 0 && (
            <p className={`mt-1 text-xs ${driftTextClass(drift.driftLevel)} opacity-70`}>
              {explanation.possibleCauses[0]}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${driftBorderClass(drift.driftLevel)} ${driftTextClass(drift.driftLevel)}`}
        >
          {drift.driftLevel}
        </span>
      </div>
    </div>
  );
}

interface ClusterStabilityCardProps {
  profile: StabilityProfileWithExplanation;
}

function ClusterStabilityCard({ profile }: ClusterStabilityCardProps) {
  const { clusterLabel, explanation } = profile;
  const { level, trendDirection, headline, detail } = explanation;

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={`text-sm font-medium ${trendColour(trendDirection)}`}
            aria-label={`Trend: ${trendDirection}`}
          >
            {trendIcon(trendDirection)}
          </span>
          <p className="truncate text-sm font-medium text-foreground">{clusterLabel}</p>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{headline}</p>
        {detail && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{detail}</p>
        )}
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${stabilityBadgeClass(level)}`}
      >
        {level === 'HIGH' ? 'High' : level === 'EMERGING' ? 'Emerging' : 'Unstable'}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function ClusterStabilityWidget({
  stabilityProfiles,
  latestDrift,
  driftExplanation,
  isLoading,
  isError,
}: ClusterStabilityWidgetProps) {
  if (isLoading) return <StabilitySkeletonState />;

  if (isError) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <p className="text-sm text-destructive">Unable to load stability data.</p>
        </CardContent>
      </Card>
    );
  }

  if (!stabilityProfiles.length) return <StabilityEmptyState />;

  // Sort: HIGH first, then EMERGING, then UNSTABLE
  const sorted = [...stabilityProfiles].sort((a, b) => {
    const rank = { HIGH: 0, EMERGING: 1, UNSTABLE: 2 };
    return (rank[a.explanation.level] ?? 3) - (rank[b.explanation.level] ?? 3);
  });

  const hasDrift = latestDrift && latestDrift.driftLevel !== 'None' && driftExplanation;

  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-semibold text-foreground">Cluster Stability</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          How consistent is your capability identity over time?
        </p>
      </CardHeader>

      <CardContent className="space-y-3">

        {/* Drift banner — shown above clusters if relevant */}
        {hasDrift && (
          <DriftBanner
            drift={latestDrift}
            explanation={driftExplanation}
          />
        )}

        {/* Per-cluster cards */}
        <div className="space-y-2">
          {sorted.map(profile => (
            <ClusterStabilityCard key={profile.clusterId} profile={profile} />
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 pt-1">
          {[
            { label: 'High',     badge: stabilityBadgeClass('HIGH') },
            { label: 'Emerging', badge: stabilityBadgeClass('EMERGING') },
            { label: 'Unstable', badge: stabilityBadgeClass('UNSTABLE') },
          ].map(({ label, badge }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={`inline-block h-2 w-2 rounded-full ${badge.replace(/text-\S+/g, '')}`} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>

      </CardContent>
    </Card>
  );
}
