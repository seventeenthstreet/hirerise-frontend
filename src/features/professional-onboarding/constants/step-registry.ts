/**
 * @file src/features/professional-onboarding/constants/step-registry.ts
 *
 * WP-PRO-09C — Frontend Foundation & API Integration Implementation
 *
 * Client-side step metadata registry for the Professional Guided Builder and
 * Resume Upload tracks.
 *
 * WHY THIS FILE EXISTS (see also types/index.ts#StepRegistryEntry):
 *   The frozen Progress API (`GET /api/v1/onboarding/progress`) returns only
 *   `{ stepId, completed }` per step — no title, description, or renderer
 *   reference. The Definition Engine computes richer metadata internally
 *   (professional-onboarding.definition.js) but strips it before the
 *   response leaves the backend (onboarding.analytics.service.js#buildSteps).
 *   This registry is the frontend's own copy of that display metadata,
 *   keyed by the exact `stepId` values the backend emits.
 *
 * SCOPE (per WP-PRO-09B §5.2 / WP-PRO-09C §5):
 *   - Metadata ONLY: title, description, route, backend section, renderer
 *     component reference.
 *   - NO business logic. NO gating. NO ordering authority beyond what is
 *     needed to resolve a `stepId` to something displayable.
 *   - `completed` / `currentStep` continue to come exclusively from the
 *     Progress API response — this registry never re-derives them.
 *   - The dynamic step renderer that CONSUMES this registry is explicitly
 *     out of scope for this work package (WP-PRO-09B §5.1) — only the
 *     registry data structure and a pure lookup helper are implemented here.
 *
 * STABILITY:
 *   Every `stepId` key below is copied verbatim from the frozen backend
 *   Definition Engine (professional-onboarding.definition.js). Do not rename
 *   or invent step ids — if the backend catalog changes, update this file to
 *   match, never the other way around.
 */

import { lazy } from 'react';

import { ROUTES } from '@/routes/routes.constants';
import type { GuidedBuilderSection, StepRegistryEntry } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// GUIDED BUILDER TRACK REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registry entries for every `stepId` the Definition Engine can emit for the
 * GUIDED_BUILDER track (professional-onboarding.definition.js
 * TRACK_STEPS[GUIDED_BUILDER]). Keys match `stepId` values exactly.
 *
 * `component` references are lazy-loaded (WP-PRO-09D) and typed against the
 * existing `OnboardingStepProps` contract from
 * '@/components/onboarding/steps/types' — every step form is called the
 * same way regardless of which onboarding flow it belongs to.
 */
export const GUIDED_BUILDER_STEP_REGISTRY: Readonly<Record<string, StepRegistryEntry>> = {
  guided_personal_details: {
    title: 'Personal Details',
    description: 'Your name, email, and contact details.',
    route: ROUTES.ONBOARDING_BUILDER_PERSONAL,
    section: 'personal_details' satisfies GuidedBuilderSection,
    component: lazy(() => import('../components/steps/PersonalDetailsForm')),
  },
  guided_education: {
    title: 'Education',
    description: 'Your academic background.',
    route: ROUTES.ONBOARDING_BUILDER_EDUCATION,
    section: 'education' satisfies GuidedBuilderSection,
    component: lazy(() => import('../components/steps/EducationForm')),
  },
  guided_experience: {
    title: 'Experience',
    description: 'Your work history.',
    route: ROUTES.ONBOARDING_BUILDER_EXPERIENCE,
    section: 'experience' satisfies GuidedBuilderSection,
    component: lazy(() => import('../components/steps/ExperienceForm')),
  },
  guided_skills: {
    title: 'Skills',
    description: 'Skills, certifications, and languages.',
    route: ROUTES.ONBOARDING_BUILDER_SKILLS,
    section: 'skills' satisfies GuidedBuilderSection,
    component: lazy(() => import('../components/steps/SkillsForm')),
  },
  guided_career_goals: {
    title: 'Career Goals',
    description: 'What you want to do next.',
    route: ROUTES.ONBOARDING_BUILDER_CAREER_GOALS,
    section: 'career_goals' satisfies GuidedBuilderSection,
    component: lazy(() => import('../components/steps/CareerGoalsForm')),
  },
} as const;

/**
 * Static display order of the Guided Builder track's gating/optional steps,
 * copied from professional-onboarding.definition.js TRACK_STEPS[GUIDED_BUILDER].
 *
 * SCOPE: used ONLY for rendering a "Back" link to the previous screen
 * (WP-PRO-09B §4.2: "Back → local navigation only — does not re-submit").
 * It is never used to decide what happens on Continue/Save — that
 * navigation is driven exclusively by the backend's `currentStep`
 * (see hooks/useAdvanceToNextStep.ts). Going backward to look at an
 * already-completed screen is not a completion decision, so computing it
 * client-side is safe and explicitly sanctioned by WP-PRO-09B.
 */
export const GUIDED_BUILDER_STEP_ORDER: readonly string[] = [
  'guided_personal_details',
  'guided_education',
  'guided_experience',
  'guided_skills',
  'guided_career_goals',
];

/**
 * Returns the registry entry for the step immediately before `stepId` in
 * the static display order above, or `undefined` if `stepId` is the first
 * step, unrecognised, or not part of the Guided Builder track.
 */
export function getPreviousGuidedBuilderStep(stepId: string | null | undefined): StepRegistryEntry | undefined {
  if (!stepId) return undefined;
  const index = GUIDED_BUILDER_STEP_ORDER.indexOf(stepId);
  if (index <= 0) return undefined;
  return GUIDED_BUILDER_STEP_REGISTRY[GUIDED_BUILDER_STEP_ORDER[index - 1]];
}

// ─────────────────────────────────────────────────────────────────────────────
// RESUME UPLOAD TRACK REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registry entries for every `stepId` the Definition Engine can emit for the
 * RESUME_UPLOAD track. `ai_resume_parsing` has `route: null` and
 * `component: null` because it is a derived step with no dedicated screen —
 * it auto-advances once `confidence.overall > 0` on the upload response
 * (professional-onboarding.progression.js).
 */
export const RESUME_UPLOAD_STEP_REGISTRY: Readonly<Record<string, StepRegistryEntry>> = {
  upload_resume: {
    title: 'Upload Resume',
    description: 'Upload your existing resume to get started quickly.',
    route: ROUTES.ONBOARDING_RESUME_UPLOAD,
    section: null,
    component: null,
  },
  ai_resume_parsing: {
    title: 'AI Resume Parsing',
    description: 'We are extracting your profile details from your resume.',
    route: null,
    section: null,
    component: null,
  },
  profile_review: {
    title: 'Profile Review',
    description: 'Review the details we found before continuing.',
    route: ROUTES.ONBOARDING_PROFILE_REVIEW,
    section: null,
    component: null,
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// COMBINED LOOKUP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Union of both track registries, for callers that need to resolve a
 * `stepId` without first knowing which track it belongs to.
 */
const COMBINED_STEP_REGISTRY: Readonly<Record<string, StepRegistryEntry>> = {
  ...GUIDED_BUILDER_STEP_REGISTRY,
  ...RESUME_UPLOAD_STEP_REGISTRY,
};

/**
 * Pure lookup helper — resolves a `stepId` (as returned by the Progress API)
 * to its registry entry, or `undefined` if the id is not recognised.
 *
 * Deliberately returns `undefined` rather than throwing: an unrecognised
 * `stepId` means the backend Definition Engine has introduced a step this
 * registry doesn't know about yet. Callers (the future dynamic step
 * renderer) must treat this as "render a safe fallback", never as a crash —
 * see WP-PRO-09B §5.1.
 *
 * @example
 * const entry = resolveStep(progress.currentStep);
 * if (!entry) {
 *   // render fallback UI — do not throw
 * }
 */
export function resolveStep(stepId: string | null | undefined): StepRegistryEntry | undefined {
  if (!stepId) return undefined;
  return COMBINED_STEP_REGISTRY[stepId];
}
