// hooks/useHasResume.ts
//
// Shared hook used by dashboard cards to determine if the current user
// has a resume — without relying on the potentially-stale resumeUploaded
// flag on the users doc.
//
// Priority:
//   1. chi.isReady  — CHI snapshot exists → resume was definitely scored
//   2. resumes list — at least one non-deleted resume in Firestore
//   3. profile flag — users.resumeUploaded (may be stale for onboarding users)
//
// Returns { hasResume, isLoading } so callers can show skeletons while checking.

'use client';

import { useCareerHealth } from './useCareerHealth';
import { useResumes }      from './useResumes';
import { useProfile }      from './useProfile';

export function useHasResume() {
  const { data: chi,     isLoading: chiLoading  } = useCareerHealth();
  const { data: resumes, isLoading: resumeLoading } = useResumes();
  const { data: profile, isLoading: profileLoading } = useProfile();

  const isLoading = chiLoading && resumeLoading && profileLoading;

  const hasResume =
    !!chi?.isReady ||
    (resumes?.items?.length ?? 0) > 0 ||
    !!(profile?.user as any)?.resumeUploaded;

  return { hasResume, isLoading };
}