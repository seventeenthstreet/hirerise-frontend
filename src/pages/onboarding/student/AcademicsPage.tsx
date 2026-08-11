/**
 * @file app/(auth)/education/onboarding/page.tsx  [PHASE 2 PATCH]
 *
 * STUDENT ONBOARDING PAGE — Phase 2 Patched Version
 * ══════════════════════════════════════════════════
 *
 * DROP-IN REPLACEMENT for the existing /education/onboarding/page.tsx.
 *
 * WHAT CHANGED FROM THE ORIGINAL:
 *
 *   1. PROCESSING DEADLOCK FIX (CRITICAL)
 *      Original: OnboardingStepRenderer renders SystemStepPlaceholder for
 *      'processing' step — an infinite spinner with no escape.
 *
 *      Fix: StepRouter intercepts 'processing' and renders SafeProcessingStep,
 *      which shows the animation for 10s then falls back to an informational
 *      "Analysis queued" screen. No permanent spinners.
 *
 *   2. UNIMPLEMENTED STEP SAFETY
 *      Original: academics/activities/cognitive/aspiration render their stub
 *      components (empty or placeholder) with no escape path.
 *
 *      Fix: StepRouter renders TemporaryStepPlaceholder for all PHASE2_UNIMPLEMENTED_STEPS,
 *      giving users a clear "coming soon" message instead of a dead-end.
 *
 *   3. ORCHESTRATION HOOK
 *      Original: orchestration logic inline in the page (mutation dispatch,
 *      progress derivation, error handling).
 *
 *      Fix: delegated to useStudentOnboardingFlow + useResumeOnboarding.
 *      Page is now thin — renders shell and router only.
 *
 *   4. RESUME DETECTION
 *      Original: no resume banner, no stale session warning.
 *
 *      Fix: useResumeOnboarding detects mid-flow sessions and stale sessions.
 *      Shell renders a resume banner when appropriate.
 *
 * WHAT DID NOT CHANGE:
 *   - All session/mutation hooks (use-student-onboarding-session, etc.)
 *   - API layer (studentOnboardingApi)
 *   - Query keys (studentOnboardingQueryKeys)
 *   - Education step component (EducationStep)
 *   - Step registry (STEP_REGISTRY, STUDENT_ONBOARDING_STEPS)
 *   - Auth guards (hydration, user type, completion)
 *
 * BUG FIX — Infinite redirect loop between /dashboard ↔ /education/onboarding
 * ─────────────────────────────────────────────────────────────────────────────
 * ROOT CAUSE:
 *   When the student's onboarding session completes (session.isComplete = true),
 *   the page called navigate('/dashboard', { replace: true }) immediately. However, the User
 *   object in AppContext still had student_onboarding_complete = false (stale
 *   cached value). The dashboard's applyPageGuards() saw this stale flag, called
 *   requireOnboardingComplete(), and bounced the user BACK to /education/onboarding.
 *   That page saw session.isComplete, redirected to /dashboard again → infinite loop.
 *
 * FIX:
 *   Before navigating to /dashboard on completion, call refreshUser() to fetch
 *   the latest User from the backend. The backend sets student_onboarding_complete
 *   = true upon session completion, so after refreshUser() the guard passes and
 *   the dashboard renders correctly.
 *
 *   A redirecting ref prevents duplicate calls if the effect fires more than once.
 *   refreshUser() is race-safe (Promise-deduped in AppContext) — concurrent calls
 *   share the same in-flight fetch.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/context/AppContext';
import { PageLoading } from '@/components/ui';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useResetDirection } from '@/hooks/mutations';
import {
  useStudentOnboardingFlow,
  useResumeOnboarding,
} from '@/features/student-onboarding/hooks';
import { StudentOnboardingShell } from '@/components/student-onboarding/shell/StudentOnboardingShell';
import { StepRouter } from '@/components/student-onboarding/steps/StepRouter';

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE SHELL — Guards only
// ─────────────────────────────────────────────────────────────────────────────

export default function EducationOnboardingPage() {
  const { user, isHydrated } = useAppContext();

  if (!isHydrated) {
    return <PageLoading label="Loading…" />;
  }

  if (!user) {
    return null; // layout handles redirect to /login
  }

  if (user.user_type !== 'student') {
    return null; // wrong user type — layout guard handles redirect
  }

  if (user.student_onboarding_complete || user.onboarding_completed) {
    return <CompletionRedirect />;
  }

  return <StudentOnboardingContent />;
}

function CompletionRedirect() {
  const navigate = useNavigate();
  const hasRedirected = useRef(false);
  useEffect(() => {
    if (!hasRedirected.current) {
      hasRedirected.current = true;
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);
  return <PageLoading label="Loading your dashboard…" />;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT — Phase 2 thin orchestration
// ─────────────────────────────────────────────────────────────────────────────

function StudentOnboardingContent() {
  const navigate = useNavigate();
  const { refreshUser } = useAppContext();

  // Single orchestration hook — replaces inline mutation/progress/dispatch logic
  const flow = useStudentOnboardingFlow();

  // Resume detection — adds resume banner and stale session warning to shell
  const resume = useResumeOnboarding(flow.session);

  // ── Escape hatch: change direction ────────────────────────────────────────
  // Mirrors OnboardingContent's (professional flow) handleChangeDirection.
  // Without this, a student who picked 'student' by mistake at /direction has
  // no way back — AppEntryPage routes user_type='student' straight here on
  // every login, and this page has no exit other than finishing the flow.
  // DELETE /me/direction clears user_type + user_direction; refreshUser()
  // pulls the cleared value into AppContext before navigating, so the
  // /direction guard doesn't see a stale cached user_type and bounce back.
  const resetDirectionMutation = useResetDirection();

  const handleChangeDirection = useCallback(async () => {
    try {
      await resetDirectionMutation.mutateAsync();
      await refreshUser();
      navigate('/direction', { replace: true });
    } catch {
      // Non-blocking: user stays on the page and can retry.
    }
  }, [resetDirectionMutation, refreshUser, navigate]);

  // ── Escape hatch: log out ─────────────────────────────────────────────────
  // Mirrors DirectionPage's handleLogout — same sign-out call, same redirect.
  const handleLogout = useCallback(async () => {
    await getSupabaseClient().auth.signOut();
    navigate('/auth/login', { replace: true });
  }, [navigate]);

  // FIX: refresh the User record BEFORE navigating to /dashboard.
  //
  // WHY THIS IS NEEDED:
  //   When onboarding completes, the backend marks the session is_complete = true
  //   AND sets student_onboarding_complete = true on the users row. However,
  //   AppContext's cached User object still has student_onboarding_complete = false
  //   (the value from the last /users/me fetch, before onboarding finished).
  //
  //   Without this refresh, the sequence was:
  //     1. session.isComplete becomes true → navigate('/dashboard', { replace: true })
  //     2. Dashboard calls applyPageGuards(user) → requireOnboardingComplete(user)
  //     3. user.student_onboarding_complete is still false (stale cache)
  //     4. Guard blocks → navigate('/education/onboarding', { replace: true })
  //     5. Onboarding sees session.isComplete → navigate('/dashboard', { replace: true })
  //     6. → infinite redirect loop (visible as alternating dashboard ↔ onboarding
  //          GETs in the server log at ~40–100ms each)
  //
  //   With this fix:
  //     1. session.isComplete becomes true → refreshUser() fetches fresh /users/me
  //     2. AppContext updates user with student_onboarding_complete = true
  //     3. navigate('/dashboard', { replace: true })
  //     4. Guard sees student_onboarding_complete = true → passes → dashboard renders
  //
  //   refreshUser() is race-safe (Promise-deduped inside AppContext) and idempotent.
  //   The redirectingRef prevents duplicate calls if the effect re-fires.
  const redirectingRef = useRef(false);
  const handleCompletionRedirect = useCallback(async () => {
    if (redirectingRef.current) return;
    redirectingRef.current = true;
    await refreshUser();
    navigate('/dashboard', { replace: true });
  }, [refreshUser, navigate]);

  useEffect(() => {
    if (resume.isComplete) {
      void handleCompletionRedirect();
    }
  }, [resume.isComplete, handleCompletionRedirect]);

  return (
    // Shell: handles layout, loading, error, progress, resume banner
    <StudentOnboardingShell
      flow={flow}
      resume={resume}
      onChangeDirection={handleChangeDirection}
      isResettingDirection={resetDirectionMutation.isPending}
      onLogout={handleLogout}
    >
      {/*
        StepRouter: backend-driven step dispatch.
        - 'processing' → SafeProcessingStep (no deadlock)
        - unimplemented steps → TemporaryStepPlaceholder (no dead-end)
        - 'education', 'result' → OnboardingStepRenderer (registry)
      */}
      <StepRouter flow={flow} />
    </StudentOnboardingShell>
  );
}