/**
 * @file src/features/professional-onboarding/hooks/useResumeUploadOnboarding.ts
 *
 * WP-PRO-09C — Frontend Foundation & API Integration Implementation
 *
 * Mutation hook for `POST /api/v1/onboarding/upload-cv`.
 *
 * ⚠️  WHY THIS IS NOT `useUploadResume` (hooks/mutations/useUploadResume.ts):
 *   `useUploadResume` calls `POST /api/v1/resumes` — an async, standalone,
 *   dashboard resume-management endpoint that returns a `jobId` for polling
 *   and does NOT write the `cv_uploaded` marker the Definition Engine's
 *   track detection depends on. Using it for the onboarding Resume Upload
 *   journey would let a user upload a file, see no error, and never
 *   actually advance past `method_choice`. This hook exists specifically to
 *   prevent that mistake — it is a deliberate, separate hook, not
 *   duplicated logic. See WP-PRO-09B §0.4 / §3.2 for the full rationale.
 *
 * RESPONSIBILITIES:
 *  - Wrap guidedBuilderApi.uploadResume (multipart) in useMutation
 *  - Invalidate the shared progress cache + guided-profile cache on success
 *    (the sync upload-cv response already writes cv_uploaded / profile data
 *    server-side; invalidating lets the next read reflect it)
 *  - Apply the same non-idempotent-safe retry policy as useUploadResume
 *    (retry: false) — resending a large multipart file automatically on a
 *    transient failure is not safe to do silently
 *
 * HARD RULES:
 *  - NO UI logic — callers (a later work package's ResumeUploadScreen,
 *    wrapping the existing components/resume/ResumeUpload.tsx) own
 *    progress / success / error presentation.
 *  - NO polling logic — this endpoint is synchronous; there is no job to poll.
 *  - NO direct fetch/axios — always through guidedBuilderApi.
 *
 * Architecture position: Hooks layer (second tier)
 *   API → Hooks → UI → Pages → Guards → Context
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAppContext } from '@/context/AppContext';
import type { ApiClientError } from '@/lib/api/core';
import { retryDelay } from '@/lib/query';

import { guidedBuilderApi } from '../api/guided-builder.api';
import { professionalOnboardingQueryKeys } from '../queries/queryKeys';
import type { OnboardingResumeUploadResponse } from '../types';

export interface ResumeUploadOnboardingInput {
  /** The resume file to upload. The hook wraps this in FormData under the field name the backend multer route expects ('resume'). */
  file: File;
}

export function useResumeUploadOnboarding() {
  const queryClient = useQueryClient();
  const { user } = useAppContext();
  const userId = user?.id ?? null;

  return useMutation<OnboardingResumeUploadResponse, ApiClientError, ResumeUploadOnboardingInput>({
    mutationFn: ({ file }) => {
      const formData = new FormData();
      // Field name must match onboarding.routes.js's `upload.single('resume')` exactly.
      formData.append('resume', file);
      return guidedBuilderApi.uploadResume(formData);
    },

    // NON-IDEMPOTENT: each call parses and persists resume data against the
    // user's onboarding progress. Matches the documented retry:false
    // rationale in hooks/mutations/useUploadResume.ts.
    // ⚠️  DO NOT change to shouldRetry — keep retry: false.
    retry: false,
    retryDelay,

    onSuccess: () => {
      if (userId) {
        void queryClient.invalidateQueries({
          queryKey: professionalOnboardingQueryKeys.progress(userId),
        });
        void queryClient.invalidateQueries({
          queryKey: professionalOnboardingQueryKeys.guidedProfile(userId),
        });
      }
    },
  });
}
