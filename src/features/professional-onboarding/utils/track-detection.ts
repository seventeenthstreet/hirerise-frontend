/**
 * @file src/features/professional-onboarding/utils/track-detection.ts
 *
 * WP-PRO-09C — Frontend Foundation & API Integration Implementation
 *
 * Track-detection utilities.
 *
 * WHY THIS EXISTS:
 *   `GET /api/v1/onboarding/progress` never returns which track the user is
 *   on (verified against onboarding.analytics.service.js#getProgress — the
 *   response has no `track` field, even though the Definition Engine
 *   computes one internally via its own `detectTrack()`). The frontend must
 *   independently infer the track from which `stepId`s appear in `steps[]`
 *   in order to know which step registry (guided builder vs resume upload)
 *   to resolve `currentStep` against.
 *
 * SCOPE (frozen backend — do not redesign):
 *   This module ONLY infers DISPLAY behaviour (which registry / screen to
 *   show). It must never be used to gate completion, validate a step, or
 *   make any decision the backend is authoritative for. All business rules
 *   remain server-side in the Definition Engine.
 *
 * The step-id groupings below are copied verbatim from the frozen backend
 * catalog (professional-onboarding.definition.js TRACK_STEPS) and must be
 * kept in sync with it if the backend catalog ever changes.
 */

import type { OnboardingTrack, ProfessionalOnboardingStep } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// STEP-ID GROUPINGS  (display inference only — copied from frozen backend catalog)
// ─────────────────────────────────────────────────────────────────────────────

const GUIDED_BUILDER_STEP_PREFIX = 'guided_';

const RESUME_UPLOAD_STEP_IDS: ReadonlySet<string> = new Set([
  'upload_resume',
  'ai_resume_parsing',
  'profile_review',
]);

/**
 * Step ids belonging to the pre-existing "legacy manual" onboarding path
 * (education_experience / career_intent, etc. — a track that predates the
 * Guided Builder and Resume Upload tracks introduced by WP-PRO-08/09). This
 * grouping exists purely so `inferOnboardingTrack` can distinguish "user is
 * on a track this module doesn't own" from "user hasn't chosen a track yet",
 * without this module needing to understand the legacy track's full step
 * catalog. It is intentionally conservative: only step ids that are known
 * NOT to belong to the guided/resume tracks and NOT to be universal/shared
 * steps are treated as legacy-manual.
 */
const KNOWN_UNIVERSAL_OR_SHARED_STEP_IDS: ReadonlySet<string> = new Set([
  'consent',
  'method_choice',
  'career_report',
  'cv_generation',
]);

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Infers which onboarding track a user is on from the Progress API's
 * `steps[]`, for DISPLAY purposes only (selecting which step registry to
 * resolve `currentStep` against). Returns `null` when no track-specific step
 * is present yet (i.e. the user is still at the `method_choice` stage, or
 * `steps[]` is empty).
 *
 * This function never throws and never returns anything other than the
 * four documented values — an unrecognised or empty `steps[]` safely
 * resolves to `null`, not an error.
 *
 * @example
 * const track = inferOnboardingTrack(progress.steps);
 * const registry = track === 'guided_builder'
 *   ? GUIDED_BUILDER_STEP_REGISTRY
 *   : track === 'resume_upload'
 *     ? RESUME_UPLOAD_STEP_REGISTRY
 *     : undefined;
 */
export function inferOnboardingTrack(
  steps: readonly ProfessionalOnboardingStep[] | null | undefined,
): OnboardingTrack {
  if (!steps || steps.length === 0) return null;

  if (steps.some((s) => s.stepId.startsWith(GUIDED_BUILDER_STEP_PREFIX))) {
    return 'guided_builder';
  }

  if (steps.some((s) => RESUME_UPLOAD_STEP_IDS.has(s.stepId))) {
    return 'resume_upload';
  }

  const hasOnlyUniversalOrSharedSteps = steps.every((s) =>
    KNOWN_UNIVERSAL_OR_SHARED_STEP_IDS.has(s.stepId),
  );
  if (hasOnlyUniversalOrSharedSteps) return null;

  // Any remaining, unrecognised step id is treated as belonging to the
  // pre-existing legacy manual onboarding path — this module does not need
  // to enumerate that track's full step catalog to safely classify it as
  // "not one of ours".
  return 'legacy_manual';
}

/** True when `track` is one this module owns UI for (guided builder or resume upload). */
export function isProfessionalGuidedBuilderTrack(
  track: OnboardingTrack,
): track is 'guided_builder' | 'resume_upload' {
  return track === 'guided_builder' || track === 'resume_upload';
}
