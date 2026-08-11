/**
 * front/src/features/student-onboarding/lib/academic.types.ts
 *
 * SHARED ACADEMIC TYPES — Phase 3A
 * ──────────────────────────────────
 * Single source of truth for all TypeScript types used across:
 *   • Frontend hooks (useAcademicRecords, useSaveAcademicYear, ...)
 *   • UI components  (AcademicsStep, AcademicYearCard, SubjectMarksInput)
 *   • API layer      (academic.api.ts)
 *   • Normalization helpers
 *
 * SYNC CONTRACT:
 *   Every literal value here must match:
 *     1. academic_year_enum / academic_subject_enum in SQL
 *     2. ACADEMIC_YEARS / ACADEMIC_SUBJECTS in backend constants/academics.js
 *
 * ADDING NEW VALUES:
 *   Add to the union type AND the corresponding const array (e.g. ACADEMIC_YEARS_LIST).
 *   The const arrays are used for runtime iteration (rendering year cards, etc.).
 */

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS — Academic domain values
// ─────────────────────────────────────────────────────────────────────────────

export type AcademicYear =
  | 'class_8'
  | 'class_9'
  | 'class_10'
  | 'class_11'
  | 'class_12';

export type AcademicSubject =
  | 'mathematics'
  | 'physics'
  | 'chemistry'
  | 'biology'
  | 'computer_science'
  | 'english'
  | 'social_science'
  | 'economics'
  | 'commerce'
  | 'accountancy'
  | 'business_studies'
  | 'history'
  | 'geography'
  | 'political_science'
  | 'language_optional';

export type AcademicBoardType =
  | 'cbse'
  | 'icse'
  | 'state'
  | 'ib'
  | 'other';

export type AcademicGrade =
  | 'A_plus'
  | 'A'
  | 'B_plus'
  | 'B'
  | 'C'
  | 'D'
  | 'F';

export type AcademicSourceType = 'manual' | 'ocr' | 'imported';

// ─────────────────────────────────────────────────────────────────────────────
// CONST ARRAYS — For runtime iteration
// ─────────────────────────────────────────────────────────────────────────────

export const ACADEMIC_YEARS_LIST: readonly AcademicYear[] = [
  'class_8',
  'class_9',
  'class_10',
  'class_11',
  'class_12',
] as const;

/**
 * All subjects (for DB/validation purposes).
 */
export const ACADEMIC_SUBJECTS_LIST: readonly AcademicSubject[] = [
  'mathematics',
  'physics',
  'chemistry',
  'biology',
  'computer_science',
  'english',
  'social_science',
  'economics',
  'commerce',
  'accountancy',
  'business_studies',
  'history',
  'geography',
  'political_science',
  'language_optional',
] as const;

/**
 * NCERT-aligned subjects available per academic year.
 *
 * Class 8–10: Core subjects only (NCERT standard curriculum).
 *   - Science is assessed as Physics + Chemistry + Biology at board level.
 *   - Social Science covers History, Geography, Civics, Economics as one paper.
 *   - language_optional covers Hindi / Sanskrit / regional second language.
 *
 * Class 11–12: Stream-based subjects.
 *   - Science stream: Physics, Chemistry, Mathematics, Biology / Computer Science.
 *   - Commerce stream: Accountancy, Business Studies, Economics, Mathematics.
 *   - Humanities stream: History, Geography, Political Science, Economics.
 *   - language_optional covers elective language papers.
 */
export const SUBJECTS_BY_YEAR: Record<AcademicYear, readonly AcademicSubject[]> = {
  class_8: [
    'mathematics',
    'english',
    'social_science',
    'physics',
    'chemistry',
    'biology',
    'computer_science',
    'language_optional',
  ],
  class_9: [
    'mathematics',
    'english',
    'social_science',
    'physics',
    'chemistry',
    'biology',
    'computer_science',
    'language_optional',
  ],
  class_10: [
    'mathematics',
    'english',
    'social_science',
    'physics',
    'chemistry',
    'biology',
    'computer_science',
    'language_optional',
  ],
  class_11: [
    // Science stream
    'physics',
    'chemistry',
    'mathematics',
    'biology',
    'computer_science',
    // Commerce stream
    'accountancy',
    'business_studies',
    'economics',
    // Humanities stream
    'history',
    'geography',
    'political_science',
    // Common
    'english',
    'language_optional',
  ],
  class_12: [
    // Science stream
    'physics',
    'chemistry',
    'mathematics',
    'biology',
    'computer_science',
    // Commerce stream
    'accountancy',
    'business_studies',
    'economics',
    // Humanities stream
    'history',
    'geography',
    'political_science',
    // Common
    'english',
    'language_optional',
  ],
};

export const ACADEMIC_BOARD_TYPES_LIST: readonly AcademicBoardType[] = [
  'cbse',
  'icse',
  'state',
  'ib',
  'other',
] as const;

export const ACADEMIC_GRADES_LIST: readonly AcademicGrade[] = [
  'A_plus',
  'A',
  'B_plus',
  'B',
  'C',
  'D',
  'F',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// DISPLAY LABELS — For UI rendering
// ─────────────────────────────────────────────────────────────────────────────

export const ACADEMIC_YEAR_LABELS: Record<AcademicYear, string> = {
  class_8:  'Class 8',
  class_9:  'Class 9',
  class_10: 'Class 10',
  class_11: 'Class 11',
  class_12: 'Class 12',
};

export const ACADEMIC_SUBJECT_LABELS: Record<AcademicSubject, string> = {
  mathematics:       'Mathematics',
  physics:           'Physics',
  chemistry:         'Chemistry',
  biology:           'Biology',
  computer_science:  'Computer Science',
  english:           'English',
  social_science:    'Social Science (SST)',
  economics:         'Economics',
  commerce:          'Commerce',
  accountancy:       'Accountancy',
  business_studies:  'Business Studies',
  history:           'History',
  geography:         'Geography',
  political_science: 'Political Science',
  language_optional: 'Hindi / Sanskrit / 2nd Language',
};

export const ACADEMIC_BOARD_LABELS: Record<AcademicBoardType, string> = {
  cbse:  'CBSE',
  icse:  'ICSE',
  state: 'State Board',
  ib:    'IB',
  other: 'Other',
};

export const ACADEMIC_GRADE_LABELS: Record<AcademicGrade, string> = {
  A_plus: 'A+ (90–100)',
  A:      'A  (80–89)',
  B_plus: 'B+ (70–79)',
  B:      'B  (60–69)',
  C:      'C  (50–59)',
  D:      'D  (40–49)',
  F:      'F  (Below 40)',
};

// ─────────────────────────────────────────────────────────────────────────────
// SUBJECT RESULT — Raw API shape (from backend response)
// ─────────────────────────────────────────────────────────────────────────────

export interface AcademicSubjectResult {
  id?:            string;
  subject:        AcademicSubject;
  marks_obtained: number | null;
  max_marks:      number | null;
  grade:          AcademicGrade | null;
  percentage:     number | null;
  source_type:    AcademicSourceType;
  is_predicted:   boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// ACADEMIC YEAR DATA — From API response
// ─────────────────────────────────────────────────────────────────────────────

export interface AcademicYearData {
  academic_year: AcademicYear;
  board_type:    AcademicBoardType;
  is_partial:    boolean;
  is_predicted:  boolean;
  subject_count: number;
  completed_at:  string | null;
  subjects:      AcademicSubjectResult[];
}

// ─────────────────────────────────────────────────────────────────────────────
// SIGNAL QUALITY — From API response
// ─────────────────────────────────────────────────────────────────────────────

export interface AcademicSignalQuality {
  is_sufficient:        boolean;
  committed_year_count: number;
  total_subject_count:  number;
}

// ─────────────────────────────────────────────────────────────────────────────
// API RESPONSE SHAPES
// ─────────────────────────────────────────────────────────────────────────────

export interface GetAcademicsResponse {
  ok:             true;
  academics:      { years: Record<string, AcademicYearData> };
  signal_quality: AcademicSignalQuality;
}

export interface SaveAcademicsResponse {
  ok:             true;
  academics:      { years: Record<string, AcademicYearData> };
  session:        { id: string; current_step: string };
  next_step:      string;
  signal_quality: AcademicSignalQuality;
}

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST PAYLOAD SHAPES (what the frontend sends)
// ─────────────────────────────────────────────────────────────────────────────

export interface SubjectMarksInput {
  subject:        AcademicSubject;
  marks_obtained: number | null;
  max_marks:      number | null;
  grade:          AcademicGrade | null;
  source_type:    AcademicSourceType;
  is_predicted:   boolean;
}

export interface AcademicYearInput {
  board_type:   AcademicBoardType;
  is_predicted: boolean;
  subjects:     SubjectMarksInput[];
}

export interface SaveAcademicsPayload {
  years:      Record<string, AcademicYearInput>;
  is_partial: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// FRONTEND STATE TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The local draft state for a single year — used in the AcademicsStep reducer.
 * Mirrors AcademicYearInput but includes UI-only fields.
 */
export interface AcademicYearDraft {
  academic_year:  AcademicYear;
  board_type:     AcademicBoardType;
  is_predicted:   boolean;
  subjects:       SubjectMarksInput[];
  /** UI only — has the user touched this year at all? */
  is_touched:     boolean;
  /** UI only — is this year's save in flight? */
  is_saving:      boolean;
  /** UI only — last save error for this year */
  save_error:     string | null;
}

/**
 * The full local academics draft state managed by useAcademicsStep.
 */
export interface AcademicsDraftState {
  years:           Record<AcademicYear, AcademicYearDraft>;
  active_year:     AcademicYear | null;
  is_submitting:   boolean;
  submit_error:    string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface AcademicYearProgress {
  academic_year:   AcademicYear;
  label:           string;
  subject_count:   number;
  is_partial:      boolean;
  is_complete:     boolean;
  /** True if this year has been touched in the current session (local only) */
  is_active:       boolean;
}

export interface AcademicProgressSummary {
  years:                AcademicYearProgress[];
  total_years_touched:  number;
  total_subjects_saved: number;
  signal_quality:       AcademicSignalQuality | null;
  can_advance:          boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// SNAPSHOT TYPES (privacy-safe — no marks, no grades)
// ─────────────────────────────────────────────────────────────────────────────

export interface AcademicSnapshotMetadata {
  year_count:       number;
  subject_count:    number;
  committed_years:  number;
  signal_quality:   Pick<AcademicSignalQuality, 'is_sufficient' | 'committed_year_count'>;
  /** INTENTIONALLY ABSENT: marks_obtained, max_marks, grade, percentage */
}