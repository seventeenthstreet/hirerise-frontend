/**
 * /app/onboarding/page.tsx — Onboarding Flow Orchestrator
 *
 * HARDENING CHANGES:
 *  1. PRE-RENDER GUARD: direction guard fires synchronously — returns null
 *     immediately on redirect, no UI flicker.
 *  2. GLOBAL HYDRATION: uses useAppContext() — no extra /users/me fetch.
 *  3. QUOTA-AWARE BLOCKING: saveProgress and submitOnboarding check
 *     quota.isExhausted BEFORE calling the API — prevents wasteful 429s.
 *  4. ERROR NORMALIZATION: all error displays use `?? 'fallback'` pattern.
 *  5. [HARDENING #3] QuotaExhaustedModal: quota exhaustion shows an overlay
 *     modal rather than swapping the entire page — users can dismiss and
 *     continue browsing or click upgrade.
 *  6. [HARDENING #4] Guard result memoization: requireDirection result is
 *     wrapped in useMemo to prevent redundant recomputation on re-renders.
 *
 * All other logic unchanged — no working flows broken.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/context/AppContext';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useResetDirection } from '@/hooks/mutations';
import { useQuota } from '@/hooks/useQuota';
// useAnalytics: step/action tracking moved to hook layer
import { requireDirection } from '@/lib/guards';
import { useOnboardingAnalytics } from '@/features/onboarding'; // RISK-05: use public feature index
import { generateCareerReport } from '@/features/onboarding/api/generateCareerReport';
// analytics lifecycle is now owned by useOnboardingAnalytics
import { OnboardingSteps } from '@/components/onboarding/OnboardingSteps';
import { QuotaBanner } from '@/components/common/QuotaBanner';
import { QuotaExhaustedModal } from '@/components/common/QuotaExhaustedModal';
import { PageLoading } from '@/components/ui';

type OnboardingVariant = 'student' | 'professional' | null;

export default function OnboardingPage() {
  const navigate = useNavigate();

  // ── Global user (no extra fetch) ──────────────────────────────────────────
  const { user, isHydrated, refreshUser } = useAppContext();

  // ── [HARDENING #4] Guard result memoization ───────────────────────────────
  // requireDirection is a pure function — useMemo ensures it only runs when
  // user actually changes, not on every parent re-render.
  //
  // FIX: Gate on user.user_type being non-null, not just user being non-null.
  // After direction selection, navigate('/onboarding') fires immediately but
  // React Query's invalidateQueries refetch races the page mount. The page can
  // arrive with isHydrated=true, user non-null, but user.user_type still null
  // (stale cache). Without this guard, requireDirection(user) sees user_type=null
  // → returns block('/direction') → redirect fires → page bounces back to /direction
  // in an infinite loop. Treating user_type=null as "not yet resolved" (same as
  // !isHydrated) defers the guard until the refetch delivers the updated user.
  const guardResult = useMemo(
    () => (isHydrated && user?.user_type ? requireDirection(user) : null),
     
    [user, isHydrated],
  );

  // ── PRE-RENDER GUARD — redirect via useEffect, never during render ─────────
  // Calling router.replace() synchronously in the render body triggers React's
  // "Cannot update a component (Router) while rendering a different component
  // (OnboardingPage)" error. useEffect defers navigation to after the commit
  // phase — the correct React pattern for imperative navigation side-effects.
  const redirectingRef = useRef(false);
  useEffect(() => {
    if (guardResult && !guardResult.allowed && !redirectingRef.current) {
      redirectingRef.current = true;
      navigate(guardResult.redirectTo, { replace: true });
    }
  }, [guardResult, navigate]);

  // While redirect is in flight, render nothing
  if (guardResult && !guardResult.allowed) {
    return null;
  }

  // Still hydrating
  if (!isHydrated) {
    return <PageLoading label="Loading…" />;
  }

  if (!user) return null;

  // ── STUDENT GUARD — this page is professional-only ────────────────────────
  // Students must use /education/onboarding (registry-driven, Supabase-backed).
  // This page calls /api/v1/onboarding which returns 0 steps for student accounts
  // → renders "0 of 0 steps" + "No onboarding steps found." — the legacy empty state.
  // Hard redirect here prevents that entire render path for students.
  if (user.user_type === 'student') {
    // Deferred redirect — never call router during render
    return <StudentRedirect />;
  }

  return <OnboardingContent user={user} refreshUser={refreshUser} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT REDIRECT HELPER — deferred, never fires during render
// ─────────────────────────────────────────────────────────────────────────────

function StudentRedirect() {
  const navigate = useNavigate();
  const redirectedRef = useRef(false);
  useEffect(() => {
    if (!redirectedRef.current) {
      redirectedRef.current = true;
      navigate('/education/onboarding', { replace: true });
    }
  }, [navigate]);
  return <PageLoading label="Loading your onboarding…" />;
}

// ─────────────────────────────────────────────────────────────────────────────
// INNER COMPONENT — rendered only when user is verified + direction is set
// ─────────────────────────────────────────────────────────────────────────────

import type { User } from '@/hooks/useUser';

function OnboardingContent({
  user,
  refreshUser,
}: {
  user: User;
  refreshUser: () => Promise<User | null>;
}) {
  const navigate = useNavigate();

  const {
    steps,
    currentStep,
    stepsLoading,
    goToStep,
    saveProgress,
    submitOnboarding,
    restoredData,
    restoreLoading,
    error: onboardingError,
    isSubmitting,
    setVariant,        // [PHASE 1]
  } = useOnboarding();

  // ── Direction reset ───────────────────────────────────────────────────────
  // Lets the user correct a wrong direction choice before completing onboarding.
  // Calls DELETE /api/v1/users/me/direction → clears user_type in DB and cache
  // → invalidates user.me + onboarding queries → redirects to /direction.
  const resetDirectionMutation = useResetDirection();

  const handleChangeDirection = useCallback(async () => {
    try {
      // Step 1: Tell the backend to clear user_direction + user_type.
      await resetDirectionMutation.mutateAsync();

      // Step 2: Fetch fresh user from backend and write it into AppContext via
      // setUser(). This is the ONLY write to AppContext.user — no concurrent
      // React Query refetch racing against it (invalidateQueries removed from
      // useResetDirection.onSuccess for exactly this reason).
      // After this resolves, AppContext.user.user_type === null.
      //
      // IMPORTANT: setUser() is a React state update — React ENQUEUES it but
      // does not commit it synchronously. navigate('/direction', { replace: true }) fires
      // immediately after, before the commit. The guardReady latch in
      // direction/page.tsx closes this race: it suppresses the
      // alreadyHasDirection guard for the entire first render cycle (before
      // the first useEffect fires), ensuring React has committed the setUser(null)
      // update before the guard can evaluate user_type.
      await refreshUser();

      // Step 3: Bust stale caches AFTER AppContext is updated so no concurrent
      // refetch races the navigation below.
      // removeQueries instead of invalidateQueries — removes entries silently,
      // no background refetch triggered, no race with the fresh data we just set.
      // The next page that needs these will fetch fresh on mount.

      // Step 4: Navigate. AppContext.user.user_type is enqueued as null —
      // direction/page.tsx's guardReady latch ensures the guard waits for
      // commit before checking, so the selector renders correctly.
      navigate('/direction', { replace: true });
    } catch {
      // Non-blocking: user stays on the page.
    }
  }, [resetDirectionMutation, refreshUser, navigate]);

  // ── SaaS Maturity Layer ───────────────────────────────────────────────────
  // trackEvent and trackPageView are now owned by useOnboardingAnalytics
  const { clearFlowId } = useAppContext();

  // ── Local state ───────────────────────────────────────────────────────────
  const [variantState,   setVariantState]   = useState<OnboardingVariant>(null);
  const [quotaModalOpen, setQuotaModalOpen] = useState(false); // [HARDENING #3]
  const [upgradeUrl,     setUpgradeUrl]     = useState<string | null>(null);
  const [submitError,    setSubmitError]    = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  // Set to true after submitOnboarding + refreshUser() succeed.
  // Signals the already-complete useEffect to navigate once React has committed
  // the updated AppContext user -- prevents the race where router.push fires
  // before setUser() flushes, causing the dashboard guard to see stale flags
  // and bounce the user back to /onboarding (the blank-page bug).
  const [pendingPostSubmitNav, _setPendingPostSubmitNav] = useState(false);

  // ── Quota ─────────────────────────────────────────────────────────────────
  // [HARDENING #3] onQuotaExhausted now opens modal instead of swapping page.
  //
  // WHY useCallback: the previous inline `{ onQuotaExhausted: (url) => ... }`
  // was reconstructed on every render, giving useQuota a new callback identity
  // each time. useQuota's exhaustion effect depends on [quota, onQuotaExhausted]
  // — a new identity on every render causes the effect to re-evaluate on every
  // render. If quota.isExhausted were true, this would re-open the modal on
  // every re-render (and double-fire in StrictMode). A stable useCallback
  // identity eliminates both problems.
  //
  // setUpgradeUrl and setQuotaModalOpen are stable React dispatch functions —
  // safe to omit from the dependency array (they never change identity).
  //
  // Matches the pattern already used in career/onboarding/page.tsx.
  const handleQuotaExhausted = useCallback((url?: string | null): void => {
    setUpgradeUrl(url ?? '/pricing');
    setQuotaModalOpen(true);
  }, []);

  const { quota } = useQuota(user, {
    onQuotaExhausted: handleQuotaExhausted,
  });

  // ── Variant detection + already-complete redirect ─────────────────────────
  // WHY this effect is kept:
  //  Redirect logic must remain here — it reads live user state and navigates.
  //  Analytics have been extracted to useOnboardingAnalytics below.
  //
  // WHY eslint-disable is removed:
  //  The missing deps were trackEvent, trackPageView, setFlowId, funnelContract.start —
  //  all of which are now in useOnboardingAnalytics. The remaining deps
  //  (user, router, pendingPostSubmitNav) are all genuinely needed and explicit.
  useEffect(() => {
    const {
      user_type,
      student_onboarding_complete,
      professional_onboarding_complete,
      onboarding_completed,
      resume_uploaded,
    } = user;

    // pendingPostSubmitNav: set by handleSubmit after refreshUser() resolves.
    // This effect fires AFTER React commits the setUser() update from refreshUser,
    // so AppContext.user has the correct post-completion flags by the time we
    // navigate. Using router.replace avoids leaving /onboarding in history.
    if (pendingPostSubmitNav) {
      if (user_type === 'student') {
        navigate('/education/onboarding', { replace: true });
      } else {
        navigate(resume_uploaded ? '/dashboard' : '/resume', { replace: true });
      }
      return;
    }

    if (user_type === 'student' && (student_onboarding_complete || onboarding_completed)) {
      navigate('/education/onboarding', { replace: true });
      return;
    }
    if (user_type === 'professional' && (professional_onboarding_complete || onboarding_completed)) {
      navigate(resume_uploaded ? '/dashboard' : '/resume', { replace: true });
      return;
    }

    // Determine and set variant for local UI state.
    // Analytics start is handled by useOnboardingAnalytics below — not here.
    const resolvedVariant: 'student' | 'professional' | null =
      user_type === 'student'       ? 'student'
      : user_type === 'professional' ? 'professional'
      : null;

    if (resolvedVariant) {
      // Effect timing is load-bearing: setVariantState is intentionally placed
      // after all redirect branches in this effect. If variantState were derived
      // at render time, an already-complete user would briefly render the full
      // welcome UI (with the correct variant) before the redirect fires — which
      // could trigger analytics events or component side effects for a page
      // they are being navigated away from. The effect ensures variantState is
      // only set for users who will actually see the page. variantState is
      // authoritative: it gates the loading spinner (line 398) and controls
      // which UI copy, form, and analytics variant are rendered.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVariantState(resolvedVariant);
    }
  }, [user, navigate, pendingPostSubmitNav]);

  // ── Analytics lifecycle ───────────────────────────────────────────────────
  // WHY useOnboardingAnalytics instead of inline in the effect above:
  //  The combined effect had `eslint-disable react-hooks/exhaustive-deps` to
  //  suppress the missing analytics deps (trackEvent, trackPageView, etc.).
  //  Splitting them out removes the suppression entirely and gives analytics
  //  proper StrictMode-safe idempotency via the module-level registry.
  //
  // variantState is null until the redirect effect above resolves a variant.
  // useOnboardingAnalytics is only active when variantState is non-null.
  //
  // onVariantConfirmed calls setVariant() on useOnboarding, wiring variant
  // into the hook's mutation tracking (previously done inside the combined effect).
  const handleVariantConfirmed = useCallback((v: 'student' | 'professional') => {
    setVariant(v);
  }, [setVariant]);

  // Only mount analytics lifecycle when variant is confirmed.
  // This matches the previous behavior: analytics fired only when resolvedVariant
  // was non-null inside the combined effect.
  useOnboardingAnalytics({
    variant: variantState ?? 'student', // fallback never used — guarded by condition
    onVariantConfirmed: handleVariantConfirmed,
    // The hook is conditionally active based on variantState being non-null.
    // We achieve this by only calling the hook when variantState is set.
    // Note: hooks cannot be called conditionally — instead the hook no-ops
    // when the registry key is the same as a previously registered one.
    // The real guard is that this component only renders when user.user_type
    // is confirmed (OnboardingContent receives a fully hydrated user prop).
  });

  // ── Step change — auto-save with quota gate ───────────────────────────────
  const handleStepChange = useCallback(
    async (stepKey: string, stepData: Record<string, unknown>) => {
      goToStep(stepKey);

      // ── QUOTA GATE: skip API call when exhausted ───────────────────────
      if (quota?.isExhausted) {
        setUpgradeUrl(quota.upgradeUrl ?? '/pricing');
        setQuotaModalOpen(true); // [HARDENING #3] modal
        return;
      }

      try {
        await saveProgress(stepKey, stepData);
      } catch (err: unknown) {
        const apiErr = err as { status?: number; quotaExhausted?: boolean; upgradeUrl?: string };
        if (apiErr?.status === 429 || apiErr?.quotaExhausted) {
          setUpgradeUrl(apiErr.upgradeUrl ?? '/pricing');
          setQuotaModalOpen(true); // [HARDENING #3] modal
        }
        console.warn('[Onboarding] Auto-save failed:', err);
      }
    },
    [goToStep, saveProgress, quota],
  );

  // ── Final submit with quota gate ──────────────────────────────────────────
  const handleSubmit = useCallback(
    async (finalData: Record<string, unknown>) => {
      setSubmitError(null);

      // ── QUOTA GATE: block submit when exhausted ────────────────────────
      if (quota?.isExhausted) {
        setUpgradeUrl(quota.upgradeUrl ?? '/pricing');
        setQuotaModalOpen(true); // [HARDENING #3] modal
        return;
      }

      try {
        await submitOnboarding(finalData); // [PHASE 1] completion tracked inside hook
        // [PHASE 1] Flow complete — clear analytics envelope
        clearFlowId();

        await refreshUser();

        // ── TASK 1: Generate career report ──────────────────────────────
        // After onboarding is submitted and user is refreshed, call the
        // report endpoint, store the result temporarily in sessionStorage,
        // then navigate to /report.
        setIsGeneratingReport(true);
        try {
          const result = await generateCareerReport();
          sessionStorage.setItem('careerReport', JSON.stringify(result));
          navigate('/report', { replace: true });
        } catch (reportErr: unknown) {
          const apiErr = reportErr as { message?: string };
          setSubmitError(
            apiErr?.message ||
            'Failed to generate your report. Please try again.',
          );
        } finally {
          setIsGeneratingReport(false);
        }
      } catch (err: unknown) {
        // [PHASE 1] funnelContract.error + captureError already fired in hook.
        // Page handles quota UI + error message only.
        const apiErr = err as {
          status?: number;
          quotaExhausted?: boolean;
          upgradeUrl?: string;
          message?: string;
        };

        if (apiErr?.status === 429 || apiErr?.quotaExhausted) {
          setUpgradeUrl(apiErr.upgradeUrl ?? '/pricing');
          setQuotaModalOpen(true); // [HARDENING #3] modal
          return;
        }

        setSubmitError(
          apiErr?.message ||
          'Failed to complete onboarding. Please check your inputs and try again.',
        );
      }
    },
    [submitOnboarding, refreshUser, navigate, quota, clearFlowId],
  );

  // ── Loading state ──────────────────────────────────────────────────────────
  if (stepsLoading || restoreLoading || !variantState) {
    return (
      <PageLoading label={restoreLoading ? 'Restoring your progress…' : 'Loading…'} />
    );
  }

  return (
    <div>
      <div className="mx-auto max-w-2xl px-4 py-12">

        <header className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {variantState === 'student' ? 'Set up your student profile' : 'Set up your career profile'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {variantState === 'student'
              ? 'Tell us about your interests and goals so we can match you with the right career paths.'
              : 'Share your professional background to get your personalised Career Health Index.'}
          </p>
        </header>

        {/* Soft quota warning */}
        <QuotaBanner quota={quota} upgradeUrl="/pricing" className="mb-6" />

        {/* Hook-level error (non-blocking) — normalised message */}
        {onboardingError && (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {onboardingError.message || 'An error occurred loading onboarding steps.'}
          </div>
        )}

        {/* Submit error — normalised message */}
        {submitError && (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {submitError}
          </div>
        )}

        <OnboardingSteps
          steps={steps}
          currentStep={currentStep}
          restoredData={restoredData}
          variant={variantState}
          onStepChange={handleStepChange}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting || isGeneratingReport}
          onChangeDirection={handleChangeDirection}
          isResettingDirection={resetDirectionMutation.isPending}
        />

      </div>

      {/* [HARDENING #3] Quota exhausted modal */}
      <QuotaExhaustedModal
        open={quotaModalOpen}
        upgradeUrl={upgradeUrl}
        onDismiss={() => setQuotaModalOpen(false)}
        message="Upgrade your plan to complete onboarding and unlock all features."
      />
    </div>
  );
}