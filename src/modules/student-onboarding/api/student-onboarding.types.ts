/**
 * @file src/modules/student-onboarding/api/student-onboarding.types.ts
 *
 * TYPE OWNERSHIP
 * ──────────────
 * This file is the SINGLE SOURCE OF TRUTH for all Student Onboarding
 * domain types in the frontend module.
 *
 * THREE-TIER TYPE ARCHITECTURE (aligned with lib/api/core/api-types.ts):
 *
 *   Tier 1 — DB Layer (Raw)
 *     Types that mirror the exact DB column names and shapes from Supabase.
 *     Used only within student-onboarding.api.ts — never in hooks or UI.
 *     Prefixed: Db*
 *
 *   Tier 2 — Domain Layer (Normalized)
 *     Client-safe types. DB column names translated to camelCase.
 *     These cross the API → Hook boundary.
 *     Supabase internals (id, user_id) are stripped.
 *     engine_version is intentionally exposed as engineVersion — it is a
 *     business-logic field required by the frontend Session Version Guard.
 *
 *   Tier 3 — Request/Response Models
 *     Input and output shapes for each API function.
 *     What hooks receive; what they pass as arguments.
 *
 * ENUM SAFETY CONTRACT
 * ────────────────────
 * All enum values mirror the SQL CHECK constraints in migration
 * 20260518000001_student_onboarding_foundation.sql and the backend
 * constants in src/modules/student-onboarding/constants/index.js.
 * If a constraint changes, update it here, in the schemas, AND in the migration.
 * Never diverge silently — TypeScript will guard the frontend, but the DB will
 * still accept/reject based on SQL constraints.
 *
 * DO NOT:
 *  - Import from lib/api/core directly (this module is self-contained at the type level)
 *  - Add Supabase client logic here (belongs in student-onboarding.api.ts)
 *  - Add UI state types here (belongs in hooks)
 */

// ─────────────────────────────────────────────────────────────────────────────
// ENUM CONSTANTS
// Must match: SQL CHECK constraints + backend constants/index.js
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valid education level values.
 *
 * Mirror of: student_education_profiles.education_level CHECK constraint.
 * Mirror of: backend EDUCATION_LEVELS constant.
 *
 * @contract NEVER remove values. Deprecate with a comment if a class is retired.
 */
export const EDUCATION_LEVELS = [
  'class_8',
  'class_9',
  'class_10',
  'class_11',
  'class_12',
] as const;

export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

/**
 * Valid board type values.
 *
 * Mirror of: student_education_profiles.board_type CHECK constraint.
 * Mirror of: backend BOARD_TYPES constant.
 */
export const BOARD_TYPES = [
  'cbse',
  'icse',
  'state',
  'ib',
  'other',
] as const;

export type BoardType = (typeof BOARD_TYPES)[number];

/**
 * Valid school type values.
 *
 * Mirror of: student_education_profiles.school_type CHECK constraint.
 * Mirror of: backend SCHOOL_TYPES constant.
 */
export const SCHOOL_TYPES = [
  'government',
  'private',
  'aided',
] as const;

export type SchoolType = (typeof SCHOOL_TYPES)[number];

/**
 * Full ordered step sequence.
 *
 * Mirror of: backend ONBOARDING_STEPS constant.
 * Mirror of: student_onboarding_sessions.current_step CHECK constraint.
 *
 * 'processing' and 'result' are system-driven navigation states,
 * not data-submission steps.
 */
export const ONBOARDING_STEPS = [
  'education',
  'academics',
  'activities',
  'cognitive',
  'aspiration',
  'processing',
  'result',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/**
 * Steps that require active data submission.
 * Excludes 'processing' and 'result' (system-driven states).
 *
 * Used for: completion percentage calculation, "is onboarding complete" guard.
 */
export const COMPLETABLE_STEPS = [
  'education',
  'academics',
  'activities',
  'cognitive',
  'aspiration',
] as const;

export type CompletableStep = (typeof COMPLETABLE_STEPS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// ACADEMICS STEP — SUBJECT CONSTANTS
// Used by academics-step.tsx (Step 2).
// Mirror of: backend CORE_SUBJECTS and SUBJECT_LABELS constants.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Core subjects assessed in the Academic Snapshot step.
 *
 * These are the subjects for which students rate their performance band.
 * Must stay in sync with backend constants/index.js CORE_SUBJECTS.
 */
export const CORE_SUBJECTS = [
  'mathematics',
  'science',
  'english',
  'social_science',
  'second_language',
] as const;

export type CoreSubject = (typeof CORE_SUBJECTS)[number];

/**
 * Human-readable display labels for each core subject.
 *
 * Used in the academics step UI to render subject names.
 */
export const SUBJECT_LABELS: Record<CoreSubject, string> = {
  mathematics:     'Mathematics',
  science:         'Science',
  english:         'English',
  social_science:  'Social Science',
  second_language: 'Second Language',
};

/**
 * Performance band values for subject self-assessment.
 *
 * Students rate each subject on this 4-point scale.
 * Must stay in sync with backend SUBJECT_PERFORMANCE_BANDS constant.
 */
export const SUBJECT_PERFORMANCE_BANDS = [
  'weak',
  'average',
  'strong',
  'excellent',
] as const;

export type SubjectPerformanceBand = (typeof SUBJECT_PERFORMANCE_BANDS)[number];

/**
 * A single subject's performance snapshot as captured in Step 2.
 *
 * @field current     The student's self-rated band for the current year.
 * @field previous    Optional prior-year comparison band (may be null if unknown).
 * @field confidence  How confident the student feels in this rating.
 */
export interface SubjectSnapshot {
  readonly current:    SubjectPerformanceBand;
  readonly previous:   SubjectPerformanceBand | null;
  readonly confidence: SubjectPerformanceBand;
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER 1 — DB LAYER (Raw)
// Exact mirror of Supabase table columns. Never exported from this module.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Raw row shape from `student_onboarding_sessions` table.
 *
 * @internal Used only in student-onboarding.api.ts.
 *           Do NOT use this type in hooks or UI.
 */
export interface DbOnboardingSession {
  readonly id:               string;
  readonly user_id:          string;
  readonly current_step:     string;
  readonly completed_steps:  string[];
  readonly is_complete:      boolean;
  readonly engine_version:   string;
  readonly created_at:       string;
  readonly updated_at:       string;
}

/**
 * Raw row shape from `student_education_profiles` table.
 *
 * @internal Used only in student-onboarding.api.ts.
 *           Do NOT use this type in hooks or UI.
 */
export interface DbEducationProfile {
  readonly id:              string;
  readonly user_id:         string;
  readonly education_level: string;
  readonly board_type:      string | null;
  readonly school_type:     string | null;
  readonly created_at:      string;
  readonly updated_at:      string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER 2 — DOMAIN LAYER (Normalized)
// Client-safe, camelCase. These types cross the API → Hook boundary.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalized onboarding session.
 *
 * Represents the user's current progress state.
 * Supabase internals (id, user_id) are stripped. Column names in camelCase.
 *
 * NOTE ON engineVersion:
 *   engine_version is intentionally included here (mapped from DbOnboardingSession).
 *   It is a business-logic field — not a Supabase internal — required by the
 *   frontend Session Version Guard to detect incompatible sessions after a deploy.
 *   @see features/student-onboarding/lib/version-guard.ts
 *
 * @sealed Do not extend. Add new fields to the interface when the DB schema changes.
 */
export interface OnboardingSession {
  /** The step the user should see next. */
  readonly currentStep:     OnboardingStep;
  /** Ordered array of completed step identifiers. Only grows — never shrinks. */
  readonly completedSteps:  CompletableStep[];
  /** Completion percentage 0–100 (computed from completedSteps). */
  readonly completionPct:   number;
  /** True when all COMPLETABLE_STEPS have been completed. */
  readonly isComplete:      boolean;
  /** ISO timestamp of last update. Useful for staleness detection. */
  readonly updatedAt:       string;
  /**
   * Engine version this session was created with.
   * Sourced from DbOnboardingSession.engine_version.
   * Used by the Session Version Guard to halt onboarding when the frontend
   * build cannot safely interpret a session created by a different backend version.
   * @see features/student-onboarding/lib/version-guard.ts → isSupportedSessionVersion()
   */
  readonly engineVersion:   string;
}

/**
 * Normalized education profile.
 *
 * Represents the student's educational background.
 * Supabase internals stripped. Column names in camelCase.
 */
export interface EducationProfile {
  readonly educationLevel: EducationLevel;
  readonly boardType:      BoardType | null;
  readonly schoolType:     SchoolType | null;
  /** ISO timestamp. Used to detect if a profile has been updated since last read. */
  readonly updatedAt:      string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER 3 — REQUEST / RESPONSE MODELS
// What hooks receive (response) and what they pass as args (request).
// ─────────────────────────────────────────────────────────────────────────────

// ── getOnboardingSession ─────────────────────────────────────────────────────

/**
 * Response from getOnboardingSession().
 * Returns the current session state for the authenticated user, or null
 * if no session has been created yet.
 */
export type GetOnboardingSessionResponse = OnboardingSession | null;

// ── createOnboardingSession ──────────────────────────────────────────────────

/**
 * Response from createOnboardingSession().
 * `created` is true when a new session was inserted;
 * false when an existing session was resumed.
 */
export interface CreateOnboardingSessionResponse {
  readonly session: OnboardingSession;
  readonly created: boolean;
}

// ── updateOnboardingStep ─────────────────────────────────────────────────────

/**
 * Input for updateOnboardingStep().
 *
 * @field completedStep  The step that was just completed.
 * @field nextStep       The step to advance to. Must be the next step in ONBOARDING_STEPS order.
 */
export interface UpdateOnboardingStepInput {
  readonly completedStep:  CompletableStep;
  readonly nextStep:       OnboardingStep;
}

/**
 * Response from updateOnboardingStep().
 * Returns the full updated session state so callers don't need a second fetch.
 */
export interface UpdateOnboardingStepResponse {
  readonly session: OnboardingSession;
}

// ── saveEducationProfile ─────────────────────────────────────────────────────

/**
 * Input for saveEducationProfile().
 *
 * `boardType` and `schoolType` are optional — some students may not have
 * this information available during initial onboarding.
 *
 * Validated by Zod schemas before reaching the Supabase layer.
 */
export interface SaveEducationProfileInput {
  readonly educationLevel: EducationLevel;
  readonly boardType?:     BoardType | null;
  readonly schoolType?:    SchoolType | null;
}

/**
 * Response from saveEducationProfile().
 *
 * Returns both the updated profile and the updated session state.
 * This allows hooks to update both caches in a single operation
 * without requiring a second round-trip.
 *
 * `nextStep` is the step the user should navigate to after this save.
 */
export interface SaveEducationProfileResponse {
  readonly profile:  EducationProfile;
  readonly session:  OnboardingSession;
  readonly nextStep: OnboardingStep;
}

// ── getEducationProfile ──────────────────────────────────────────────────────

/**
 * Response from getEducationProfile().
 * Returns the saved education profile, or null if not yet saved.
 */
export type GetEducationProfileResponse = EducationProfile | null;

// ─────────────────────────────────────────────────────────────────────────────
// ERROR TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Discriminated union of all error codes surfaced by this module's API layer.
 *
 * These codes are for logging and i18n key lookup only.
 * UI must branch on the `category` field of ApiClientError, not on these codes.
 *
 * WHY NOT BackendErrorCode:
 *   This module bypasses the REST API and calls Supabase directly.
 *   There is no backend HTTP server to emit BackendErrorCode values.
 *   StudentOnboardingErrorCode is a parallel, Supabase-client-specific registry.
 */
export const StudentOnboardingErrorCode = {
  // Auth
  UNAUTHENTICATED:              'STUDENT_ONBOARDING_UNAUTHENTICATED',
  // Session errors
  SESSION_NOT_FOUND:            'STUDENT_ONBOARDING_SESSION_NOT_FOUND',
  SESSION_CREATE_FAILED:        'STUDENT_ONBOARDING_SESSION_CREATE_FAILED',
  SESSION_FETCH_FAILED:         'STUDENT_ONBOARDING_SESSION_FETCH_FAILED',
  SESSION_UPDATE_FAILED:        'STUDENT_ONBOARDING_SESSION_UPDATE_FAILED',
  // Education profile errors
  EDUCATION_PROFILE_NOT_FOUND:  'STUDENT_ONBOARDING_EDUCATION_PROFILE_NOT_FOUND',
  EDUCATION_PROFILE_SAVE_FAILED: 'STUDENT_ONBOARDING_EDUCATION_PROFILE_SAVE_FAILED',
  EDUCATION_PROFILE_FETCH_FAILED: 'STUDENT_ONBOARDING_EDUCATION_PROFILE_FETCH_FAILED',
  // Progression errors
  INVALID_STEP_TRANSITION:      'STUDENT_ONBOARDING_INVALID_STEP_TRANSITION',
  PROGRESSION_REGRESSION:       'STUDENT_ONBOARDING_PROGRESSION_REGRESSION',
  // Validation errors
  VALIDATION_FAILED:            'STUDENT_ONBOARDING_VALIDATION_FAILED',
} as const;

export type StudentOnboardingErrorCode =
  (typeof StudentOnboardingErrorCode)[keyof typeof StudentOnboardingErrorCode];

/**
 * Normalized error thrown by this module's API layer.
 *
 * DESIGN NOTE:
 *   This module calls Supabase directly (not via the REST API + ApiClient).
 *   Therefore it cannot throw ApiClientError (which requires an HTTP status code
 *   and is tied to the Axios pipeline). Instead, it throws StudentOnboardingError,
 *   which has a compatible shape for the hook layer to handle uniformly.
 *
 *   Hooks that consume this API should catch StudentOnboardingError and map it
 *   to UI state using `error.category`, just like they would with ApiClientError.
 */
export class StudentOnboardingError extends Error {
  public readonly code:     StudentOnboardingErrorCode;
  public readonly category: 'auth' | 'not_found' | 'validation' | 'conflict' | 'server';
  public readonly details:  Record<string, unknown> | null;

  constructor(params: {
    message:  string;
    code:     StudentOnboardingErrorCode;
    category: 'auth' | 'not_found' | 'validation' | 'conflict' | 'server';
    details?: Record<string, unknown> | null;
  }) {
    super(params.message);
    this.name     = 'StudentOnboardingError';
    this.code     = params.code;
    this.category = params.category;
    this.details  = params.details ?? null;

    // Restore prototype chain — required in compiled TypeScript classes
    // that extend built-ins (Error, Map, Set, etc.).
    Object.setPrototypeOf(this, StudentOnboardingError.prototype);
  }
}

/**
 * Type guard for StudentOnboardingError.
 *
 * Usage in hooks:
 *   if (isStudentOnboardingError(error)) {
 *     switch (error.category) { ... }
 *   }
 */
export function isStudentOnboardingError(err: unknown): err is StudentOnboardingError {
  return err instanceof StudentOnboardingError;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI / SCORING ENGINE READINESS TYPES
// These types are forward-declarations for the AI scoring engine integration
// (Phase 3+). They are typed here so the API layer can be extended without
// breaking the hook layer when the AI engine ships.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Metadata attached to every completed onboarding session for the AI engine.
 *
 * The scoring engine reads this payload to:
 *  1. Verify the session has the minimum data completeness for scoring.
 *  2. Route the session to the correct engine version (engine_version).
 *  3. Build the scoring context (educationLevel → stream suggestions).
 *
 * @future This type will be extended with aspiration and cognitive data
 *   as those steps are implemented in Phase 2B and Phase 2C.
 */
export interface OnboardingScoringPayload {
  /** Supabase Auth UID. Used as the scoring context key. */
  readonly userId:         string;
  /** Engine version to use for this session. */
  readonly engineVersion:  string;
  /** The education profile captured in Step 1. */
  readonly educationProfile: EducationProfile | null;
  /** Ordered list of completed steps. Used to verify data completeness. */
  readonly completedSteps: CompletableStep[];
  /** True when all completable steps are done. The engine only scores complete sessions. */
  readonly isComplete:     boolean;
}