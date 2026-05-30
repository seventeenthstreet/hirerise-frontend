/**
 * src/hooks/types/onboarding.types.ts
 *
 * ACADEMIC ONBOARDING — DOMAIN TYPES
 * ────────────────────────────────────
 * Typed shapes for every entity used by the academic onboarding RPCs.
 * Covers profile creation, full-profile retrieval, subject/language saves,
 * and onboarding completion.
 *
 * GOVERNANCE:
 *  ❌ No Supabase imports.
 *  ❌ No React imports.
 *  ❌ No business logic.
 *  ✅ Types + discriminated union helpers only.
 *  ✅ Additive-safe — optional fields for non-breaking additions.
 */

// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING STATUS
// ─────────────────────────────────────────────────────────────────────────────

export type OnboardingStatus =
  | 'not_started'
  | 'profile_created'
  | 'subjects_saved'
  | 'languages_saved'
  | 'completed';

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT ACADEMIC PROFILE
// ─────────────────────────────────────────────────────────────────────────────

export interface StudentAcademicProfile {
  /** Supabase Auth UID */
  student_id: string;
  country_code: string;
  region_code: string;
  board_code: string;
  stream_code: string;
  stream_id: string;
  /** e.g. 10, 11, 12 */
  class_level: number;
  onboarding_status: OnboardingStatus;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT SUBJECT SELECTION
// ─────────────────────────────────────────────────────────────────────────────

export interface StudentSubjectEntry {
  subject_id: string;
  subject_code: string;
  subject_name: string;
  is_selected: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT LANGUAGE SELECTION
// ─────────────────────────────────────────────────────────────────────────────

export interface StudentLanguageEntry {
  language_id: string;
  language_code: string;
  language_name: string;
  is_medium_of_instruction: boolean;
  is_additional: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// FULL PROFILE — aggregate returned by fn_get_student_full_profile
// ─────────────────────────────────────────────────────────────────────────────

export interface StudentFullProfile {
  profile: StudentAcademicProfile;
  subjects: StudentSubjectEntry[];
  languages: StudentLanguageEntry[];
  onboarding_status: OnboardingStatus;
  /** Whether all required onboarding steps are complete. */
  is_complete: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// MUTATION PAYLOADS
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateAcademicProfilePayload {
  country_code: string;
  region_code: string;
  board_code: string;
  stream_code: string;
  stream_id: string;
  class_level: number;
}

export interface SaveSubjectsPayload {
  subject_ids: string[];
}

export interface SaveLanguagesPayload {
  /** Subject IDs selected as medium of instruction. */
  medium_language_ids: string[];
  /** Additional language IDs. */
  additional_language_ids: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// MUTATION RESULTS
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateAcademicProfileResult {
  profile: StudentAcademicProfile;
  /** Whether a pre-existing profile was replaced. */
  was_replay: boolean;
}

export interface SaveSubjectsResult {
  saved_count: number;
  onboarding_status: OnboardingStatus;
}

export interface SaveLanguagesResult {
  saved_count: number;
  onboarding_status: OnboardingStatus;
}

export interface CompleteOnboardingResult {
  onboarding_status: 'completed';
  completed_at: string;
  /** Whether this was a re-completion (replay-safe). */
  was_replay: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// OPTIMISTIC UPDATE CONTEXT TYPES
// Used by mutation onMutate / onError for rollback
// ─────────────────────────────────────────────────────────────────────────────

export interface OptimisticSubjectContext {
  previousSubjects: StudentSubjectEntry[] | undefined;
  previousProfile: StudentFullProfile | undefined;
}

export interface OptimisticLanguageContext {
  previousLanguages: StudentLanguageEntry[] | undefined;
  previousProfile: StudentFullProfile | undefined;
}

export interface OptimisticProfileContext {
  previousProfile: StudentFullProfile | undefined;
}
