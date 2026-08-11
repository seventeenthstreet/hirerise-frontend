/**
 * @file src/features/professional-onboarding/api/guided-builder.api.ts
 *
 * WP-PRO-09C — Frontend Foundation & API Integration Implementation
 * Implements WP-PRO-09B §7 (Write Path Correction).
 *
 * THE DEFECT THIS FILE FIXES:
 *   The existing write path (`lib/api/endpoints/onboarding.ts#onboardingApi.submitStep`,
 *   `lib/api/onboarding.ts#submitOnboardingStep`) sends
 *   `POST /api/v1/onboarding/${stepId}`. No such route exists — the frozen
 *   backend (onboarding.routes.js) only defines named, fixed routes
 *   (`/guided/:section`, `/upload-cv`, `/career-report`, `/complete`, etc.).
 *   This module replaces that generic call pattern with thin, per-endpoint
 *   wrappers, one per real backend route.
 *
 * RULES (mirrors lib/api/endpoints/onboarding.ts, the correct existing precedent):
 *  - No try/catch — errors are ApiClientError; they must propagate to React Query.
 *  - No parsing logic — all parsing lives in lib/api/core/api-parser.ts.
 *  - No business logic, state, or UI concerns — thin wrappers only.
 *  - Every URL below is copied verbatim from onboarding.routes.js. None is invented.
 *
 * Architecture position: API layer (first tier)
 *   core (apiRequest) → client (apiClient) → THIS FILE → hooks → UI
 */

import { apiClient } from '@/lib/api/client';
import { onboardingApi } from '@/lib/api/endpoints/onboarding';

import type {
  CompleteOnboardingResponse,
  GuidedBuilderProfileResponse,
  GuidedBuilderSection,
  GuidedSectionPayload,
  OnboardingResumeUploadResponse,
  ProfessionalOnboardingProgressResponse,
  SaveGuidedSectionResponse,
} from '../types';
import type { CareerReportResponse } from '@/features/onboarding/types';

export const guidedBuilderApi = {
  /**
   * GET /api/v1/onboarding/progress
   *
   * Reused verbatim from the existing, ALREADY-CORRECT onboarding endpoints
   * module — this is the same Progress API used by the generic onboarding
   * flow (onboardingApi.getProgress hits the right, frozen route already).
   * Not duplicated here; re-exported so all Guided Builder hooks have one
   * import surface (`guidedBuilderApi.*`).
   *
   * NOTE: the return type here (`ProfessionalOnboardingProgressResponse`) is
   * more complete than `onboardingApi.getProgress`'s declared
   * `OnboardingProgressResponse` return type (see types/index.ts for the
   * rationale) — the underlying HTTP call is identical.
   */
  getProgress: (): Promise<ProfessionalOnboardingProgressResponse> =>
    onboardingApi.getProgress() as unknown as Promise<ProfessionalOnboardingProgressResponse>,

  /**
   * GET /api/v1/onboarding/guided/profile
   * Returns the canonical Professional Profile (or null pre-first-save).
   * Used both for form pre-fill and as the Review screen's data source
   * (WP-PRO-09B §8.4, §9.2) — not implemented in this work package.
   */
  getProfile: (): Promise<GuidedBuilderProfileResponse> =>
    apiClient<GuidedBuilderProfileResponse>({
      url: '/api/v1/onboarding/guided/profile',
      method: 'GET',
    }),

  /**
   * POST /api/v1/onboarding/guided/:section
   *
   * `section` is typed as the exact `GuidedBuilderSection` union — not a
   * free-form string — so a typo is a compile error rather than a runtime
   * 400 from the backend's route validator.
   */
  saveSection: (
    section: GuidedBuilderSection,
    data: GuidedSectionPayload,
  ): Promise<SaveGuidedSectionResponse> =>
    apiClient<SaveGuidedSectionResponse>({
      url: `/api/v1/onboarding/guided/${section}`,
      method: 'POST',
      data,
    }),

  /**
   * POST /api/v1/onboarding/upload-cv
   *
   * ⚠️  DELIBERATELY DISTINCT from `POST /api/v1/resumes` (used by
   * `useUploadResume` / `lib/api/resume.ts` for the standalone, async,
   * dashboard resume-management flow). Only THIS endpoint writes the
   * `cv_uploaded` marker to `onboarding_progress.step_history`, which is
   * what the Definition Engine's track detection depends on. See
   * WP-PRO-09B §0.4 for the full rationale — calling `/api/v1/resumes`
   * from the onboarding Resume Upload journey would silently strand the
   * user at `method_choice` forever.
   *
   * `formData` must contain the file under the field name `resume` (the
   * exact multer field name the backend route expects —
   * onboarding.routes.js `upload.single('resume')`).
   */
  uploadResume: (formData: FormData): Promise<OnboardingResumeUploadResponse> =>
    apiClient<OnboardingResumeUploadResponse>({
      url: '/api/v1/onboarding/upload-cv',
      method: 'POST',
      data: formData,
      // FIX (WP-PRO-09K, root cause verified in WP-PRO-09J): the shared axios instance sets a default
      // 'Content-Type: application/json' header (lib/api/core/api-client.ts).
      // Axios's default transformRequest checks that header BEFORE deciding
      // how to serialize the body: if it looks like JSON, it calls
      // JSON.stringify(formDataToJSON(data)) on the FormData instead of
      // sending it as-is — silently discarding the file and sending a JSON
      // body. multer's upload.single('resume') then never populates
      // req.file, so the backend correctly (but confusingly) responds with
      // "No resume file provided." Declaring 'multipart/form-data' here
      // (without a boundary) makes axios take the FormData-passthrough path;
      // axios then strips this header before sending so the browser can set
      // the real header with the correct multipart boundary. This mirrors
      // the existing precedent in lib/api/client.ts and lib/api/resume.ts,
      // the codebase's other two multipart upload call sites.
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  /**
   * POST /api/v1/onboarding/career-report
   * Reused verbatim from the existing, already-correct onboarding endpoints
   * module — not duplicated here, re-exported for a single import surface.
   */
  generateCareerReport: (): Promise<CareerReportResponse> => onboardingApi.generateCareerReport(),

  /**
   * POST /api/v1/onboarding/complete
   * Marks onboarding complete; frozen backend merges step_history rather
   * than overwriting it, so this call is safe to retry.
   */
  complete: (): Promise<CompleteOnboardingResponse> =>
    apiClient<CompleteOnboardingResponse>({
      url: '/api/v1/onboarding/complete',
      method: 'POST',
    }),
} as const;
