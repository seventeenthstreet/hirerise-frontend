/**
 * @file lib/guards.ts
 * @description Pure route-guard functions for the HireRise frontend.
 *
 * Each guard:
 *  - Accepts a User object (from useUser)
 *  - Returns { allowed: true } OR { allowed: false, redirectTo: string }
 *  - Has NO side-effects — pages own the redirect call
 *
 * ARCHITECTURE: Guards sit in the lib layer. Pages call them inside a
 * useEffect after user loads. This keeps routing logic out of hooks and
 * components, and keeps it in ONE place so it can't drift.
 *
 * Usage in a page:
 *   const guard = requireOnboardingComplete(user);
 *   if (!guard.allowed) { router.replace(guard.redirectTo); return; }
 */

import type { User } from '@/hooks/useUser';

// ─────────────────────────────────────────────────────────────────────────────
// RESULT TYPE
// ─────────────────────────────────────────────────────────────────────────────

export type GuardAllowed   = { allowed: true };
export type GuardBlocked   = { allowed: false; redirectTo: string };
export type GuardResult    = GuardAllowed | GuardBlocked;

function allow(): GuardAllowed                     { return { allowed: true }; }
function block(redirectTo: string): GuardBlocked   { return { allowed: false, redirectTo }; }

// ─────────────────────────────────────────────────────────────────────────────
// GUARD 1 — requireDirection
// User must have chosen a direction (user_type) before accessing guarded pages.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Blocks access if the user has not selected a direction (user_type).
 * Redirects to /direction so they can choose student | professional | market.
 */
export function requireDirection(user: User | null): GuardResult {
  if (!user?.user_type) {
    return block('/direction');
  }
  return allow();
}

// ─────────────────────────────────────────────────────────────────────────────
// GUARD 2 — requireOnboardingComplete
// User must have completed onboarding appropriate to their user_type.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Blocks access if onboarding is not complete for the user's direction.
 *
 * Logic:
 *  - No direction set               → /direction (safety net; direction guard fires first)
 *  - student  + not complete        → /education/onboarding (new student onboarding flow)
 *  - professional + not complete    → /onboarding (legacy professional flow)
 *  - any + onboarding_completed     → allowed (generic completion flag; canonical on backend)
 *
 * FIX (2026-05-19):
 *   Students were previously routed to /onboarding (the legacy professional flow)
 *   which uses useOnboarding() + OnboardingSteps, calls /api/v1/onboarding, and
 *   returns 0 steps for student accounts → rendered "0 of 0 steps" / "No onboarding
 *   steps found." Students must route to /education/onboarding which uses the new
 *   student-onboarding module (Supabase-backed, registry-driven, EducationStep-first).
 */
export function requireOnboardingComplete(user: User | null): GuardResult {
  if (!user?.user_type) {
    return block('/direction');
  }

  // Generic flag takes priority — backend sets this on completion for all types
  if (user.onboarding_completed) {
    return allow();
  }

  if (user.user_type === 'student' && !user.student_onboarding_complete) {
    // Route students to the new student-onboarding module, NOT the legacy /onboarding
    return block('/education/onboarding');
  }

  if (
    user.user_type === 'professional' &&
    !user.professional_onboarding_complete
  ) {
    return block('/onboarding');
  }

  // market users don't have a dedicated onboarding flow yet
  return allow();
}

// ─────────────────────────────────────────────────────────────────────────────
// GUARD 3 — requireResume
// Professional users must have an active resume before accessing the dashboard.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Blocks access if the user is a professional without an uploaded resume.
 * Students and market users are not gated by this guard.
 */
export function requireResume(user: User | null): GuardResult {
  if (!user) return block('/resume');

  // Only professionals are gated on resume upload
  if (user.user_type === 'professional' && !user.resume_uploaded) {
    return block('/resume');
  }

  return allow();
}

// ─────────────────────────────────────────────────────────────────────────────
// GUARD 4 — requireCHIReady
// CHI score requires three prerequisites: resume uploaded, skills, target role.
// This guard does NOT redirect — it returns a diagnostic object instead.
// Pages use it to show actionable CTAs instead of empty/broken widgets.
// ─────────────────────────────────────────────────────────────────────────────

export interface CHIReadinessResult {
  allowed: boolean;
  missing: Array<'resume' | 'skills' | 'targetRole'>;
}

/**
 * Returns which CHI prerequisites are missing.
 * Pages must NOT render CHI widgets when `allowed` is false.
 * Instead show actionable prompts for each item in `missing`.
 *
 * @param user          - User object from useUser
 * @param hasSkills     - Resolved from dashboard data (not stored on user row)
 * @param hasTargetRole - Resolved from dashboard data (not stored on user row)
 */
export function requireCHIReady(
  user: User | null,
  hasSkills: boolean,
  hasTargetRole: boolean,
): CHIReadinessResult {
  const missing: CHIReadinessResult['missing'] = [];

  if (!user?.resume_uploaded) missing.push('resume');
  if (!hasSkills)             missing.push('skills');
  if (!hasTargetRole)         missing.push('targetRole');

  return {
    allowed: missing.length === 0,
    missing,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — getCHIMissingRequirements
// Convenience wrapper that matches the blueprint spec signature exactly.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a structured object listing which CHI prerequisites are absent.
 *
 * Example output:
 *   { missing: ['resume', 'skills'] }
 *   { missing: [] }  ← CHI is ready
 */
export function getCHIMissingRequirements(
  user: User | null,
  hasSkills: boolean,
  hasTargetRole: boolean,
): { missing: Array<'resume' | 'skills' | 'targetRole'> } {
  const { missing } = requireCHIReady(user, hasSkills, hasTargetRole);
  return { missing };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSITE — applyPageGuards
// Runs direction → onboarding → resume guards in order.
// Returns the first block encountered, or allow if all pass.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs the standard page guard chain in priority order:
 *   requireDirection → requireOnboardingComplete → requireResume
 *
 * Short-circuits on the first failed guard so pages get a single redirect
 * target rather than having to chain guards manually.
 *
 * @param user        - User object (null = not yet loaded, don't call until ready)
 * @param needsResume - Pass `true` for pages that require a resume (dashboard)
 */
export function applyPageGuards(
  user: User | null,
  needsResume = false,
): GuardResult {
  const directionGuard = requireDirection(user);
  if (!directionGuard.allowed) return directionGuard;

  const onboardingGuard = requireOnboardingComplete(user);
  if (!onboardingGuard.allowed) return onboardingGuard;

  if (needsResume) {
    const resumeGuard = requireResume(user);
    if (!resumeGuard.allowed) return resumeGuard;
  }

  return allow();
}