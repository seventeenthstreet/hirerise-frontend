/**
 * @file src/features/onboarding/orchestration/resolvePostOnboardingDestination.ts
 * @description Pure function — determines where to send the user after onboarding completion.
 *
 * WHY EXTRACT THIS
 * ────────────────
 * The post-submit destination logic is currently duplicated across:
 *
 *   /onboarding/page.tsx:
 *     if (user_type === 'student') router.replace('/education/onboarding')
 *     else router.replace(resume_uploaded ? '/dashboard' : '/resume')
 *
 *   career/onboarding/page.tsx:
 *     router.push(updatedUser?.resume_uploaded ? '/dashboard' : '/resume')
 *
 * A future education/onboarding flow would add a third copy. Any change to
 * destination logic (e.g. adding a new user_type, changing the resume-gate
 * condition) must be applied to every copy manually.
 *
 * A pure function with an explicit input type makes the routing contract
 * testable in isolation, visible to TypeScript, and single-source-of-truth.
 *
 * IMPORTANT: No routing logic is CHANGED here — this is extraction of existing
 * behavior into a shared location. The TypeScript return type makes the
 * complete set of possible destinations explicit and auditable.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All possible post-onboarding destinations.
 * Exhaustive union — adding a new route requires updating this type
 * and the function body, making omissions a TypeScript error.
 */
export type OnboardingDestination =
  | '/dashboard'
  | '/resume'
  | '/education/onboarding';

/**
 * Minimal user shape needed for destination resolution.
 * Does not require the full User type — callers can pass any object
 * that satisfies this shape, including the value returned by refreshUser().
 */
export interface PostOnboardingUser {
  user_type?: string | null;
  resume_uploaded?: boolean | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the post-onboarding navigation destination from user state.
 *
 * Decision tree (mirrors existing page-level logic exactly):
 *   student user_type       → /education/onboarding (education-specific flow)
 *   professional + resume   → /dashboard (full experience)
 *   professional + no resume → /resume (upload gate)
 *   unknown user_type       → /resume (safe fallback)
 *
 * Pure function — no side-effects, no React, no router access.
 * Safe to call in tests, in hooks, or in page handlers.
 *
 * @param user - Minimal user shape (typically the value returned by refreshUser())
 * @returns The canonical destination path
 */
export function resolvePostOnboardingDestination(
  user: PostOnboardingUser | null | undefined,
): OnboardingDestination {
  if (!user) {
    // Safety: if refreshUser() returned null (unexpected), default to /resume
    // rather than throwing. The resume page will re-check auth state.
    return '/resume';
  }

  if (user.user_type === 'student') {
    return '/education/onboarding';
  }

  // professional (or unknown user_type) — gate on resume upload
  return user.resume_uploaded ? '/dashboard' : '/resume';
}