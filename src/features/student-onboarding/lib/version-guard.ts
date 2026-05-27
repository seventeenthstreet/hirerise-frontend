/**
 * @file features/student-onboarding/lib/version-guard.ts
 *
 * SESSION VERSION GUARD
 * ──────────────────────
 * Centralised version compatibility layer for the student onboarding frontend.
 *
 * PROBLEM THIS SOLVES:
 *   Future deployments may introduce new onboarding steps, changed session
 *   schemas, or updated orchestration logic.  Without protection, an old
 *   frontend served from browser cache can receive a new backend session
 *   (or vice-versa) and fail silently — StepRouter enters invalid states,
 *   recovery may not fire, and users are left with a broken experience.
 *
 * DESIGN RULES:
 *   ✅ Single source of truth — all version logic lives here
 *   ✅ Never inline version checks in components or hooks
 *   ✅ Additive only — never remove from SUPPORTED_ONBOARDING_VERSIONS
 *   ✅ Version check must run BEFORE polling, routing, and processing
 *
 * FUTURE UPGRADE PATH:
 *   When a new engine version ships:
 *     1. Add the new version string to SUPPORTED_ONBOARDING_VERSIONS
 *     2. Add a migration note in VERSION_MIGRATION_NOTES
 *     3. Deploy — no other changes required here
 *
 * @see onboarding-hardening.types.ts  — VersionMismatchRecovery type
 * @see use-student-onboarding-flow.ts — integration point
 */

// ─────────────────────────────────────────────────────────────────────────────
// VERSION REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The set of engine_version values this frontend build can safely handle.
 *
 * RULE: Only APPEND to this array — never remove or reorder entries.
 *       Removing a version causes regressions for users with sessions created
 *       on that version (e.g. cached sessions, mid-flow users after deploy).
 *
 * VERSIONING CONTRACT:
 *   Versions follow semver.  A frontend build supports a version if it
 *   understands the full session schema and step set for that version.
 *   A minor-version bump (1.0.0 → 1.1.0) MUST be backwards-compatible;
 *   a major-version bump (1.x → 2.0.0) requires a new entry here AND a
 *   coordinated deploy with the backend team.
 *
 * @contract Update when backend engine_version constants change.
 *           File: src/modules/student-onboarding/constants/index.js → ENGINE_VERSION
 */
export const SUPPORTED_ONBOARDING_VERSIONS = ['1.0.0'] as const;

export type SupportedOnboardingVersion = (typeof SUPPORTED_ONBOARDING_VERSIONS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// MIGRATION NOTES (documentation only — not runtime)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Human-readable notes for each version.
 * Used in the VersionMismatchScreen and internal documentation.
 *
 * @non-runtime This object is never executed at runtime — it exists for
 *              developer reference only.  Tree-shaken in production builds.
 */
export const VERSION_MIGRATION_NOTES: Record<string, string> = {
  '1.0.0': 'Initial student onboarding session schema. Steps: education → academics → activities → cognitive → aspiration → processing → result.',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// COMPATIBILITY HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true when the provided version string is in the supported registry.
 *
 * This is the ONLY place version compatibility logic lives.
 * Do not replicate this check inline in hooks, components, or pages.
 *
 * @param version — The engine_version string from the backend session.
 *                  Falsy values (undefined, null, '') are treated as incompatible.
 *
 * @example
 * const ok = isSupportedSessionVersion(session.engineVersion);
 * if (!ok) {
 *   // halt onboarding, render VersionMismatchScreen
 * }
 */
export function isSupportedSessionVersion(version: string | null | undefined): boolean {
  if (!version) return false;
  return (SUPPORTED_ONBOARDING_VERSIONS as readonly string[]).includes(version);
}

// ─────────────────────────────────────────────────────────────────────────────
// VERSION MISMATCH DETAIL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Structured information about a detected version mismatch.
 * Passed to VersionMismatchScreen and logOnboardingEvent.
 */
export interface VersionMismatchDetail {
  /** The version returned by the backend session. */
  readonly receivedVersion: string | null | undefined;
  /** The versions this frontend build supports. */
  readonly supportedVersions: readonly string[];
  /** ISO timestamp when the mismatch was detected. */
  readonly detectedAt: string;
}

/**
 * Builds a VersionMismatchDetail from a session's engine version.
 * Call this ONCE when the mismatch is detected; pass the result downstream.
 */
export function buildVersionMismatchDetail(
  receivedVersion: string | null | undefined,
): VersionMismatchDetail {
  return {
    receivedVersion,
    supportedVersions: SUPPORTED_ONBOARDING_VERSIONS,
    detectedAt: new Date().toISOString(),
  };
}
