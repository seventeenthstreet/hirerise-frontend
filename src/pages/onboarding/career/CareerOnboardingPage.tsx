/**
 * /app/career/onboarding/page.tsx — Career (Professional) Onboarding Flow
 *
 * Full-featured onboarding page for users who selected "career" direction.
 * Mirrors the architecture of /app/onboarding/page.tsx but is dedicated to
 * the professional variant — rendering real step forms rather than the
 * abstract step list used during the bootstrap phase.
 *
 * GUARDS:
 *  1. Must be hydrated (AppContext)
 *  2. Must have direction set (user_type !== null) → /direction
 *  3. Must be professional user_type → /onboarding (fallback)
 *  4. If already complete → /dashboard or /resume
 *
 * STEP FORMS (professional variant):
 *  1. consent          — Data use consent + terms
 *  2. personal-details — Name, current role, years of experience
 *  3. career-intent    — Target role, growth timeline, priorities
 *  4. skills           — Current skills (multi-select)
 *  5. complete         — Terminal submit (triggers career report generation)
 *
 * ARCHITECTURE:
 *  - Uses useOnboarding() hook (same as /onboarding) for API + cache
 *  - Uses useAppContext() for user — no duplicate /users/me fetch
 *  - Quota-gated: save and submit check quota.isExhausted first
 *  - Analytics: trackEvent + funnelContract wired to ONBOARDING_PROFESSIONAL flow
 *  - All step forms are local — they do NOT call the API directly
 *    Step data is passed through onStepChange / onSubmit callbacks → useOnboarding
 *
 * DESIGN AESTHETIC:
 *  Refined editorial dark theme. Monospace accents for step numbers.
 *  Warm off-white type on near-black canvas. Single high-contrast accent.
 *  Feels like a premium career intelligence tool, not a generic SaaS form.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/context/AppContext';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useQuota } from '@/hooks/useQuota';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useOnboardingDirectionSwitch } from '@/hooks/onboarding';
import { requireDirection } from '@/lib/guards';
import { EVENTS } from '@/lib/analytics';
import { captureError, SUBSYSTEMS, ACTIONS } from '@/lib/monitoring';
import { QuotaExhaustedModal } from '@/components/common/QuotaExhaustedModal';
import { SwitchDirectionButton } from '@/components/onboarding/SwitchDirectionButton';
import { useOnboardingAnalytics } from '@/features/onboarding';
import type { User } from '@/hooks/useUser';

// ─────────────────────────────────────────────────────────────────────────────
// STEP DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

type StepId =
  | 'consent'
  | 'personal-details'
  | 'career-intent'
  | 'skills'
  | 'complete';

interface StepConfig {
  id:       StepId;
  label:    string;
  subtitle: string;
}

const CAREER_STEPS: StepConfig[] = [
  {
    id:       'consent',
    label:    'Data & Privacy',
    subtitle: 'How we use your information',
  },
  {
    id:       'personal-details',
    label:    'Your Background',
    subtitle: 'Current role & experience',
  },
  {
    id:       'career-intent',
    label:    'Career Goals',
    subtitle: 'Where you want to go',
  },
  {
    id:       'skills',
    label:    'Skills Profile',
    subtitle: 'What you bring to the table',
  },
  {
    id:       'complete',
    label:    'Finalise',
    subtitle: 'Generate your Career Health Index',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// STABLE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Module-level no-op for useOnboardingAnalytics({ onVariantConfirmed }).
 *
 * This page is variant-fixed ('professional') — setVariant() is already called
 * in the progress-restore useEffect, so the analytics hook's callback is unused.
 * Defined outside the component so it has a stable identity across renders and
 * never appears as a changed dependency in useOnboardingAnalytics.
 */
function NOOP_VARIANT_CONFIRMED(_variant: string): void { /* intentional no-op */ }

// ─────────────────────────────────────────────────────────────────────────────
// OUTER PAGE GUARD
// ─────────────────────────────────────────────────────────────────────────────

export default function CareerOnboardingPage() {
  const navigate = useNavigate();
  const { user, isHydrated, refreshUser } = useAppContext();

  const guardResult = useMemo(
    () => (isHydrated && user ? requireDirection(user) : null),
    [user, isHydrated],
  );

  // ── Single-redirect guard ─────────────────────────────────────────────────
  // Without this ref, the useEffect below can fire router.replace() from
  // multiple branches in the same effect run (e.g. !guardResult.allowed AND
  // user.user_type !== 'professional' evaluating sequentially on the same
  // commit). The ref collapses all branches to exactly one navigation per mount.
  //
  // StrictMode safety: the ref is not reset between StrictMode's two mounts —
  // once a redirect fires on the first mount, the second mount's effect sees
  // redirectingRef.current === true and exits. This is correct: the navigation
  // from the first mount is already in progress and owns the route.
  const redirectingRef = useRef(false);

  // Redirect if direction guard fails
  useEffect(() => {
    if (redirectingRef.current) return;
    if (!guardResult) return;
    if (!guardResult.allowed) {
      redirectingRef.current = true;
      navigate(guardResult.redirectTo, { replace: true });
      return;
    }
    // Must be professional for this page
    if (user && user.user_type !== 'professional') {
      redirectingRef.current = true;
      navigate('/onboarding', { replace: true });
      return;
    }
    // Already complete
    if (
      user &&
      (user.professional_onboarding_complete || user.onboarding_completed)
    ) {
      redirectingRef.current = true;
      navigate(user.resume_uploaded ? '/dashboard' : '/resume', { replace: true });
    }
  }, [guardResult, user, navigate]);

  if (!isHydrated) {
    return <FullPageSpinner label="Loading your profile…" />;
  }

  if (!user) return null;

  // While guard is resolving or will redirect, show spinner
  if (
    !guardResult?.allowed ||
    user.user_type !== 'professional' ||
    user.professional_onboarding_complete ||
    user.onboarding_completed
  ) {
    return <FullPageSpinner label="Redirecting…" />;
  }

  return <CareerOnboardingContent user={user} refreshUser={refreshUser} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// INNER CONTENT — rendered only when guards pass
// ─────────────────────────────────────────────────────────────────────────────

function CareerOnboardingContent({
  user,
  refreshUser,
}: {
  user: User;
  refreshUser: () => Promise<User | null>;
}) {
  const navigate = useNavigate();
  const { trackEvent } = useAnalytics();
  const { clearFlowId } = useAppContext();
  const {
    saveProgress,
    submitOnboarding,
    restoredData,
    isSubmitting,
    setVariant,
  } = useOnboarding();

  // ── Direction switch (Phase B.5) ──────────────────────────────────────────
  const { switchDirection, isSwitching } = useOnboardingDirectionSwitch();

  // ── Local state ───────────────────────────────────────────────────────────
  const [activeStep,     setActiveStep]     = useState<StepId>('consent');
  const [completedSteps, setCompletedSteps] = useState<Set<StepId>>(new Set());
  const [submitError,    setSubmitError]    = useState<string | null>(null);
  const [quotaModalOpen, setQuotaModalOpen] = useState(false);
  const [upgradeUrl,     setUpgradeUrl]     = useState<string | null>(null);
  const [isStepSaving,   setIsStepSaving]   = useState(false);

  // ── Post-submit navigation flag ───────────────────────────────────────────
  // Set to true after submitOnboarding + refreshUser() succeed.
  // Triggers the already-complete useEffect to navigate once React has committed
  // the updated AppContext user — prevents the race where router.push fires
  // before setUser() flushes, causing the destination guard to see stale flags
  // and bounce the user back here.
  //
  // WHY: refreshUser() calls setUser() in AppContext, but React ENQUEUES the
  // update — it isn't committed until the next render cycle. If we call
  // router.push() immediately after refreshUser() resolves (as the original code
  // did), the destination page mounts before that commit, reads stale user flags
  // (onboarding_completed=false), and its guard redirects straight back — the
  // blank-page/loop bug. Using pendingPostSubmitNav defers navigation to a
  // useEffect, which always fires AFTER React commits all pending state updates.
  const [pendingPostSubmitNav, setPendingPostSubmitNav] = useState(false);

  // Accumulated form data across all steps
  const formDataRef = useRef<Record<string, unknown>>({});

  // ── Analytics lifecycle ───────────────────────────────────────────────────
  // Replaces the previous boot useEffect that mixed analytics firing with
  // progress-restore logic. useOnboardingAnalytics owns:
  //   - trackPageView(PAGES.ONBOARDING)
  //   - trackEvent(EVENTS.ONBOARDING_STARTED, { variant: 'professional' })
  //   - funnelContract.start(FUNNELS.ONBOARDING, 'page_loaded', ...)
  //   - setFlowId(FLOW_IDS.ONBOARDING_PROFESSIONAL)
  //   - clearFlowId() on unmount
  // StrictMode safety: idempotency guard prevents double-fire on mount→unmount→remount.
  //
  // WHY onVariantConfirmed is a no-op here:
  //   This page is variant-fixed (always 'professional') and setVariant() is
  //   already called in the progress-restore effect below. NOOP_VARIANT_CONFIRMED
  //   is stable (module-level) so it never causes the effect to re-run.
  useOnboardingAnalytics({
    variant: 'professional',
    onVariantConfirmed: NOOP_VARIANT_CONFIRMED,
  });

  // ── Progress restore + variant init ───────────────────────────────────────
  // Separated from analytics boot to keep each effect single-purpose.
  // setVariant writes to a ref (no React state update) — safe inside an effect
  // and must NOT be called in the render body (side effects during render violate
  // React's rules even when the target is a ref).
  useEffect(() => {
    setVariant('professional');

    if (restoredData?.completedSteps && Array.isArray(restoredData.completedSteps)) {
      // One-time onboarding progress restoration from React Query data.
      //
      // restoredData arrives asynchronously after mount: useOnboarding() fetches
      // the user's previously saved progress via React Query, which resolves some
      // time after the component renders. When it resolves, restoredData contains
      // the steps the user has already completed in a prior session.
      //
      // This call seeds completedSteps from that server-side snapshot exactly once
      // at mount. After restoration, completedSteps becomes the locally authoritative
      // source of truth and continues to grow as the user advances through the flow
      // (see handleStepComplete). Re-deriving completedSteps from restoredData on
      // every render — or including restoredData in this effect's deps — would
      // overwrite locally accumulated progress whenever React Query re-fetches in
      // the background, silently resetting the user's position mid-session.
      // The "cascading renders" concern from react-hooks/set-state-in-effect does
      // not apply here: React 18 batches both setState calls below into a single
      // commit, and the effect fires at most once ([] dep array). The alternative —
      // using useLayoutEffect or deferring via useReducer — would complicate the
      // restoration logic without improving correctness.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCompletedSteps(new Set(restoredData.completedSteps as StepId[]));
      const lastCompleted = (restoredData.completedSteps as StepId[]).at(-1);
      const currentIdx = CAREER_STEPS.findIndex((s) => s.id === lastCompleted);
      if (currentIdx !== -1 && currentIdx + 1 < CAREER_STEPS.length) {
        // Resume-position restoration: land the user on the next uncompleted step.
        //
        // activeStep must be derived from completedSteps at the moment of
        // restoration, not on every render. The correct resume position is
        // CAREER_STEPS[lastCompletedIndex + 1] — the step immediately after
        // the furthest step the user reached. Deriving this from restoredData
        // at render time is unsafe for the same reason as completedSteps: a
        // background React Query refresh would re-run this derivation and jump
        // the user backward to a step they have already submitted, discarding
        // any unsaved form state collected since mount.
        setActiveStep(CAREER_STEPS[currentIdx + 1].id);
      }
    }
  // intentional: restoredData is excluded from deps to make this a one-shot
  // restoration that fires only on mount.
  //
  // Including restoredData would cause the effect to re-run every time React
  // Query refreshes its cache in the background (stale-while-revalidate polling,
  // window-focus refetch, or manual invalidation). Each re-run would overwrite
  // completedSteps and activeStep with the server snapshot, erasing any local
  // progress the user made since the page loaded. The [] dep array guarantees
  // restoration happens exactly once, after which local state owns the session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Post-submit navigation — deferred until React commits setUser() ────────
  // This effect fires AFTER React commits all pending state updates, including
  // the setUser() update enqueued by refreshUser() in handleStepComplete.
  // By the time this effect runs, AppContext.user has the correct
  // post-completion flags — so the destination page guard won't bounce.
  //
  // pendingPostSubmitNav is set by handleStepComplete (complete step) after
  // submitOnboarding + refreshUser() resolve.
  //
  // StrictMode: the `user` dependency means this effect re-runs when user
  // changes. The pendingPostSubmitNav flag gates the navigation so it only
  // fires once — even in StrictMode's double-invocation.
  useEffect(() => {
    if (!pendingPostSubmitNav) return;
    // Navigate based on the freshly committed user state.
    navigate(user.resume_uploaded ? '/dashboard' : '/resume', { replace: true });
  }, [user, pendingPostSubmitNav, navigate]);

  // ── Quota ─────────────────────────────────────────────────────────────────
  // WHY useCallback: the options object passed to useQuota is recreated on every
  // render if onQuotaExhausted is defined inline. If useQuota stores or compares
  // the callback (e.g. in a useEffect dep array), inline definition causes
  // unnecessary re-runs. useCallback with stable setter deps gives the same
  // function identity across renders.
  const handleQuotaExhausted = useCallback((url: string | null) => {
    setUpgradeUrl(url ?? '/pricing');
    setQuotaModalOpen(true);
  }, []); // setUpgradeUrl / setQuotaModalOpen are stable React dispatch functions

  const { quota } = useQuota(user, { onQuotaExhausted: handleQuotaExhausted });

  // ── Step navigation ───────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const activeIndex = CAREER_STEPS.findIndex((s) => s.id === activeStep);

  const handleStepComplete = useCallback(
    async (stepId: StepId, stepData: Record<string, unknown>) => {
      if (quota?.isExhausted) {
        setUpgradeUrl(quota.upgradeUrl ?? '/pricing');
        setQuotaModalOpen(true);
        return;
      }

      // Merge step data into accumulated form data
      formDataRef.current = { ...formDataRef.current, ...stepData };

      if (stepId === 'complete') {
        // Terminal submit
        setSubmitError(null);
        try {
          await submitOnboarding(formDataRef.current);
          clearFlowId();
          // Do NOT call router.push() here. refreshUser() enqueues setUser()
          // in AppContext — React batches and commits it asynchronously.
          // If we navigate immediately, the destination guard reads stale
          // user flags (onboarding_completed=false) and bounces back here.
          // Setting pendingPostSubmitNav triggers the post-submit useEffect
          // which fires AFTER React commits the setUser() update, guaranteeing
          // the destination page sees the correct post-completion user state.
          await refreshUser();
          setPendingPostSubmitNav(true);
        } catch (err: unknown) {
          const apiErr = err as { status?: number; quotaExhausted?: boolean; upgradeUrl?: string; message?: string };
          if (apiErr?.status === 429 || apiErr?.quotaExhausted) {
            setUpgradeUrl(apiErr.upgradeUrl ?? '/pricing');
            setQuotaModalOpen(true);
            return;
          }
          setSubmitError(
            apiErr?.message || 'Failed to complete setup. Please check your inputs and try again.',
          );
          captureError(err, {
            subsystem: SUBSYSTEMS.ONBOARDING,
            action:    ACTIONS.SUBMIT_ONBOARDING,
            severity:  'error',
          });
        }
        return;
      }

      // Intermediate step — save progress
      setIsStepSaving(true);
      try {
        await saveProgress(stepId, stepData);
        // WHY functional setter: the old pattern `new Set(completedSteps)` closed
        // over the `completedSteps` state value, requiring it in the dependency
        // array. Every step completion updated `completedSteps`, invalidating
        // `handleStepComplete` and re-rendering all step components. The functional
        // form reads the current state at call-time without a closure dependency,
        // removing `completedSteps` from deps and stabilizing the callback identity.
        setCompletedSteps((prev) => {
          const next = new Set(prev);
          next.add(stepId);
          return next;
        });
        trackEvent(EVENTS.ONBOARDING_STEP_SAVED, { step: stepId });

        // Advance to next step
        const nextIdx = CAREER_STEPS.findIndex((s) => s.id === stepId) + 1;
        if (nextIdx < CAREER_STEPS.length) {
          setActiveStep(CAREER_STEPS[nextIdx].id);
        }
      } catch (err: unknown) {
        const apiErr = err as { status?: number; quotaExhausted?: boolean; upgradeUrl?: string };
        if (apiErr?.status === 429 || apiErr?.quotaExhausted) {
          setUpgradeUrl(apiErr.upgradeUrl ?? '/pricing');
          setQuotaModalOpen(true);
        }
        trackEvent(EVENTS.ONBOARDING_STEP_ERROR, { step: stepId });
      } finally {
        setIsStepSaving(false);
      }
    },
    [
      // completedSteps intentionally removed — now read via functional setter
      quota,
      saveProgress,
      submitOnboarding,
      refreshUser,
      clearFlowId,
      trackEvent,
    ],
  );

  const isBusy = isStepSaving || isSubmitting;

  return (
    <>
      {/*
        ─────────────────────────────────────────────────────────────────────
        LAYOUT: Two-column on desktop, single column on mobile.
        Left: sticky progress rail + branding
        Right: scrollable step content
        ─────────────────────────────────────────────────────────────────────
      */}
      <div className="min-h-screen bg-[#0f0f0f] text-[#f0ede6]" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

        {/* Google Font import via style tag */}
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

          :root {
            --accent:       #e8d5a3;
            --accent-dim:   #c4a96a;
            --surface:      #171717;
            --surface-2:    #1f1f1f;
            --border:       #2a2a2a;
            --border-focus: #3d3d3d;
            --text:         #f0ede6;
            --text-muted:   #6b6b6b;
            --text-dim:     #3d3d3d;
            --success:      #4caf50;
            --error:        #ef5350;
          }

          .step-enter {
            animation: stepSlideIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          @keyframes stepSlideIn {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
          }

          .field-group label {
            display: block;
            font-size: 0.75rem;
            font-weight: 500;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--text-muted);
            margin-bottom: 0.5rem;
          }
          .field-group input,
          .field-group select,
          .field-group textarea {
            width: 100%;
            background: var(--surface-2);
            border: 1px solid var(--border);
            border-radius: 0.5rem;
            padding: 0.75rem 1rem;
            font-size: 0.925rem;
            color: var(--text);
            font-family: inherit;
            transition: border-color 0.15s;
            outline: none;
            -webkit-appearance: none;
          }
          .field-group input:focus,
          .field-group select:focus,
          .field-group textarea:focus {
            border-color: var(--accent-dim);
          }
          .field-group input::placeholder,
          .field-group textarea::placeholder {
            color: var(--text-dim);
          }
          .field-group select option {
            background: var(--surface-2);
          }

          .skill-pill {
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
            padding: 0.35rem 0.85rem;
            border-radius: 999px;
            border: 1px solid var(--border);
            font-size: 0.8rem;
            cursor: pointer;
            transition: all 0.15s;
            color: var(--text-muted);
            background: transparent;
            font-family: inherit;
          }
          .skill-pill:hover {
            border-color: var(--accent-dim);
            color: var(--text);
          }
          .skill-pill.selected {
            background: var(--accent);
            border-color: var(--accent);
            color: #0f0f0f;
            font-weight: 500;
          }

          .primary-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            padding: 0.75rem 1.75rem;
            border-radius: 0.5rem;
            background: var(--accent);
            color: #0f0f0f;
            font-weight: 600;
            font-size: 0.9rem;
            border: none;
            cursor: pointer;
            transition: opacity 0.15s, transform 0.1s;
            font-family: inherit;
          }
          .primary-btn:hover:not(:disabled) { opacity: 0.9; }
          .primary-btn:active:not(:disabled) { transform: scale(0.98); }
          .primary-btn:disabled { opacity: 0.45; cursor: not-allowed; }

          .consent-checkbox {
            appearance: none;
            -webkit-appearance: none;
            width: 1.125rem;
            height: 1.125rem;
            border: 1.5px solid var(--border-focus);
            border-radius: 0.25rem;
            background: var(--surface-2);
            cursor: pointer;
            position: relative;
            flex-shrink: 0;
            transition: border-color 0.15s, background 0.15s;
          }
          .consent-checkbox:checked {
            background: var(--accent);
            border-color: var(--accent);
          }
          .consent-checkbox:checked::after {
            content: '';
            position: absolute;
            left: 3px; top: 1px;
            width: 8px; height: 5px;
            border-left: 2px solid #0f0f0f;
            border-bottom: 2px solid #0f0f0f;
            transform: rotate(-45deg);
          }
        `}</style>

        <div className="mx-auto max-w-5xl px-4 py-12 lg:grid lg:grid-cols-[280px_1fr] lg:gap-16 lg:py-20">

          {/* ── LEFT RAIL ─────────────────────────────────────────────────── */}
          <aside className="mb-10 lg:mb-0">
            <div className="lg:sticky lg:top-12">

              {/* Wordmark */}
              <div className="mb-10">
                <span
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: '0.75rem',
                    letterSpacing: '0.12em',
                    color: 'var(--accent)',
                    textTransform: 'uppercase',
                  }}
                >
                  HireRise
                </span>
                <h1
                  style={{
                    fontSize: '1.5rem',
                    fontWeight: 300,
                    lineHeight: 1.25,
                    marginTop: '0.5rem',
                    color: 'var(--text)',
                  }}
                >
                  Career
                  <br />
                  <span style={{ fontWeight: 600 }}>profile setup</span>
                </h1>
                <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  5 steps · takes ~3 minutes
                </p>
              </div>

              {/* Step rail */}
              <nav aria-label="Onboarding steps">
                <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {CAREER_STEPS.map((step, idx) => {
                    const isDone    = completedSteps.has(step.id);
                    const isCurrent = step.id === activeStep;
                    const isUpcoming = !isDone && !isCurrent;

                    return (
                      <li key={step.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', marginBottom: '1.25rem' }}>
                        {/* Connector line */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                          {/* Step circle */}
                          <div style={{
                            width: '1.75rem',
                            height: '1.75rem',
                            borderRadius: '50%',
                            border: `1.5px solid ${isDone ? 'var(--success)' : isCurrent ? 'var(--accent)' : 'var(--border-focus)'}`,
                            background: isDone ? 'var(--success)' : isCurrent ? 'var(--accent)' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            transition: 'all 0.2s',
                          }}>
                            {isDone ? (
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                                <path d="M2 6l3 3 5-5" stroke="#0f0f0f" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            ) : (
                              <span style={{
                                fontFamily: "'DM Mono', monospace",
                                fontSize: '0.65rem',
                                fontWeight: 500,
                                color: isCurrent ? '#0f0f0f' : 'var(--text-dim)',
                                lineHeight: 1,
                              }}>
                                {String(idx + 1).padStart(2, '0')}
                              </span>
                            )}
                          </div>
                          {/* Vertical connector (not after last) */}
                          {idx < CAREER_STEPS.length - 1 && (
                            <div style={{
                              width: '1px',
                              height: '1.5rem',
                              background: isDone ? 'var(--success)' : 'var(--border)',
                              marginTop: '0.25rem',
                              transition: 'background 0.3s',
                            }} />
                          )}
                        </div>

                        {/* Step label */}
                        <div style={{ paddingTop: '0.2rem' }}>
                          <p style={{
                            fontSize: '0.85rem',
                            fontWeight: isCurrent ? 500 : 400,
                            color: isDone ? 'var(--success)' : isCurrent ? 'var(--text)' : 'var(--text-muted)',
                            lineHeight: 1.3,
                            transition: 'color 0.2s',
                          }}>
                            {step.label}
                          </p>
                          <p style={{
                            fontSize: '0.725rem',
                            color: isUpcoming ? 'var(--text-dim)' : 'var(--text-muted)',
                            marginTop: '0.1rem',
                          }}>
                            {step.subtitle}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </nav>

              {/* Progress fraction */}
              <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace" }}>
                    {completedSteps.size} / {CAREER_STEPS.length - 1} steps
                  </span>
                  <span style={{ fontSize: '0.725rem', color: 'var(--accent-dim)', fontFamily: "'DM Mono', monospace" }}>
                    {Math.round((completedSteps.size / (CAREER_STEPS.length - 1)) * 100)}%
                  </span>
                </div>
                <div style={{ height: '2px', background: 'var(--border)', borderRadius: '1px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.round((completedSteps.size / (CAREER_STEPS.length - 1)) * 100)}%`,
                    background: 'var(--accent)',
                    borderRadius: '1px',
                    transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  }} />
                </div>
              </div>

              {/* Phase B.5 — Direction recovery affordance */}
              <SwitchDirectionButton
                onSwitch={switchDirection}
                isSwitching={isSwitching}
                variant="dark"
                label="Choose a different path"
              />

            </div>
          </aside>

          {/* ── RIGHT CONTENT ─────────────────────────────────────────────── */}
          <main>
            {/* Error banner */}
            {submitError && (
              <div style={{
                marginBottom: '1.5rem',
                padding: '0.875rem 1rem',
                background: 'rgba(239, 83, 80, 0.08)',
                border: '1px solid rgba(239, 83, 80, 0.25)',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                color: '#ef9090',
              }}>
                {submitError}
              </div>
            )}

            {/* Restored data notice */}
            {restoredData && completedSteps.size > 0 && (
              <div style={{
                marginBottom: '1.5rem',
                padding: '0.75rem 1rem',
                background: 'rgba(232, 213, 163, 0.06)',
                border: '1px solid rgba(232, 213, 163, 0.15)',
                borderRadius: '0.5rem',
                fontSize: '0.8rem',
                color: 'var(--accent-dim)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <span>↩</span>
                <span>Your progress has been restored. Continue from where you left off.</span>
              </div>
            )}

            {/* Active step panel */}
            <div className="step-enter" key={activeStep}>
              {activeStep === 'consent' && (
                <ConsentStep
                  onComplete={(data) => handleStepComplete('consent', data)}
                  isBusy={isBusy}
                />
              )}
              {activeStep === 'personal-details' && (
                <PersonalDetailsStep
                  onComplete={(data) => handleStepComplete('personal-details', data)}
                  isBusy={isBusy}
                  // Workflow accumulator ref — safe to read during render here.
                  // formDataRef is mutated by handleStepComplete before activeStep advances,
                  // so this step mounts only after the ref contains the latest merged data.
                  // initialData seeds this step's useState fields at mount time only.
                  // Replacing formDataRef with useState would trigger unnecessary page
                  // re-renders on every step save without improving correctness.
                  // React Compiler cannot statically verify the mutation-before-mount
                  // sequencing, but no stale read is possible at this call site.
                  // eslint-disable-next-line react-hooks/refs
                  initialData={formDataRef.current}
                />
              )}
              {activeStep === 'career-intent' && (
                <CareerIntentStep
                  onComplete={(data) => handleStepComplete('career-intent', data)}
                  isBusy={isBusy}
                  // Workflow accumulator ref — safe to read during render here.
                  // See PersonalDetailsStep above for full rationale.
                  // eslint-disable-next-line react-hooks/refs
                  initialData={formDataRef.current}
                />
              )}
              {activeStep === 'skills' && (
                <SkillsStep
                  onComplete={(data) => handleStepComplete('skills', data)}
                  isBusy={isBusy}
                  // Workflow accumulator ref — safe to read during render here.
                  // See PersonalDetailsStep above for full rationale.
                  // eslint-disable-next-line react-hooks/refs
                  initialData={formDataRef.current}
                />
              )}
              {activeStep === 'complete' && (
                <CompleteStep
                  userName={user.name}
                  onSubmit={(data) => handleStepComplete('complete', { ...formDataRef.current, ...data })}
                  isBusy={isSubmitting}
                />
              )}
            </div>
          </main>
        </div>
      </div>

      <QuotaExhaustedModal
        open={quotaModalOpen}
        upgradeUrl={upgradeUrl}
        onDismiss={() => setQuotaModalOpen(false)}
        message="Upgrade your plan to complete career profile setup and access all HireRise features."
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — CONSENT
// ─────────────────────────────────────────────────────────────────────────────

function ConsentStep({
  onComplete,
  isBusy,
}: {
  onComplete: (data: Record<string, unknown>) => Promise<void>;
  isBusy: boolean;
}) {
  const [dataConsent,    setDataConsent]    = useState(false);
  const [termsConsent,   setTermsConsent]   = useState(false);
  const [marketingOpt,   setMarketingOpt]   = useState(false);

  const canProceed = dataConsent && termsConsent;

  return (
    <StepWrapper
      stepNum="01"
      title="Before we begin"
      description="We take your privacy seriously. Here's a clear summary of how your data powers HireRise."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>

        {/* Data use card */}
        <div style={{
          padding: '1.25rem',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '0.75rem',
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
          lineHeight: 1.6,
        }}>
          <p style={{ fontWeight: 500, color: 'var(--text)', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
            What we use your data for
          </p>
          <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
            <li>Generating your personalised Career Health Index (CHI)</li>
            <li>Matching you to relevant roles and skill opportunities</li>
            <li>Powering AI-driven career recommendations</li>
          </ul>
          <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            Your data is never sold or shared with third parties without your consent.
          </p>
        </div>

        {/* Consent checkboxes */}
        <ConsentRow
          checked={dataConsent}
          onChange={setDataConsent}
          label="I consent to HireRise processing my career data to generate insights and recommendations."
          required
        />
        <ConsentRow
          checked={termsConsent}
          onChange={setTermsConsent}
          label={
            <>
              I agree to the{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-dim)', textDecoration: 'underline' }}>
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-dim)', textDecoration: 'underline' }}>
                Privacy Policy
              </a>.
            </>
          }
          required
        />
        <ConsentRow
          checked={marketingOpt}
          onChange={setMarketingOpt}
          label="Receive career insights, market reports, and product updates by email. (Optional)"
        />
      </div>

      <button
        className="primary-btn"
        disabled={!canProceed || isBusy}
        onClick={() => onComplete({ dataConsent, termsConsent, marketingOptIn: marketingOpt })}
      >
        {isBusy ? <Spinner /> : null}
        Continue
        <Arrow />
      </button>
    </StepWrapper>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — PERSONAL DETAILS
// ─────────────────────────────────────────────────────────────────────────────

const EXPERIENCE_OPTIONS = [
  { value: '0-1',   label: 'Less than 1 year' },
  { value: '1-3',   label: '1 – 3 years' },
  { value: '3-5',   label: '3 – 5 years' },
  { value: '5-10',  label: '5 – 10 years' },
  { value: '10-15', label: '10 – 15 years' },
  { value: '15+',   label: '15+ years' },
];

const INDUSTRY_OPTIONS = [
  'Technology', 'Finance & Banking', 'Healthcare', 'Consulting', 'E-commerce',
  'Media & Entertainment', 'Education', 'Government & Public Sector',
  'Manufacturing', 'Retail', 'Startups', 'Other',
];

function PersonalDetailsStep({
  onComplete,
  isBusy,
  initialData,
}: {
  onComplete: (data: Record<string, unknown>) => Promise<void>;
  isBusy: boolean;
  initialData: Record<string, unknown>;
}) {
  const [fullName,    setFullName]    = useState((initialData.fullName    as string) ?? '');
  const [currentRole, setCurrentRole] = useState((initialData.currentRole as string) ?? '');
  const [company,     setCompany]     = useState((initialData.company     as string) ?? '');
  const [experience,  setExperience]  = useState((initialData.experience  as string) ?? '');
  const [industry,    setIndustry]    = useState((initialData.industry    as string) ?? '');

  const canProceed = fullName.trim().length > 0 && currentRole.trim().length > 0 && experience !== '';

  return (
    <StepWrapper
      stepNum="02"
      title="Your professional background"
      description="Tell us where you are today so we can map where you're going."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
        <div className="field-group">
          <label htmlFor="fullName">Full name</label>
          <input
            id="fullName"
            type="text"
            placeholder="Alex Chen"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="field-group">
            <label htmlFor="currentRole">Current job title</label>
            <input
              id="currentRole"
              type="text"
              placeholder="Senior Engineer"
              value={currentRole}
              onChange={(e) => setCurrentRole(e.target.value)}
            />
          </div>
          <div className="field-group">
            <label htmlFor="company">Company (optional)</label>
            <input
              id="company"
              type="text"
              placeholder="Acme Corp"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="field-group">
            <label htmlFor="experience">Years of experience</label>
            <select
              id="experience"
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
            >
              <option value="">Select range</option>
              {EXPERIENCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label htmlFor="industry">Industry</label>
            <select
              id="industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            >
              <option value="">Select industry</option>
              {INDUSTRY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <button
        className="primary-btn"
        disabled={!canProceed || isBusy}
        onClick={() => onComplete({ fullName, currentRole, company, experience, industry })}
      >
        {isBusy ? <Spinner /> : null}
        Continue
        <Arrow />
      </button>
    </StepWrapper>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — CAREER INTENT
// ─────────────────────────────────────────────────────────────────────────────

const TIMELINE_OPTIONS = [
  { value: '3m',   label: 'Within 3 months' },
  { value: '6m',   label: '3 – 6 months' },
  { value: '1y',   label: '6 – 12 months' },
  { value: '2y',   label: '1 – 2 years' },
  { value: '2y+',  label: '2+ years' },
  { value: 'open', label: 'No specific timeline' },
];

const PRIORITY_OPTIONS = [
  'Higher compensation',
  'Career progression',
  'Better work-life balance',
  'Technical growth',
  'Leadership & management',
  'Remote / flexible work',
  'Industry change',
  'Company prestige',
  'Startup experience',
  'Impact & purpose',
];

function CareerIntentStep({
  onComplete,
  isBusy,
  initialData,
}: {
  onComplete: (data: Record<string, unknown>) => Promise<void>;
  isBusy: boolean;
  initialData: Record<string, unknown>;
}) {
  const [targetRole,   setTargetRole]   = useState((initialData.targetRole as string) ?? '');
  const [timeline,     setTimeline]     = useState((initialData.timeline   as string) ?? '');
  const [priorities,   setPriorities]   = useState<string[]>((initialData.priorities as string[]) ?? []);
  const [openToRemote, setOpenToRemote] = useState<boolean>((initialData.openToRemote as boolean) ?? false);

  const togglePriority = (p: string) => {
    setPriorities((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : prev.length < 3 ? [...prev, p] : prev,
    );
  };

  const canProceed = targetRole.trim().length > 0 && timeline !== '';

  return (
    <StepWrapper
      stepNum="03"
      title="Where you want to go"
      description="Your goals shape every recommendation HireRise makes. Be honest — there's no wrong answer."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
        <div className="field-group">
          <label htmlFor="targetRole">Target role or title</label>
          <input
            id="targetRole"
            type="text"
            placeholder="Engineering Manager, Staff Engineer, VP Product…"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
          />
        </div>
        <div className="field-group">
          <label htmlFor="timeline">Ideal timeline for next move</label>
          <select
            id="timeline"
            value={timeline}
            onChange={(e) => setTimeline(e.target.value)}
          >
            <option value="">Select timeline</option>
            {TIMELINE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Priority pills */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.75rem',
            fontWeight: 500,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            marginBottom: '0.75rem',
          }}>
            Top priorities{' '}
            <span style={{ color: 'var(--text-dim)', fontWeight: 400, textTransform: 'none', letterSpacing: 'normal' }}>
              — pick up to 3
            </span>
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {PRIORITY_OPTIONS.map((p) => (
              <button
                key={p}
                type="button"
                className={`skill-pill ${priorities.includes(p) ? 'selected' : ''}`}
                onClick={() => togglePriority(p)}
                aria-pressed={priorities.includes(p)}
              >
                {priorities.includes(p) && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                    <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Remote toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            role="switch"
            aria-checked={openToRemote}
            onClick={() => setOpenToRemote(!openToRemote)}
            style={{
              width: '2.5rem',
              height: '1.375rem',
              borderRadius: '999px',
              background: openToRemote ? 'var(--accent)' : 'var(--border-focus)',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background 0.2s',
              flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute',
              top: '2px',
              left: openToRemote ? 'calc(100% - 1.125rem - 2px)' : '2px',
              width: '1.125rem',
              height: '1.125rem',
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 0.2s',
            }} />
          </button>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Open to remote or hybrid opportunities
          </span>
        </div>
      </div>

      <button
        className="primary-btn"
        disabled={!canProceed || isBusy}
        onClick={() => onComplete({ targetRole, timeline, priorities, openToRemote })}
      >
        {isBusy ? <Spinner /> : null}
        Continue
        <Arrow />
      </button>
    </StepWrapper>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — SKILLS
// ─────────────────────────────────────────────────────────────────────────────

const SKILL_CATEGORIES: { label: string; skills: string[] }[] = [
  {
    label: 'Engineering',
    skills: ['Python', 'TypeScript', 'Java', 'Go', 'Rust', 'React', 'Node.js', 'AWS', 'Kubernetes', 'PostgreSQL', 'GraphQL', 'Machine Learning'],
  },
  {
    label: 'Product & Design',
    skills: ['Product Strategy', 'Roadmapping', 'User Research', 'Figma', 'A/B Testing', 'Data Analysis', 'Stakeholder Management'],
  },
  {
    label: 'Leadership & Business',
    skills: ['Team Leadership', 'Hiring & Recruiting', 'P&L Ownership', 'OKRs', 'Agile / Scrum', 'Business Development', 'Fundraising', 'Sales'],
  },
  {
    label: 'Finance & Operations',
    skills: ['Financial Modelling', 'SQL', 'Excel / Sheets', 'Forecasting', 'Operations', 'Project Management', 'Process Improvement'],
  },
];

function SkillsStep({
  onComplete,
  isBusy,
  initialData,
}: {
  onComplete: (data: Record<string, unknown>) => Promise<void>;
  isBusy: boolean;
  initialData: Record<string, unknown>;
}) {
  const [selectedSkills, setSelectedSkills] = useState<string[]>(
    (initialData.skills as string[]) ?? [],
  );
  const [customSkill, setCustomSkill] = useState('');

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill],
    );
  };

  const addCustomSkill = () => {
    const trimmed = customSkill.trim();
    if (trimmed && !selectedSkills.includes(trimmed)) {
      setSelectedSkills((prev) => [...prev, trimmed]);
      setCustomSkill('');
    }
  };

  const canProceed = selectedSkills.length >= 3;

  return (
    <StepWrapper
      stepNum="04"
      title="Your skills profile"
      description="Select skills you currently have — your CHI score is calibrated against market demand for these."
    >
      <div style={{ marginBottom: '2rem' }}>
        {SKILL_CATEGORIES.map((cat) => (
          <div key={cat.label} style={{ marginBottom: '1.5rem' }}>
            <p style={{
              fontSize: '0.725rem',
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              marginBottom: '0.625rem',
            }}>
              {cat.label}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
              {cat.skills.map((skill) => (
                <button
                  key={skill}
                  type="button"
                  className={`skill-pill ${selectedSkills.includes(skill) ? 'selected' : ''}`}
                  onClick={() => toggleSkill(skill)}
                  aria-pressed={selectedSkills.includes(skill)}
                >
                  {selectedSkills.includes(skill) && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                      <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  {skill}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Custom skill input */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <div className="field-group" style={{ flex: 1, marginBottom: 0 }}>
            <input
              type="text"
              placeholder="Add a skill not listed…"
              value={customSkill}
              onChange={(e) => setCustomSkill(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomSkill(); } }}
            />
          </div>
          <button
            type="button"
            onClick={addCustomSkill}
            disabled={!customSkill.trim()}
            style={{
              padding: '0.75rem 1rem',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: '0.5rem',
              color: 'var(--text-muted)',
              cursor: customSkill.trim() ? 'pointer' : 'not-allowed',
              fontSize: '0.875rem',
              transition: 'border-color 0.15s',
              flexShrink: 0,
            }}
          >
            Add
          </button>
        </div>

        {/* Selected count */}
        <p style={{
          marginTop: '1rem',
          fontSize: '0.8rem',
          color: canProceed ? 'var(--success)' : 'var(--text-muted)',
        }}>
          {selectedSkills.length} skill{selectedSkills.length !== 1 ? 's' : ''} selected
          {!canProceed && ' — select at least 3 to continue'}
        </p>
      </div>

      <button
        className="primary-btn"
        disabled={!canProceed || isBusy}
        onClick={() => onComplete({ skills: selectedSkills })}
      >
        {isBusy ? <Spinner /> : null}
        Continue
        <Arrow />
      </button>
    </StepWrapper>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5 — COMPLETE (TERMINAL SUBMIT)
// ─────────────────────────────────────────────────────────────────────────────

function CompleteStep({
  userName,
  onSubmit,
  isBusy,
}: {
  userName?: string;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  isBusy: boolean;
}) {
  return (
    <StepWrapper
      stepNum="05"
      title={userName ? `You're almost there, ${userName.split(' ')[0]}` : "You're almost there"}
      description="We have everything we need to generate your Career Health Index. This takes about 10–15 seconds."
    >
      {/* What happens next */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        marginBottom: '2rem',
      }}>
        {[
          { icon: '⚡', label: 'Career Health Index', desc: 'Your career readiness score benchmarked against the market' },
          { icon: '🎯', label: 'Skill gap analysis',  desc: 'Exact skills separating you from your target role' },
          { icon: '📈', label: 'Opportunity radar',   desc: 'Roles and companies matched to your profile right now' },
        ].map(({ icon, label, desc }) => (
          <div key={label} style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '1rem',
            padding: '1rem',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '0.75rem',
          }}>
            <span style={{ fontSize: '1.25rem', flexShrink: 0, lineHeight: 1.4 }}>{icon}</span>
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', marginBottom: '0.2rem' }}>{label}</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <button
        className="primary-btn"
        disabled={isBusy}
        onClick={() => onSubmit({ submittedAt: new Date().toISOString() })}
        style={{ width: '100%' }}
      >
        {isBusy ? (
          <>
            <Spinner />
            Generating your profile…
          </>
        ) : (
          <>
            Generate my Career Health Index
            <Arrow />
          </>
        )}
      </button>

      <p style={{ marginTop: '1rem', fontSize: '0.775rem', color: 'var(--text-dim)', textAlign: 'center' }}>
        You can refine your profile anytime from the dashboard.
      </p>
    </StepWrapper>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

function StepWrapper({
  stepNum,
  title,
  description,
  children,
}: {
  stepNum: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ maxWidth: '560px' }}>
      {/* Step meta */}
      <div style={{ marginBottom: '2rem' }}>
        <span style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: '0.7rem',
          letterSpacing: '0.1em',
          color: 'var(--accent-dim)',
          textTransform: 'uppercase',
        }}>
          Step {stepNum}
        </span>
        <h2 style={{
          fontSize: '1.6rem',
          fontWeight: 300,
          lineHeight: 1.25,
          marginTop: '0.4rem',
          marginBottom: '0.6rem',
          color: 'var(--text)',
        }}>
          {title}
        </h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          {description}
        </p>
      </div>
      {children}
    </div>
  );
}

function ConsentRow({
  checked,
  onChange,
  label,
  required,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.75rem',
      cursor: 'pointer',
      padding: '0.875rem',
      background: checked ? 'rgba(232, 213, 163, 0.04)' : 'transparent',
      border: `1px solid ${checked ? 'rgba(232, 213, 163, 0.2)' : 'var(--border)'}`,
      borderRadius: '0.5rem',
      transition: 'all 0.15s',
    }}>
      <input
        type="checkbox"
        className="consent-checkbox"
        checked={checked}
        required={required}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: '0.1rem' }}
      />
      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
        {label}
        {required && <span style={{ color: 'var(--accent-dim)', marginLeft: '0.25rem' }} aria-label="required">*</span>}
      </span>
    </label>
  );
}

function Arrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Spinner() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: '0.875rem',
        height: '0.875rem',
        border: '1.75px solid rgba(15,15,15,0.25)',
        borderTopColor: '#0f0f0f',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }}
      role="status"
      aria-label="Loading"
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}

function FullPageSpinner({ label }: { label: string }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f0f0f',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
      }}
    >
      <div
        style={{
          width: '2rem',
          height: '2rem',
          border: '2px solid rgba(232, 213, 163, 0.15)',
          borderTopColor: 'rgba(232, 213, 163, 0.7)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
        role="status"
        aria-label={label}
      >
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
      <p style={{ fontSize: '0.825rem', color: 'rgba(240, 237, 230, 0.4)', fontFamily: 'system-ui' }}>{label}</p>
    </div>
  );
}