/**
 * @file src/pages/admin/XaiOperationsDashboardPage.tsx
 * @description WP-7 XAI Operations Dashboard page.
 *
 * Route: /admin/xai-operations (admin-gated via AdminGuard + AdminLayout)
 *
 * RESPONSIBILITIES (pages layer only):
 *  - Call useXaiDashboard() once — single data source
 *  - Compose section components from components/analytics
 *  - Handle page-level full-failure state
 *  - Pass onRetry callbacks to sections
 *
 * HARD RULES:
 *  - NO API calls — ALL data comes through useXaiDashboard()
 *  - NO business logic — orchestration and prop-passing only
 *  - NO mock data, no hardcoded metric values
 *
 * Architecture position: Pages layer (fourth tier)
 *   API → Hooks → UI → Pages → Guards → Context
 */

import { Suspense }                from 'react';
import { useXaiDashboard }         from '@/hooks/useXaiDashboard';
import { ErrorBoundary }           from '@/components/system';
import { SectionErrorFallback }    from '@/components/system';
import { PageShell }               from '@/components/ui';
import { ErrorState }              from '@/components/analytics';
import {
  SystemHealthSection,
  XaiUsageSection,
  XaiTierSection,
} from '@/components/analytics/XaiSections';

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function XaiOperationsDashboardPage() {
  const dashboard = useXaiDashboard();
  const { health, xaiMetrics, phase1Empty, refetchAll, isAllError, firstError } = dashboard;

  return (
    <PageShell>
      {/* Page-level error state — only when ALL sections have failed simultaneously */}
      {isAllError && firstError && (
        <ErrorState
          message={`Dashboard failed to load: ${firstError.message}`}
          onRetry={refetchAll}
        />
      )}

      {/* Section 1 — System Health */}
      <ErrorBoundary fallback={<SectionErrorFallback />}>
        <SystemHealthSection
          state={health}
          onRetry={health.refetch}
        />
      </ErrorBoundary>

      {/* Section 2 — AI Operations (XAI usage) */}
      <ErrorBoundary fallback={<SectionErrorFallback />}>
        <XaiUsageSection
          state={xaiMetrics.usage}
          phase1Empty={phase1Empty}
          onRetry={xaiMetrics.refetchAll}
        />
      </ErrorBoundary>

      {/* Section 3 — XAI Tier Distribution */}
      <ErrorBoundary fallback={<SectionErrorFallback />}>
        <XaiTierSection
          state={xaiMetrics.tier}
          phase1Empty={phase1Empty}
          onRetry={xaiMetrics.refetchAll}
        />
      </ErrorBoundary>
    </PageShell>
  );
}