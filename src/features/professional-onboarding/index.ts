/**
 * @file src/features/professional-onboarding/index.ts
 *
 * WP-PRO-09C — Frontend Foundation & API Integration Implementation
 *
 * Public surface for the Professional Guided Builder feature module.
 * External consumers (a later work package's UI components/pages) should
 * import from here, not from internal sub-paths — mirrors the existing
 * encapsulation convention already used by '@/features/onboarding'.
 *
 * NOTE ON SCOPE: WP-PRO-09D added the Guided Profile Builder UI (layout,
 * dynamic step renderer, Entry Experience, Resume Upload screen, and the
 * five step forms) on top of the WP-PRO-09C infrastructure below.
 * WP-PRO-09F adds the Review screen. Completion UI is exported here once
 * its component file exists — see the Components section below.
 */

// ── Types ────────────────────────────────────────────────────────────────────
export type {
  GuidedBuilderSection,
  GatingGuidedBuilderSection,
  EnrichmentOnlySection,
  ProfessionalOnboardingStep,
  ProfessionalOnboardingProgressResponse,
  ProfessionalProfile,
  GuidedBuilderProfileResponse,
  SaveGuidedSectionResponse,
  GuidedSectionPayload,
  OnboardingResumeUploadResponse,
  CompleteOnboardingResponse,
  OnboardingTrack,
  StepRegistryEntry,
} from './types';

export {
  GUIDED_BUILDER_SECTIONS,
  GATING_GUIDED_BUILDER_SECTIONS,
  ENRICHMENT_ONLY_SECTIONS,
} from './types';

// ── Constants / Registry ─────────────────────────────────────────────────────
export {
  GUIDED_BUILDER_STEP_REGISTRY,
  RESUME_UPLOAD_STEP_REGISTRY,
  resolveStep,
} from './constants/step-registry';

// ── Utils ─────────────────────────────────────────────────────────────────────
export { inferOnboardingTrack, isProfessionalGuidedBuilderTrack } from './utils/track-detection';

// ── Queries ───────────────────────────────────────────────────────────────────
export {
  professionalOnboardingQueryKeys,
  type ProfessionalOnboardingQueryKey,
} from './queries/queryKeys';

// ── Hooks ─────────────────────────────────────────────────────────────────────
export { useProfessionalOnboardingProgress } from './hooks/useProfessionalOnboardingProgress';
export { useGuidedBuilderProfile } from './hooks/useGuidedBuilderProfile';
export { useSaveGuidedSection } from './hooks/useSaveGuidedSection';
export { useResumeUploadOnboarding, type ResumeUploadOnboardingInput } from './hooks/useResumeUploadOnboarding';
export { useCompleteOnboarding } from './hooks/useCompleteOnboarding';
export { useAdvanceToNextStep } from './hooks/useAdvanceToNextStep';

// ── Components (WP-PRO-09D / WP-PRO-09F) ─────────────────────────────────────
export { EntryExperience } from './components/EntryExperience';
export { ResumeUploadScreen } from './components/ResumeUploadScreen';
export { GuidedBuilderLayout } from './components/GuidedBuilderLayout';
export { GuidedBuilderStepRenderer } from './components/GuidedBuilderStepRenderer';
export { GuidedBuilderStepPage } from './components/GuidedBuilderStepPage';
export { GuidedBuilderIndexRedirect } from './components/GuidedBuilderIndexRedirect';
export { ReviewScreen } from './components/ReviewScreen';
export { CompletionScreen } from './components/CompletionScreen';