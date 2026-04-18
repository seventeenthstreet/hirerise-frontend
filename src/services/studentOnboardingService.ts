// services/studentOnboardingService.ts
//
// UNIFIED ONBOARDING — all student flows route through /api/v1/onboarding/*.
// The old /api/v1/student-onboarding/* endpoints have been removed.
// This service is kept for import-compatibility; new code should use
// onboardingService from ./onboardingService directly.

import { apiFetch } from './apiClient';

// ── Types (re-exported so existing consumers don't need import changes) ────────

export type InterestArea =
  | 'technology' | 'business' | 'design' | 'science'
  | 'healthcare' | 'law' | 'arts';

export type CareerCuriosity =
  | 'engineer' | 'doctor' | 'entrepreneur' | 'designer'
  | 'scientist' | 'lawyer';

export type LearningStyle =
  | 'hands_on' | 'research' | 'team_collaboration' | 'independent';

export interface StrengthRatings {
  problem_solving:      number; // 1–5
  creativity:           number;
  communication:        number;
  mathematics:          number;
  leadership:           number;
  // Section 4 additions
  analytical_thinking?: number;
  attention_to_detail?: number;
  collaboration?:       number;
}

// ── Academic marks types ──────────────────────────────────────────────────────

export interface YearMarks {
  mathematics:    number | null;
  science:        number | null;
  language:       number | null;
  social_studies: number | null;
  computer:       number | null;
}

export interface AcademicMarks {
  year_1: YearMarks;
  year_2: YearMarks;
  year_3: YearMarks;
}

export interface StudentOnboardingDraft {
  // Step 1
  age?:                number | null;
  grade?:              string;
  country?:            string;
  preferred_subjects?: string[];
  // Step 2
  interests?:          InterestArea[];
  // Step 3
  strengths?:          StrengthRatings;
  // Step 4
  career_curiosities?: CareerCuriosity[];
  // Step 5
  learning_styles?:    LearningStyle[];
  // Step 6 (Academic Performance)
  academic_marks?:     AcademicMarks;
}

export interface StudentOnboardingCompletePayload extends StudentOnboardingDraft {
  // All fields required for completion
  age:                number;
  grade:              string;
  country:            string;
  preferred_subjects: string[];
  interests:          InterestArea[];
  strengths:          StrengthRatings;
  career_curiosities: CareerCuriosity[];
  learning_styles:    LearningStyle[];
  academic_marks?:    AcademicMarks;
}

// ── Service — all paths use /onboarding/* ─────────────────────────────────────

export const studentOnboardingService = {
  /**
   * PATCH /api/v1/onboarding/draft
   * Auto-saves partial step data so users don't lose progress on refresh.
   * @migration Formerly PATCH /api/v1/student-onboarding/draft
   */
  saveDraft(payload: StudentOnboardingDraft): Promise<{ saved: boolean }> {
    return apiFetch<{ saved: boolean }>('/onboarding/draft', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  /**
   * GET /api/v1/onboarding/progress
   * Restores draft on mount so the wizard picks up where the user left off.
   * @migration Formerly GET /api/v1/student-onboarding/draft
   */
  getDraft(): Promise<{ draft: StudentOnboardingDraft | null }> {
    return apiFetch<{ draft: StudentOnboardingDraft | null }>('/onboarding/progress');
  },

  /**
   * POST /api/v1/onboarding/complete
   * Submits the full wizard payload and marks onboarding complete.
   * @migration Formerly POST /api/v1/student-onboarding/complete
   */
  complete(payload: StudentOnboardingCompletePayload): Promise<{ message: string }> {
    return apiFetch<{ message: string }>('/onboarding/complete', {
      method: 'POST',
      body: JSON.stringify({ resume_data: payload }),
    });
  },
};