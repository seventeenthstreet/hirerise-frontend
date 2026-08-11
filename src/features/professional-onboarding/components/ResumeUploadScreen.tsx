/**
 * @file src/features/professional-onboarding/components/ResumeUploadScreen.tsx
 *
 * Wires the existing, unmodified `ResumeUpload.tsx` drag-and-drop component
 * to the onboarding-scoped upload hook (`useResumeUploadOnboarding`, built in
 * WP-PRO-09C but unused until now). This closes the "Upload Resume" 404 —
 * `ROUTES.ONBOARDING_RESUME_UPLOAD` previously had no page behind it.
 *
 * ⚠️  Deliberately calls `useResumeUploadOnboarding` (→ POST /onboarding/upload-cv),
 * NOT `useUploadResume` (→ POST /resumes, the dashboard's async resume manager).
 * Only the former writes the `cv_uploaded` marker the Definition Engine's
 * track detection depends on — see useResumeUploadOnboarding.ts for the
 * full rationale.
 *
 * Scope note: this is a minimal, functional implementation to unblock
 * end-to-end testing of the Guided Builder work. The full Resume Upload
 * journey (processing state copy, scanned-PDF messaging, review hand-off)
 * described in WP-PRO-09B §3 is still owned by its own future work package;
 * this screen covers upload → success/error → navigate on, nothing more.
 *
 * WP-PRO-12C — the post-upload hand-off below now reuses the existing
 * `useAdvanceToNextStep` navigation helper (WP-PRO-09D) instead of a
 * hardcoded `navigate(ROUTES.ONBOARDING_PROFILE_REVIEW)`. That helper
 * already does exactly what's needed here: re-read the Progress API and
 * navigate to whatever the backend's fresh `currentStep` resolves to,
 * falling back to Review when there's nothing further to show. This is
 * the same mechanism the Guided Builder track's step forms use, so no
 * new navigation logic was written — see useAdvanceToNextStep.ts.
 *
 * The RESUME_UPLOAD track now has a 'guided_career_goals' step ahead of
 * 'profile_review' in professional-onboarding.definition.js, so the
 * first `advance()` call after a successful, non-scanned upload will
 * land the user on the (shared, pre-existing) Career Goals screen
 * instead of jumping straight to Review — closing the gap that let
 * Resume Upload users skip Target Role capture entirely.
 */

import { ResumeUpload } from '@/components/resume/ResumeUpload';
import { StepContainer, StepTitle, StepDescription } from '@/components/onboarding/steps';
import { ROUTES } from '@/routes/routes.constants';
import { useNavigate } from 'react-router-dom';

import { useResumeUploadOnboarding } from '../hooks/useResumeUploadOnboarding';
import { useAdvanceToNextStep } from '../hooks/useAdvanceToNextStep';

export function ResumeUploadScreen() {
  const navigate = useNavigate();
  const uploadMutation = useResumeUploadOnboarding();
  const { advance } = useAdvanceToNextStep();

  async function handleUpload(file: File) {
    let result;
    try {
      result = await uploadMutation.mutateAsync({ file });
    } catch {
      // Error is already captured in uploadMutation.error and rendered below;
      // ResumeUpload's own local file-selection state resets on next attempt.
      return;
    }

    if (result.isScannedPdf) {
      // No extractable text — steer the user to the Guided Builder instead
      // of a dead end. Uses the same entry point Build My Profile uses.
      navigate(ROUTES.ONBOARDING_BUILDER_ROOT);
      return;
    }

    // Backend-driven hand-off (see file header) — was a hardcoded
    // navigate(ROUTES.ONBOARDING_PROFILE_REVIEW).
    //
    // WP-PRO-12C follow-up: the upload above has already succeeded and
    // persisted server-side by this point — only the *navigation* can
    // still fail (e.g. a dropped connection during advance()'s progress
    // refetch). That must not be swallowed silently the way an upload
    // failure is: uploadMutation.error would still be null, so nothing
    // would render and the user would be left on this screen with no
    // feedback and no way forward, even though their resume was already
    // saved. Fall back to the same safe default used before this WP
    // (Review — profile_review's own derived completion means the user
    // ends up there regardless of whether Career Goals was reached yet)
    // and let them retry from there instead of leaving them stranded.
    try {
      await advance();
    } catch {
      navigate(ROUTES.ONBOARDING_PROFILE_REVIEW);
    }
  }

  return (
    <StepContainer>
      <StepTitle>Upload your resume</StepTitle>
      <StepDescription>
        We&apos;ll extract your details automatically — you can review and edit everything afterwards.
      </StepDescription>

      <ResumeUpload
        onUpload={handleUpload}
        isUploading={uploadMutation.isPending}
        error={uploadMutation.error}
      />
    </StepContainer>
  );
}