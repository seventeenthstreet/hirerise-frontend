/**
 * components/intelligence-quality/IntelligenceQualityPanel.tsx
 *
 * Phase 4A — composed dashboard panel.
 *
 * Combines:
 *   - SignalCoverageWidget
 *   - ClusterStabilityWidget
 *
 * Fetches all data via the useIntelligenceQualityReport hook.
 * This is the single import needed for a page to render the full quality panel.
 *
 * Usage:
 *   import { IntelligenceQualityPanel } from '@/components/intelligence-quality';
 *   <IntelligenceQualityPanel />
 *
 * Feature flag:
 *   Wrap in a feature flag check at the page level if needed:
 *   if (!featureFlag('intelligence_quality_panel')) return null;
 */

import React from 'react';
import { SignalCoverageWidget }   from './SignalCoverageWidget';
import { ClusterStabilityWidget } from './ClusterStabilityWidget';
import {
  useClusterStability,
  useClusterDrift,
  useSignalCoverage,
} from '@/hooks/useIntelligenceQuality';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface IntelligenceQualityPanelProps {
  /** If false, the panel renders nothing (feature-flag gate). */
  enabled?: boolean;
  /** Override panel heading. */
  heading?: string;
  /** Show only the coverage widget (e.g. for onboarding progress). */
  coverageOnly?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function IntelligenceQualityPanel({
  enabled     = true,
  heading     = 'Intelligence Quality',
  coverageOnly = false,
}: IntelligenceQualityPanelProps) {

  // ── Data hooks ─────────────────────────────────────────────────────────────
  const coverage  = useSignalCoverage({ enabled });
  const stability = useClusterStability({ enabled: enabled && !coverageOnly });
  const drift     = useClusterDrift({ enabled: enabled && !coverageOnly });

  if (!enabled) return null;

  // ── Derived sparsity/suppression state ────────────────────────────────────
  // We infer suppression from LOW coverage level — the backend persists this
  // but the frontend derives it from the score for fast rendering.
  const suppressRecommendations =
    coverage.coverageLevel === 'LOW' &&
    (coverage.coverageScore ?? 100) < 40;

  // ── Build stability profiles with explanations ────────────────────────────
  // The stability hook already has explanations attached from the API.
  const stabilityProfiles = stability.stabilityProfiles ?? [];

  return (
    <section aria-label={heading} className="space-y-4">

      {/* Section heading — only shown when both widgets are present */}
      {!coverageOnly && (
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{heading}</h2>
          {coverage.coverageLevel && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                coverage.coverageLevel === 'HIGH'   ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                coverage.coverageLevel === 'MEDIUM' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300' :
                'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
              }`}
            >
              {coverage.coverageLevel === 'HIGH'   ? 'Strong profile' :
               coverage.coverageLevel === 'MEDIUM' ? 'Building profile' :
               'Needs more data'}
            </span>
          )}
        </div>
      )}

      {/* Signal Coverage Widget */}
      <SignalCoverageWidget
        coverage={coverage.coverage}
        explanation={coverage.explanation}
        suppressRecommendations={suppressRecommendations}
        isLoading={coverage.isLoading}
        isError={coverage.isError}
      />

      {/* Cluster Stability Widget — only when not in coverage-only mode */}
      {!coverageOnly && (
        <ClusterStabilityWidget
          stabilityProfiles={stabilityProfiles}
          latestDrift={drift.latestDrift}
          driftExplanation={drift.driftExplanation}
          isLoading={stability.isLoading || drift.isLoading}
          isError={stability.isError || drift.isError}
        />
      )}

    </section>
  );
}
