

/**
 * @file app/dashboard/page.tsx — Main Dashboard Orchestrator
 *
 * HARDENING CHANGES:
 *  1. PRE-RENDER GUARD: guard fires synchronously on render, returns null
 *     immediately on redirect — zero flicker between route transitions.
 *  2. GLOBAL HYDRATION: uses useAppContext() instead of calling useUser()
 *     independently — reads from the single cached user, no extra API call.
 *  3. QUOTA-AWARE BLOCKING: rescore and other actions check quota.isExhausted
 *     before making API calls — prevents unnecessary 429s.
 *  4. CHI ACTIONABLE FLOW: each missing CHI requirement renders a CTA button
 *     using Next.js router.push() for SPA navigation (no page reload).
 *  5. RESUME PROCESSING AWARENESS: reads isProcessing from useResumeManager
 *     and surfaces a global banner when the active resume is being processed.
 *  6. ERROR NORMALIZATION: all error displays use `error?.message || fallback`.
 *  7. [HARDENING #3] QuotaExhaustedModal: quota exhaustion shows an overlay
 *     modal instead of replacing the full page, preserving dashboard context.
 *  8. [HARDENING #4] Guard result memoization: applyPageGuards is wrapped in
 *     useMemo so it only re-runs when user or needsResume actually change —
 *     preventing unnecessary recomputation on unrelated re-renders.
 *
 * SAAS MATURITY LAYER:
 *  9. ANALYTICS: page view + dashboard_viewed event on mount. Widget errors,
 *     rescore clicks, and CHI requirement CTAs are individually tracked.
 *     All events use EVENTS/FUNNELS constants — no inline strings.
 * 10. MONITORING: captureError on every widget error path via handleHookError.
 *     Errors carry subsystem + widget tags for dashboard-level observability.
 * 11. FEATURE FLAGS: useFeatureFlag('new_dashboard') and useFeatureFlag('chi_score_v2')
 *     gate experimental layouts and the CHI widget variant respectively.
 *
 * PHASE 3 REFINEMENTS:
 * 12. WIDGET RETRY: Each ErrorBoundary now passes onRetry to WidgetErrorFallback.
 *     onRetry invalidates the relevant query key so React Query re-fetches fresh
 *     data after the boundary resets — no manual page reload needed.
 *     resetKey is NOT used on widgets here: each widget has its own isolated
 *     boundary, so there is no ambient key that would drive a reset. If a future
 *     tabbed layout is added, resetKey should be applied at that level.
 *
 * Architecture unchanged: API → Hooks → UI → Pages.
 */

import { useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '@/context/AppContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { captureError, SUBSYSTEMS } from '@/lib/monitoring';
import { EVENTS, PAGES } from '@/lib/analytics';
import { useDashboard } from '@/hooks/useDashboard';
import { useCareerHealth } from '@/hooks/useCareerHealth';
import { useOpportunities } from '@/hooks/useOpportunities';
import { useResumeScore } from '@/hooks/useResumeScore';
import { useSkillsPriority } from '@/hooks/useSkillsPriority';
import { useQuota } from '@/hooks/useQuota';
import { useResumeManager } from '@/hooks/useResumeManager';
import { queryKeys } from '@/lib/query/queryKeys';
import { applyPageGuards, getCHIMissingRequirements } from '@/lib/guards';
import type { User } from '@/hooks/useUser';

// ── UI Components ──────────────────────────────────────────────────────────────
import { GenerateCareerReportCard } from '@/components/dashboard/GenerateCareerReportCard';
import { CHIScoreWidget }       from '@/components/dashboard/CHIScoreWidget';
import { SkillsPriorityWidget } from '@/components/dashboard/SkillsPriorityWidget';
import { OpportunitiesWidget }  from '@/components/dashboard/OpportunitiesWidget';
import { GrowthWidget }         from '@/components/dashboard/GrowthWidget';
import { ResumeScoreWidget }    from '@/components/dashboard/ResumeScoreWidget';
import { DashboardSkeleton }    from '@/components/dashboard/DashboardSkeleton';
import { QuotaBanner }          from '@/components/common/QuotaBanner';
import { QuotaExhaustedModal }  from '@/components/common/QuotaExhaustedModal';
import { ErrorBoundary }        from '@/components/system';
import { WidgetErrorFallback }  from '@/components/system';

export default function DashboardPage() {
  const navigate = useNavigate();

  // ── Global user from AppContext (no extra /users/me fetch) ────────────────
  const { user, isHydrated } = useAppContext();

  // ── [HARDENING #4] Guard result memoization ───────────────────────────────
  const guardResult = useMemo(
    () => (isHydrated && user ? applyPageGuards(user, /* needsResume */ true) : null),
     
    [user, isHydrated],
  );

  // ── PRE-RENDER GUARD — redirect via useEffect, never during render ────────
  // Calling router.replace() synchronously in the render body triggers a React
  // "setState on Router while rendering DashboardPage" error. Moving it into
  // useEffect defers the navigation to after the current render commit, which
  // is the correct React pattern for imperative navigation side-effects.
  const redirectingRef = useRef(false);
  useEffect(() => {
    if (guardResult && !guardResult.allowed && !redirectingRef.current) {
      redirectingRef.current = true;
      navigate(guardResult.redirectTo, { replace: true });
    }
  }, [guardResult, navigate]);

  // While hydrating, or while a guard redirect is in flight, show skeleton
  if (!isHydrated || (guardResult && !guardResult.allowed)) {
    return <DashboardSkeleton />;
  }

  if (!user) return null;

  return <DashboardContent user={user} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// INNER COMPONENT — rendered only when user is verified
// ─────────────────────────────────────────────────────────────────────────────

function DashboardContent({ user }: { user: User }) {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();

  // ── SaaS Maturity Layer ───────────────────────────────────────────────────
  const { trackEvent, trackPageView } = useAnalytics();
  const isNewDashboard = useFeatureFlag('new_dashboard');
  const isCHIv2        = useFeatureFlag('chi_score_v2');

  useEffect(() => {
    trackPageView(PAGES.DASHBOARD);
    trackEvent(EVENTS.DASHBOARD_VIEWED, {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Quota ─────────────────────────────────────────────────────────────────
  const [quotaModalOpen, setQuotaModalOpen] = useState(false);
  const [upgradeUrl,     setUpgradeUrl]     = useState<string | null>(null);

  // Q-07 — Stable onQuotaExhausted callback.
  //
  // Risk: passing an inline arrow `(url) => { ... }` creates a new function
  // reference on every render. useQuota's exhaustion useEffect depends on
  // [quota, onQuotaExhausted]. When DashboardContent re-renders (e.g. due to
  // any parent state update), onQuotaExhausted gets a new identity → the
  // effect re-fires → setQuotaModalOpen(true) is called again on every
  // re-render while isExhausted is true → modal flash / state instability.
  //
  // Fix: useCallback with stable deps (setUpgradeUrl, setQuotaModalOpen are
  // stable setState dispatch refs — they never change). The callback reference
  // is now stable across renders, so the useEffect in useQuota only re-fires
  // when quota.isExhausted or quota.upgradeUrl actually changes.
  const handleQuotaExhausted = useCallback((url: string | null) => {
    setUpgradeUrl(url ?? '/pricing');
    setQuotaModalOpen(true);
  }, []);

  const { quota } = useQuota(user, {
    onQuotaExhausted: handleQuotaExhausted,
  });

  // Q-07 — Stable handleHookError.
  //
  // Risk: handleHookError is defined inside the render body, creating a new
  // function reference on every render. It is passed as `onError` to all five
  // data hooks. Each hook's useEffect depends on [query.error, onError]. When
  // DashboardContent re-renders, all five effects see a new onError identity
  // and re-fire — even if query.error has not changed. This can cause repeated
  // captureError() calls and repeated trackEvent() calls for a single error.
  //
  // Fix: useCallback with stable deps. setUpgradeUrl, setQuotaModalOpen,
  // trackEvent, and captureError are all stable references (state setters +
  // analytics singletons). The callback is now stable across re-renders and
  // the useEffect in each hook only fires when query.error actually changes.
  const handleHookError = useCallback((err: unknown, widget?: string) => {
    const apiErr = err as { status?: number; quotaExhausted?: boolean; upgradeUrl?: string };
    if (apiErr?.status === 429 || apiErr?.quotaExhausted) {
      setUpgradeUrl(apiErr.upgradeUrl ?? '/pricing');
      setQuotaModalOpen(true);
      trackEvent(EVENTS.QUOTA_MODAL_SHOWN, { source: 'dashboard', widget });
    }
    captureError(err, {
      subsystem: SUBSYSTEMS.DASHBOARD,
      statusCode: apiErr?.status,
      metadata: { widget: widget ?? 'unknown' },
    });
    if (widget) {
      trackEvent(EVENTS.DASHBOARD_WIDGET_ERROR, { widget });
    }
  }, [trackEvent]);

  // Q-07 — Stable per-widget onError callbacks.
  //
  // Risk: passing `(e) => handleHookError(e, 'dashboard')` inline creates a
  // new arrow on every render. Even though handleHookError is now stable,
  // the wrapping arrow is not — so each hook's [query.error, onError] effect
  // still sees a new identity on every re-render.
  //
  // Fix: one useCallback per widget. Widget name is a string literal (stable),
  // handleHookError is now stable. These callbacks are stable for the lifetime
  // of the component, preventing all effect re-fires from identity churn.
  const onDashboardError    = useCallback((e: unknown) => handleHookError(e, 'dashboard'),    [handleHookError]);
  const onChiError          = useCallback((e: unknown) => handleHookError(e, 'chi_score'),    [handleHookError]);
  const onOpportunitiesError = useCallback((e: unknown) => handleHookError(e, 'opportunities'), [handleHookError]);
  const onResumeScoreError   = useCallback((e: unknown) => handleHookError(e, 'resume_score'),  [handleHookError]);
  const onSkillsError        = useCallback((e: unknown) => handleHookError(e, 'skills_priority'), [handleHookError]);

  // ── Resume processing state ───────────────────────────────────────────────
  const { isProcessing: resumeIsProcessing } = useResumeManager();

  // ── Data hooks ────────────────────────────────────────────────────────────
  const {
    data:      dashboardData,
    isLoading: dashboardLoading,
    error:     dashboardError,
  } = useDashboard({ enabled: true, onError: onDashboardError });

  const {
    chiScore,
    chiSnapshot,
    isLoading: chiLoading,
    error:     chiError,
  } = useCareerHealth({ enabled: true, onError: onChiError });

  const {
    opportunities,
    opportunityScore,
    isLoading: opportunitiesLoading,
    error:     opportunitiesError,
  } = useOpportunities({ enabled: true, onError: onOpportunitiesError });

  const {
    resumeScore,
    isLoading: resumeScoreLoading,
    error:     resumeScoreError,
  } = useResumeScore({
    enabled: !!user.resume_uploaded,
    onError: onResumeScoreError,
  });

  const {
    prioritySkills,
    isLoading: skillsLoading,
    error:     skillsError,
  } = useSkillsPriority({ enabled: true, onError: onSkillsError });

  // ── CHI dependency check ───────────────────────────────────────────────────
  const hasSkills     = !!dashboardData?.hasSkills;
  const hasTargetRole = !!dashboardData?.hasTargetRole;

  const { missing: chiMissing } = getCHIMissingRequirements(user, hasSkills, hasTargetRole);
  const chiDependenciesMet = chiMissing.length === 0;

  const chiRouteMap: Record<'resume' | 'skills' | 'targetRole', { label: string; route: string }> = {
    resume:     { label: 'Upload resume',      route: '/resume' },
    skills:     { label: 'Add skills',         route: '/onboarding' },
    targetRole: { label: 'Select target role', route: '/direction' },
  };

  if (dashboardLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Page header */}
        <header className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome back{user.name ? `, ${user.name}` : ''}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your AI-powered career path and future study intelligence.
          </p>
        </header>

        {/* Soft quota warning */}
        <QuotaBanner quota={quota} upgradeUrl="/pricing" className="mb-6" />

        {/* Resume processing banner */}
        {resumeIsProcessing && (
          <div
            role="status"
            className="mb-6 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3"
          >
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-blue-800">
              Your resume is being analysed — scores will update automatically once complete.
            </p>
          </div>
        )}

        {/* Dashboard fetch error */}
        {dashboardError && !quotaModalOpen && (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {dashboardError?.message || 'Failed to load some dashboard data. Please refresh.'}
          </div>
        )}

        {/* CHI prerequisite nudge */}
        {!chiDependenciesMet && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="mb-3 text-sm font-semibold text-amber-800">
              Complete your profile to unlock your Career Health Index
            </h2>
            <ul className="space-y-3">
              {chiMissing.map((item, idx) => {
                const { label, route } = chiRouteMap[item];
                return (
                  <li key={item} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-800">
                        {idx + 1}
                      </span>
                      <span className="text-sm text-amber-800">
                        {item === 'resume'     && 'Upload your resume'}
                        {item === 'skills'     && 'Add skills to your profile'}
                        {item === 'targetRole' && 'Select your target role'}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        trackEvent(EVENTS.CHI_MISSING_REQUIREMENT_CTA, { requirement: item, route });
                        navigate(route);
                      }}
                      className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1"
                    >
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* AI Career Report — moved here from onboarding completion (WP-PRO-03).
            Generation is optional and its failure never blocks Dashboard access. */}
        <div className="mb-6">
          <GenerateCareerReportCard />
        </div>

        {/* ── Main grid ─────────────────────────────────────────────────────
            Phase 3 Refinement 6: each WidgetErrorFallback receives onRetry.
            onRetry invalidates the relevant query key so React Query re-fetches
            after onReset clears the boundary — no full-page reload required.
            The combined effect in WidgetErrorFallback is: onReset() first
            (clears the boundary), then onRetry() (invalidates the query).
        */}
        <div className={`grid grid-cols-1 gap-6 ${isNewDashboard ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>

          {/* CHI Score */}
          <div className="lg:col-span-2">
            <ErrorBoundary
              context="CHIScoreWidget"
              fallback={
                <WidgetErrorFallback
                  title="Career Health Index"
                  isFetching={queryClient.isFetching({ queryKey: queryKeys.careerHealth.all() }) > 0}
                  onRetry={() => {
                    queryClient.resetQueries({ queryKey: queryKeys.careerHealth.all() });
                    // Micro-upgrade 3: skip invalidate if a fetch is already in
                    // flight — resetQueries triggers one; a second call is a no-op
                    // at best and causes a duplicate network request at worst.
                    if (!queryClient.isFetching({ queryKey: queryKeys.careerHealth.all() })) {
                      queryClient.invalidateQueries({ queryKey: queryKeys.careerHealth.all() });
                    }
                  }}
                />
              }
            >
              <CHIScoreWidget
                chiScore={chiScore}
                chiSnapshot={chiSnapshot}
                isLoading={chiLoading}
                error={chiError}
                dependenciesMet={chiDependenciesMet}
                missingItems={{
                  resume:     chiMissing.includes('resume'),
                  skills:     chiMissing.includes('skills'),
                  targetRole: chiMissing.includes('targetRole'),
                }}
                version={isCHIv2 ? 'v2' : 'v1'}
              />
            </ErrorBoundary>
          </div>

          {/* Resume Score */}
          <div>
            <ErrorBoundary
              context="ResumeScoreWidget"
              fallback={
                <WidgetErrorFallback
                  title="Resume Score"
                  isFetching={queryClient.isFetching({ queryKey: queryKeys.resumeScore.all() }) > 0}
                  onRetry={() => {
                    queryClient.resetQueries({ queryKey: queryKeys.resumeScore.all() });
                    if (!queryClient.isFetching({ queryKey: queryKeys.resumeScore.all() })) {
                      queryClient.invalidateQueries({ queryKey: queryKeys.resumeScore.all() });
                    }
                  }}
                />
              }
            >
              <ResumeScoreWidget
                score={resumeScore}
                isLoading={resumeScoreLoading}
                error={resumeScoreError}
                resumeUploaded={!!user.resume_uploaded}
              />
            </ErrorBoundary>
          </div>

          {/* Skills Priority */}
          <div className="lg:col-span-2">
            <ErrorBoundary
              context="SkillsPriorityWidget"
              fallback={
                <WidgetErrorFallback
                  title="Skills Priority"
                  isFetching={queryClient.isFetching({ queryKey: queryKeys.skillsPriority.all() }) > 0}
                  onRetry={() => {
                    queryClient.resetQueries({ queryKey: queryKeys.skillsPriority.all() });
                    if (!queryClient.isFetching({ queryKey: queryKeys.skillsPriority.all() })) {
                      queryClient.invalidateQueries({ queryKey: queryKeys.skillsPriority.all() });
                    }
                  }}
                />
              }
            >
              <SkillsPriorityWidget
                skills={prioritySkills}
                isLoading={skillsLoading}
                error={skillsError}
                hasTargetRole={hasTargetRole}
                hasSkills={hasSkills}
              />
            </ErrorBoundary>
          </div>

          {/* Opportunities */}
          <div>
            <ErrorBoundary
              context="OpportunitiesWidget"
              fallback={
                <WidgetErrorFallback
                  title="Opportunities"
                  isFetching={queryClient.isFetching({ queryKey: queryKeys.opportunities.all() }) > 0}
                  onRetry={() => {
                    queryClient.resetQueries({ queryKey: queryKeys.opportunities.all() });
                    if (!queryClient.isFetching({ queryKey: queryKeys.opportunities.all() })) {
                      queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.all() });
                    }
                  }}
                />
              }
            >
              <OpportunitiesWidget
                opportunities={opportunities}
                opportunityScore={opportunityScore}
                isLoading={opportunitiesLoading}
                error={opportunitiesError}
              />
            </ErrorBoundary>
          </div>

          {/* Growth projection — full width.
              Growth data derives from dashboardData (no dedicated query key).
              showRetry=false is preserved: the growth widget is purely derived
              from the dashboard query already fetched above — retrying in
              isolation would not yield new data. */}
          <div className="lg:col-span-3">
            <ErrorBoundary
              context="GrowthProjectionWidget"
              fallback={
                <WidgetErrorFallback
                  title="Growth Projection"
                  showRetry={false}
                />
              }
            >
              <GrowthWidget
                growthData={dashboardData?.growth}
                targetRole={dashboardData?.targetRole}
                isLoading={dashboardLoading}
                hasError={!!dashboardError}
              />
            </ErrorBoundary>
          </div>

        </div>
      </div>

      {/* Quota exhausted modal */}
      <QuotaExhaustedModal
        open={quotaModalOpen}
        upgradeUrl={upgradeUrl}
        onDismiss={() => setQuotaModalOpen(false)}
        message="You've reached your plan limit. Upgrade to continue accessing all dashboard features."
      />
    </div>
  );
}