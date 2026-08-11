/**
 * @file src/features/professional-onboarding/types/index.ts
 *
 * WP-PRO-09C — Frontend Foundation & API Integration Implementation
 *
 * SINGLE SOURCE OF TRUTH for all Professional Guided Builder domain types.
 *
 * These types mirror the FROZEN backend contract exactly (verified against
 * core/src/modules/onboarding/{onboarding.routes.js, onboarding.controller.js,
 * onboarding.guidedBuilder.service.js, professional-onboarding.definition.js,
 * professional-onboarding.progression.js}). Nothing here invents a shape —
 * every field is either returned by an existing endpoint or is pure
 * frontend-only display metadata (clearly marked as such).
 *
 * This module intentionally does NOT redefine `OnboardingStep` /
 * `OnboardingProgressResponse` from '@/features/onboarding/types' — those
 * remain owned by the generic onboarding feature. The type below
 * (`ProfessionalOnboardingProgressResponse`) is a corrected, more complete
 * shape used specifically by the Professional Guided Builder hooks, because
 * the existing `OnboardingProgressResponse` type omits fields the backend
 * genuinely returns (userId, onboardingCompleted, completedAt, updatedAt) and
 * types `currentStep` as non-nullable when the backend returns `null` once
 * onboarding is complete. Existing consumers of the old type are unaffected.
 *
 * WP-PRO-09D update: `StepRegistryEntry.component` now references the
 * EXISTING `OnboardingStepProps` contract from
 * '@/components/onboarding/steps/types' instead of a placeholder `unknown`,
 * now that the step registry (WP-PRO-09C) has real components to point to.
 */

import type { ComponentType } from 'react';
import type { OnboardingStepProps } from '@/components/onboarding/steps/types';

// ─────────────────────────────────────────────────────────────────────────────
// GUIDED BUILDER SECTIONS  (exact match to backend VALID_SECTIONS)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The exact, complete set of section identifiers accepted by
 * `POST /api/v1/onboarding/guided/:section` (see
 * onboarding.guidedBuilder.service.js#VALID_SECTIONS). Do not add values here
 * without confirming the corresponding backend validator has been updated —
 * this frontend type must never drift ahead of the frozen backend contract.
 */
export const GUIDED_BUILDER_SECTIONS = [
  'personal_details',
  'education',
  'experience',
  'skills',
  'certifications',
  'projects',
  'languages',
  'career_goals',
  'employment_preferences',
] as const;

export type GuidedBuilderSection = (typeof GUIDED_BUILDER_SECTIONS)[number];

/**
 * The subset of sections that are also tracked as gating steps by the
 * Definition Engine's Progress API (i.e. they appear in `steps[]` and
 * participate in `currentStep` advancement). See
 * professional-onboarding.definition.js TRACK_STEPS[GUIDED_BUILDER].
 *
 * The remaining sections (certifications, projects, languages,
 * employment_preferences) are valid save targets but are NOT progress-gating
 * — they are optional enrichment sections. Consumers must not assume every
 * value in GUIDED_BUILDER_SECTIONS has a corresponding Progress API step.
 */
export const GATING_GUIDED_BUILDER_SECTIONS = [
  'personal_details',
  'education',
  'experience',
  'skills',
  'career_goals',
] as const;

export type GatingGuidedBuilderSection = (typeof GATING_GUIDED_BUILDER_SECTIONS)[number];

/** Sections accepted by the backend that never gate progress (pure enrichment). */
export const ENRICHMENT_ONLY_SECTIONS = [
  'certifications',
  'projects',
  'languages',
  'employment_preferences',
] as const;

export type EnrichmentOnlySection = (typeof ENRICHMENT_ONLY_SECTIONS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS API  (GET /api/v1/onboarding/progress — frozen, shared endpoint)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single step entry as returned inside `steps[]`.
 *
 * IMPORTANT (verified against onboarding.analytics.service.js#buildSteps):
 * the backend returns ONLY `stepId` and `completed` per step — no `title`,
 * `description`, or track indicator. Anything beyond these two fields must
 * come from the client-side step registry (see constants/step-registry.ts),
 * never assumed to be present on this type.
 */
export interface ProfessionalOnboardingStep {
  stepId: string;
  completed: boolean;
}

/**
 * Full response shape of `GET /api/v1/onboarding/progress`, as verified
 * against onboarding.analytics.service.js#getProgress. The backend does NOT
 * return which track (guided_builder / resume_upload / legacy_manual) the
 * user is on — that must be inferred client-side (see utils/track-detection.ts).
 */
export interface ProfessionalOnboardingProgressResponse {
  userId: string;
  /** @deprecated Legacy field retained by the backend for old consumers. */
  step: string | null;
  /** Raw historyKeys, e.g. ["consent_saved", "guided_personal_details_saved"]. */
  completedSteps: string[];
  onboardingCompleted: boolean;
  completedAt: string | null;
  updatedAt: string | null;
  steps: ProfessionalOnboardingStep[];
  /** First incomplete stepId, or null once every gating step is complete. */
  currentStep: string | null;
  isComplete: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// GUIDED BUILDER PROFILE  (GET/POST /api/v1/onboarding/guided/* — frozen)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The canonical Professional Profile, as returned by
 * `GET /api/v1/onboarding/guided/profile`. Deliberately typed as an open,
 * partial record rather than an exhaustive interface: the Professional
 * Profile Normalization Engine is frozen and owned elsewhere (WP-PRO-09A),
 * and this frontend module must not encode assumptions about its exact
 * field-level shape beyond "some JSON object, or null before any section has
 * been saved". UI components that render specific sections should narrow
 * this type locally when they are built, not here.
 */
export type ProfessionalProfile = Record<string, unknown>;

export interface GuidedBuilderProfileResponse {
  profile: ProfessionalProfile | null;
}

/**
 * Response shape of `POST /api/v1/onboarding/guided/:section`, as verified
 * against onboarding.controller.js#saveGuidedBuilderSection. `step` is always
 * `guided_${section}_saved` for the five gating sections; for the four
 * enrichment-only sections the backend still returns a `step` value of the
 * same shape (`guided_${section}_saved`) even though it is not present in the
 * Progress API's `steps[]`.
 */
export interface SaveGuidedSectionResponse {
  userId: string;
  section: GuidedBuilderSection;
  step: string;
}

/** Payload accepted by a given section's save call. Shape is section-specific and validated server-side. */
export type GuidedSectionPayload = Record<string, unknown>;

// ─────────────────────────────────────────────────────────────────────────────
// RESUME UPLOAD  (POST /api/v1/onboarding/upload-cv — frozen)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Response shape of the ONBOARDING-SCOPED, synchronous resume upload
 * endpoint (`POST /api/v1/onboarding/upload-cv`), as verified against
 * onboarding.controller.js#uploadCvDuringOnboarding.
 *
 * ⚠️  DO NOT confuse this with `UploadResumeResponse` from
 * '@/hooks/mutations/useUploadResume' — that type describes the response of
 * the DIFFERENT, async, standalone `POST /api/v1/resumes` endpoint, which
 * does not participate in onboarding track detection. See
 * useResumeUploadOnboarding.ts for the full rationale.
 */
/**
 * WP-PRO-09E addendum — verified directly against
 * onboarding.controller.js#uploadCvDuringOnboarding (both the scanned-PDF
 * fast-path and the main parsing branch):
 *   - `parseOutcome` IS present on the top-level `data` envelope on every
 *     response from this endpoint ('scanned_pdf' | 'success' | 'partial' |
 *     'failed') — this is the documented, non-internal signal the backend
 *     comment itself designates for detecting the scanned/failed states
 *     ("use parseOutcome === 'scanned_pdf'").
 *   - `isScannedPdf` (previously declared below) does NOT exist on `data` —
 *     the backend only ever nests it under `meta.internal`, explicitly
 *     marked "INTERNAL — not for frontend use" in the controller's own
 *     comments. Kept here as an optional/never-relied-upon field for
 *     backward compatibility with any existing caller that checked it
 *     defensively, but new code must branch on `parseOutcome`, not this.
 */
export type OnboardingResumeParseOutcome = 'scanned_pdf' | 'success' | 'partial' | 'failed';

export interface OnboardingResumeUploadResponse {
  /** Always 'sync' for this endpoint — the parse happens in-request. */
  mode: 'sync';
  parsedData: Record<string, unknown> | null;
  structuredResume?: Record<string, unknown>;
  confidence?: {
    overall?: number;
    [key: string]: unknown;
  };
  quality?: Record<string, unknown>;
  /**
   * The real, always-present outcome discriminant — see the addendum above.
   * Optional in the type only as a defensive fallback; the backend always
   * sets it in practice.
   */
  parseOutcome?: OnboardingResumeParseOutcome;
  /**
   * @deprecated Not actually present on `data` per the backend contract
   * (see addendum above) — do not branch on this. Use `parseOutcome`.
   */
  isScannedPdf?: boolean;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETION  (POST /api/v1/onboarding/complete)
//
// WP-PRO-11 Part 5: the backend previously always returned `step: 'complete'`
// even when completion criteria were not met (persistCompletionIfReady()
// returned undefined and the controller ignored it). It now returns the
// real outcome — `step` is 'complete' only when `isComplete` is true.
// ─────────────────────────────────────────────────────────────────────────────

export interface CompleteOnboardingResponse {
  step: 'complete' | 'incomplete';
  isComplete: boolean;
  /** Track-level breakdown from evaluateCompletion() on the backend, or null. */
  completion: {
    isComplete: boolean;
    trackA?: boolean;
    trackAUpload?: boolean;
    trackB?: boolean;
    alreadyCompleted?: boolean;
  } | null;
  stepHistory: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// TRACK INFERENCE  (frontend-only concept — the backend never returns this)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Client-side-only classification of which onboarding path a user is on.
 * Inferred (never authoritative) from the shape of `steps[]` — see
 * utils/track-detection.ts. Used purely to select which step registry to
 * resolve `currentStep` against; it must never be used to gate completion,
 * which remains entirely server-computed.
 */
export type OnboardingTrack = 'guided_builder' | 'resume_upload' | 'legacy_manual' | null;

// ─────────────────────────────────────────────────────────────────────────────
// STEP REGISTRY  (frontend-only display metadata — see constants/step-registry.ts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Metadata-only description of a single onboarding step, used by the
 * dynamic step renderer (WP-PRO-09D) to resolve a `stepId` into something
 * displayable.
 *
 * CONTRACT: this type must never carry business/gating logic. `completed`,
 * step ordering authority, and validation rules all remain server-owned and
 * are read from `ProfessionalOnboardingProgressResponse`, not from here.
 */
export interface StepRegistryEntry {
  /** Human-readable title — display-only, duplicated from the backend Definition Engine because the Progress API does not return it. */
  title: string;
  /** Human-readable description — display-only, same duplication rationale as `title`. */
  description: string;
  /** Frontend route this step renders at. Null for derived/no-screen steps (e.g. ai_resume_parsing). */
  route: string | null;
  /**
   * The backend section this step saves to, for gating Guided Builder steps.
   * Null for steps that don't correspond to a `POST /guided/:section` call
   * (e.g. the resume-upload track's steps, which use different endpoints).
   */
  section: GuidedBuilderSection | null;
  /**
   * Lazy-loadable renderer component reference, typed against the EXISTING
   * `OnboardingStepProps` contract from
   * '@/components/onboarding/steps/types' — reused, not redefined, so every
   * step form (regardless of which onboarding flow it belongs to) is called
   * the same way: `onComplete(data)`, `isBusy`, `initialData`.
   *
   * `null` for steps with no dedicated screen (e.g. `ai_resume_parsing`,
   * which auto-advances) or for tracks not yet implemented (Resume Upload,
   * out of scope for WP-PRO-09D).
   */
  component: ComponentType<OnboardingStepProps> | null;
}
