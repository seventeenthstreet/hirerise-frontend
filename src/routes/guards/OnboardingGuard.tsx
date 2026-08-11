/**
 * src/routes/guards/OnboardingGuard.tsx
 *
 * ONBOARDING STEP GUARD — prevents deep-link skipping within the
 * student onboarding sub-flow.
 *
 * FIX-04 (HIGH): Previously a stub that rendered children unconditionally,
 * regardless of `requiredStep`. Any authenticated user could navigate
 * directly to a later onboarding step (e.g. /onboarding/student/intelligence)
 * without having completed earlier steps.
 *
 * WP-ENTRY-01 (P0): This guard is the entry point for /onboarding/profile,
 * /onboarding/student/*, and /onboarding/career — but it never checked
 * whether the user had selected a direction at all. AuthGuard (the parent
 * route wrapper) only checks authentication, not direction. AppEntryPage's
 * direction gate ("/") only fires when the user actually lands on "/" —
 * a brand-new, undirected user who deep-links (bookmark, back button,
 * stale link) straight to e.g. /onboarding/student/academics bypassed
 * Direction Selection entirely and landed directly in Student Onboarding.
 *
 * FIX: reuse the existing, already-canonical requireDirection() guard
 * (lib/guards.ts) as gate 0, before the completion/step-order gates below.
 *
 * AppContext / `/users/me` does not currently expose a granular
 * step-by-step cursor (e.g. `student_onboarding_step`) — only coarse
 * completion flags:
 *   - user.student_onboarding_complete
 *   - user.professional_onboarding_complete
 *   - user.onboarding_completed
 *
 * Given that, this guard enforces the checks that ARE possible with
 * the current backend contract, without inventing fields that don't exist:
 *
 *  0. DIRECTION GATE (WP-ENTRY-01)
 *     - No direction selected (user.user_type is null) → /direction.
 *
 *  1. AUTHENTICATION GATE
 *     - Not authenticated → /auth/login (mirrors AuthGuard).
 *
 *  2. COMPLETION GATE (anti-loop)
 *     - If the relevant onboarding flow is ALREADY complete
 *       (student_onboarding_complete / professional_onboarding_complete /
 *       onboarding_completed), further onboarding steps are redirected to
 *       `/dashboard` — a user who has finished onboarding should not be
 *       able to re-enter the step flow via a stale bookmark/back button.
 *
 * STEP-ORDER GATE (best-effort, extensible):
 *   `requiredStep` documents the intended position of each step in the
 *   student sub-flow (`profile` → `academics` → `activities` → `cognitive`
 *   → `intelligence`). The guard reads an optional
 *   `user.student_onboarding_step` field (if/when the backend adds one) and,
 *   if present, redirects to the correct in-progress step when a user tries
 *   to jump ahead. If the field is absent (current backend state), this
 *   gate is skipped — the guard still provides the auth + completion gates
 *   above, and step-order enforcement activates automatically the moment
 *   the backend starts returning `student_onboarding_step`.
 *
 * Loading state: while AppContext is hydrating, shows PageLoading — never
 * flashes a step the user shouldn't see.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/context/AppContext';
import { requireDirection } from '@/lib/guards';
import { PageLoading } from '@/components/ui';

// Canonical order of the student onboarding sub-flow. Used only for the
// optional step-order gate (see STEP-ORDER GATE above).
const STUDENT_STEP_ORDER = [
  'welcome',
  'profile',
  'academics',
  'activities',
  'cognitive',
  'intelligence',
] as const;

export type OnboardingStep = (typeof STUDENT_STEP_ORDER)[number];

const STEP_ROUTES: Record<OnboardingStep, string> = {
  welcome:      '/onboarding',
  profile:      '/onboarding/profile',
  academics:    '/onboarding/student/academics',
  activities:   '/onboarding/student/activities',
  cognitive:    '/onboarding/student/cognitive',
  intelligence: '/onboarding/student/intelligence',
};

interface OnboardingGuardProps {
  children: React.ReactNode;
  /**
   * The step this route represents in the student onboarding sub-flow.
   * Used for the best-effort step-order gate (see file header).
   */
  requiredStep?: OnboardingStep;
}

export default function OnboardingGuard({ children, requiredStep }: OnboardingGuardProps) {
  const navigate = useNavigate();
  const { isHydrated, isError, user } = useAppContext();

  useEffect(() => {
    if (!isHydrated) return;

    // WP-AV-02E — Log: beginning of guard.
    console.log("[Guard] OnboardingGuard", {
      user_type: user?.user_type,
      onboarding_completed: user?.onboarding_completed,
      professional_onboarding_complete: user?.professional_onboarding_complete,
      student_onboarding_complete: user?.student_onboarding_complete,
    });

    // ── 1. Authentication gate ──────────────────────────────────────────
    if (isError || !user) {
      // WP-AV-02E — Log: immediately before redirecting.
      console.log("[Guard Redirect]", '/auth/login');
      console.log("[Navigation]", '/auth/login');
      navigate('/auth/login', { replace: true });
      return;
    }

    // ── 0. Direction gate (WP-ENTRY-01) ─────────────────────────────────
    // Must run before the completion gate below: a user with no direction
    // has user_type === null, and the completion gate's fallback branch
    // (professional_onboarding_complete || onboarding_completed) evaluates
    // to a falsy "not complete" for such a user — which would otherwise
    // fall through to rendering the guarded step instead of redirecting.
    const directionGuard = requireDirection(user);
    if (!directionGuard.allowed) {
      // WP-AV-02E — Log: immediately before redirecting.
      console.log("[Guard Redirect]", directionGuard.redirectTo);
      console.log("[Navigation]", directionGuard.redirectTo);
      navigate(directionGuard.redirectTo, { replace: true });
      return;
    }

    // ── 2. Completion gate ──────────────────────────────────────────────
    const onboardingAlreadyComplete =
      user.user_type === 'student'
        ? user.student_onboarding_complete
        : user.professional_onboarding_complete || user.onboarding_completed;

    if (onboardingAlreadyComplete) {
      // WP-AV-02E — Log: immediately before redirecting.
      console.log("[Guard Redirect]", '/dashboard');
      console.log("[Navigation]", '/dashboard');
      navigate('/dashboard', { replace: true });
      return;
    }

    // ── 3. Step-order gate (best-effort) ────────────────────────────────
    // Only applies if requiredStep is provided AND the backend exposes a
    // step cursor. If `student_onboarding_step` is not present on `user`,
    // this block is skipped entirely — no behavioural change from before
    // beyond the auth/completion gates above.
    if (requiredStep) {
      const currentStep = (user as { student_onboarding_step?: OnboardingStep })
        .student_onboarding_step;

      if (currentStep && STUDENT_STEP_ORDER.includes(currentStep)) {
        const requiredIndex = STUDENT_STEP_ORDER.indexOf(requiredStep);
        const currentIndex  = STUDENT_STEP_ORDER.indexOf(currentStep);

        // The user has not yet reached the step immediately before this one
        // → they are trying to skip ahead. Send them to their actual
        // current step instead.
        if (currentIndex < requiredIndex - 1) {
          navigate(STEP_ROUTES[currentStep] ?? '/onboarding', { replace: true });
          return;
        }
      }
    }
  }, [isHydrated, isError, user, requiredStep, navigate]);

  // While hydrating — show spinner, never flash a step the user shouldn't see.
  if (!isHydrated) {
    return <PageLoading label="Loading HireRise…" />;
  }

  // Redirect is in progress — render nothing to prevent flash.
  if (isError || !user) {
    return null;
  }

  // Mirrors the direction gate above — render nothing while that redirect
  // is in flight either.
  if (!requireDirection(user).allowed) {
    return null;
  }

  const onboardingAlreadyComplete =
    user.user_type === 'student'
      ? user.student_onboarding_complete
      : user.professional_onboarding_complete || user.onboarding_completed;

  if (onboardingAlreadyComplete) {
    return null;
  }

  if (requiredStep) {
    const currentStep = (user as { student_onboarding_step?: OnboardingStep })
      .student_onboarding_step;

    if (currentStep && STUDENT_STEP_ORDER.includes(currentStep)) {
      const requiredIndex = STUDENT_STEP_ORDER.indexOf(requiredStep);
      const currentIndex  = STUDENT_STEP_ORDER.indexOf(currentStep);

      if (currentIndex < requiredIndex - 1) {
        return null;
      }
    }
  }

  return <>{children}</>;
}