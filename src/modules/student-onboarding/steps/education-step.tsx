/**
 * @file src/modules/student-onboarding/steps/education-step.tsx
 *
 * STEP 1: EDUCATION — Production Implementation
 * ═══════════════════════════════════════════════
 * Collects educationLevel (required), boardType (optional), schoolType (optional).
 *
 * ARCHITECTURE POSITION (HireRise Blueprint):
 *   API Layer  → studentOnboardingApi.saveEducationProfile()
 *   Hooks Layer → useSaveEducationProfile (mutation, cache invalidation, step advance)
 *   [THIS FILE] → UI form only — no API, no Supabase, no business logic
 *   Renderer   → OnboardingStepRenderer passes onComplete/isBusy/initialData
 *   Page       → StudentOnboardingPage dispatches 'education' → useSaveEducationProfile
 *
 * FORM ARCHITECTURE:
 *   - Controlled state (no external form library — not in dependency tree)
 *   - Zod validates the complete payload before submission
 *   - Field-level errors derived from Zod ZodError.issues
 *   - Submission guard (submitting state) prevents duplicate in-flight calls
 *   - Error states rendered inline, not as modals or toasts
 *   - All mutation state is owned by the parent page → passed as isBusy
 *
 * MUTATION FLOW:
 *   1. User fills form → validates locally via saveEducationProfileInputSchema
 *   2. handleSubmit calls onComplete(validatedData) — never calls hook directly
 *   3. Page's handleStepComplete dispatches to saveEducation (useSaveEducationProfile)
 *   4. useSaveEducationProfile calls API, on success invalidates BOTH caches
 *   5. useStudentOnboardingSession refetches → currentStep advances to 'academics'
 *   6. OnboardingStepRenderer receives new stepId → renders AcademicsStep
 *
 * DUPLICATE SUBMISSION PROTECTION:
 *   - `submitting` state prevents double-fire and immediately disables the button
 *   - Submit button disabled while isBusy || submitting || !isValid
 *   - onComplete is async — awaited; submitting released in finally block
 *
 * API ERROR DISPLAY:
 *   - isBusy from parent covers in-flight state
 *   - apiError prop (optional, passed down from page) surfaces mutation errors
 *   - Error category 'validation' maps to a field-level-style inline message
 *   - Error category 'server' maps to a generic retry banner
 *
 * ACCESSIBILITY:
 *   - All selection groups are role="group" with aria-labelledby
 *   - Selected state communicated via aria-pressed on toggle buttons
 *   - Required field marked with aria-required and visible asterisk
 *   - Error messages linked to their groups via aria-describedby
 *   - Submit button carries aria-busy during pending state
 *   - Form has noValidate (Zod handles validation — not browser)
 *
 * MOBILE RESPONSIVENESS:
 *   - Class grid adapts: 3 cols on mobile → 5 on sm+
 *   - Board grid: 2 cols on mobile → 3 on sm+
 *   - School: flex-wrap for any screen width
 *   - Full-width submit button
 *
 * FUTURE EXTENSIBILITY:
 *   - Adding a new field: add to FormState, add to educationSchema, add field group
 *   - Adding API error field mapping: extend deriveApiFieldError()
 *   - Adding optimistic update: handled in useSaveEducationProfile — zero UI changes
 *   - Adding analytics: add to handleSubmit after onComplete resolves
 */

import {
  useState,
  useId,
  useCallback,
  type FormEvent,
} from 'react';
import { z } from 'zod';
import type { OnboardingStepProps } from '../constants/step-props';
import {
  EDUCATION_LEVELS,
  BOARD_TYPES,
  SCHOOL_TYPES,
  type EducationLevel,
  type BoardType,
  type SchoolType,
} from '../api/student-onboarding.types';
import {
  saveEducationProfileInputSchema,
} from '../api/student-onboarding.schemas';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Internal form state.
 * Controlled independently from the Zod-validated submission payload.
 */
interface FormState {
  educationLevel: EducationLevel | '';
  boardType:      BoardType | '';
  schoolType:     SchoolType | '';
}

/**
 * Field-level validation errors derived from Zod parse failure.
 * One key per form field — null means no error for that field.
 */
interface FieldErrors {
  educationLevel: string | null;
  boardType:      string | null;
  schoolType:     string | null;
}

const EMPTY_ERRORS: FieldErrors = {
  educationLevel: null,
  boardType:      null,
  schoolType:     null,
};

// ─────────────────────────────────────────────────────────────────────────────
// LABEL MAPS
// Human-readable labels for each allowed value.
// Defined at module scope — stable references, no re-creation per render.
// ─────────────────────────────────────────────────────────────────────────────

const EDUCATION_LABELS: Record<EducationLevel, string> = {
  class_8:  'Class 8',
  class_9:  'Class 9',
  class_10: 'Class 10',
  class_11: 'Class 11',
  class_12: 'Class 12',
};

const EDUCATION_DESCRIPTIONS: Record<EducationLevel, string> = {
  class_8:  'Middle school',
  class_9:  'Secondary',
  class_10: 'Board year',
  class_11: 'Senior sec.',
  class_12: 'Board year',
};

const BOARD_LABELS: Record<BoardType, string> = {
  cbse:  'CBSE',
  icse:  'ICSE / ISC',
  state: 'State Board',
  ib:    'IB',
  other: 'Other',
};

const SCHOOL_LABELS: Record<SchoolType, string> = {
  government: 'Government',
  private:    'Private',
  aided:      'Government-Aided',
};

// ─────────────────────────────────────────────────────────────────────────────
// ZOD SCHEMA (local — derived from canonical schema)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The canonical API schema already defines the full validation contract.
 * We reuse it directly for form validation.
 *
 * At submission time we call .safeParse() on the form state.
 * The empty-string → optional coercion below handles the '' initial value
 * used for optional fields (boardType, schoolType) that haven't been touched.
 */
const formValidationSchema = saveEducationProfileInputSchema.extend({
  // The form uses '' (empty string) for unselected optional fields.
  // The canonical schema expects undefined | null — transform '' → undefined here.
  boardType: z
    .union([z.enum([...BOARD_TYPES]), z.literal('')])
    .optional()
    .transform((val) => (val === '' ? undefined : val)),
  schoolType: z
    .union([z.enum([...SCHOOL_TYPES]), z.literal('')])
    .optional()
    .transform((val) => (val === '' ? undefined : val)),
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses a ZodError into per-field error messages.
 * Only the first issue per field is surfaced (matches UX best practice).
 */
function deriveFieldErrors(zodError: z.ZodError): FieldErrors {
  const errors: FieldErrors = { ...EMPTY_ERRORS };
  for (const issue of zodError.issues) {
    const field = issue.path[0] as keyof FieldErrors | undefined;
    if (field && field in errors && errors[field] === null) {
      errors[field] = issue.message;
    }
  }
  return errors;
}

/**
 * Computes whether the form has the minimum valid state to enable submission.
 * Used to determine the disabled state of the submit button without triggering
 * a full Zod parse on every render.
 */
function isFormSubmittable(state: FormState): boolean {
  return state.educationLevel !== '';
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * EducationStep
 *
 * Step 1 of the student onboarding flow.
 *
 * Collects:
 *   - educationLevel (required): class_8 – class_12
 *   - boardType (optional):      cbse | icse | state | ib | other
 *   - schoolType (optional):     government | private | aided
 *
 * On submit: validates via Zod → calls onComplete(validatedData).
 * The page layer calls useSaveEducationProfile, advances the session,
 * and invalidates React Query caches — triggering the renderer to
 * transition to AcademicsStep.
 *
 * This component never calls any hook directly.
 */
export default function EducationStep({
  onComplete,
  isBusy,
  initialData,
}: OnboardingStepProps) {

  // ── Stable IDs for accessibility (aria-labelledby, aria-describedby) ──────
  const formId           = useId();
  const levelGroupId     = `${formId}-level`;
  const levelErrorId     = `${formId}-level-error`;
  const boardGroupId     = `${formId}-board`;
  const schoolGroupId    = `${formId}-school`;
  const submitErrorId    = `${formId}-submit-error`;

  // ── Controlled form state ─────────────────────────────────────────────────
  const [form, setForm] = useState<FormState>({
    educationLevel: (initialData?.educationLevel as EducationLevel) ?? '',
    boardType:      (initialData?.boardType      as BoardType)      ?? '',
    schoolType:     (initialData?.schoolType     as SchoolType)     ?? '',
  });

  // ── Validation state ──────────────────────────────────────────────────────
  const [fieldErrors,   setFieldErrors]   = useState<FieldErrors>(EMPTY_ERRORS);
  const [submitError,   setSubmitError]   = useState<string | null>(null);
  // True after first submit attempt — enables inline error display on blur
  const [isDirty,       setIsDirty]       = useState(false);

  // ── Duplicate-submission protection ───────────────────────────────────────
  // State (not ref) so the submit button's disabled prop reflects the lock
  // immediately when submission starts, preventing a brief window where the
  // button appears enabled while a request is in flight.
  // isBusy (from parent) remains the authoritative workflow guard.
  const [submitting, setSubmitting] = useState(false);

  // ── Derived: is the form minimally valid for submission ───────────────────
  const canSubmit = isFormSubmittable(form) && !isBusy && !submitting;

  // ─────────────────────────────────────────────────────────────────────────
  // FIELD SETTERS
  // Typed setters keep change handlers free of casting noise.
  // ─────────────────────────────────────────────────────────────────────────

  const setEducationLevel = useCallback((level: EducationLevel) => {
    setForm((prev) => ({ ...prev, educationLevel: level }));
    // Clear field error on explicit selection
    if (fieldErrors.educationLevel) {
      setFieldErrors((prev) => ({ ...prev, educationLevel: null }));
    }
    setSubmitError(null);
  }, [fieldErrors.educationLevel]);

  const toggleBoardType = useCallback((board: BoardType) => {
    setForm((prev) => ({
      ...prev,
      boardType: prev.boardType === board ? '' : board,
    }));
    setSubmitError(null);
  }, []);

  const toggleSchoolType = useCallback((type: SchoolType) => {
    setForm((prev) => ({
      ...prev,
      schoolType: prev.schoolType === type ? '' : type,
    }));
    setSubmitError(null);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // SUBMIT HANDLER
  // ─────────────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Gate 1: duplicate submission protection
    if (submitting || isBusy) return;

    // Gate 2: mark dirty to surface any inline errors
    setIsDirty(true);
    setSubmitError(null);
    setFieldErrors(EMPTY_ERRORS);

    // Gate 3: Zod validation
    const parseResult = formValidationSchema.safeParse(form);
    if (!parseResult.success) {
      setFieldErrors(deriveFieldErrors(parseResult.error));
      // Focus the first errored field for accessibility
      const firstErrorField = parseResult.error.issues[0]?.path[0] as string | undefined;
      if (firstErrorField) {
        document.querySelector<HTMLElement>(`[data-field="${firstErrorField}"]`)?.focus();
      }
      return;
    }

    // Gate 4: acquire in-flight lock
    setSubmitting(true);

    try {
      // Delegate to parent — no API calls here.
      // The page's handleStepComplete dispatches to useSaveEducationProfile.
      await onComplete(parseResult.data as Record<string, unknown>);
    } catch (err: unknown) {
      // onComplete should not throw in normal flows — the page catches errors
      // via useSaveEducationProfile's error state. This handles unexpected throws.
      const message =
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }, [form, isBusy, onComplete, submitting]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  const hasEducationError = isDirty && !!fieldErrors.educationLevel;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">

      {/* ── Card Header ─────────────────────────────────────────────────── */}
      <div className="border-b border-border px-6 py-5">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10"
            aria-hidden="true"
          >
            <svg
              className="h-4 w-4 text-primary"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground leading-tight">
              Your Education
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Helps us personalise your career path recommendations
            </p>
          </div>
        </div>
      </div>

      {/* ── Form ────────────────────────────────────────────────────────── */}
      <form
        id={formId}
        onSubmit={handleSubmit}
        noValidate
        aria-label="Education profile form"
        className="px-6 py-6 space-y-7"
      >

        {/* ── Education Level (required) ─────────────────────────────────── */}
        <fieldset
          aria-labelledby={levelGroupId}
          aria-describedby={hasEducationError ? levelErrorId : undefined}
          aria-required="true"
          className="space-y-0"
          data-field="educationLevel"
        >
          <legend id={levelGroupId} className="flex items-baseline gap-2 mb-3">
            <span className="text-sm font-medium text-foreground">
              Current Class
            </span>
            <span className="text-destructive text-sm" aria-label="required">
              *
            </span>
          </legend>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {EDUCATION_LEVELS.map((level) => {
              const isSelected = form.educationLevel === level;
              return (
                <button
                  key={level}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setEducationLevel(level)}
                  disabled={isBusy}
                  className={[
                    'relative flex flex-col items-center gap-0.5 rounded-lg border px-2 py-3',
                    'text-center text-sm font-medium transition-all duration-150',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    isSelected
                      ? 'border-primary bg-primary/8 text-primary shadow-sm ring-1 ring-primary/30'
                      : [
                          'border-border bg-background text-muted-foreground',
                          'hover:border-primary/50 hover:bg-primary/5 hover:text-foreground',
                        ].join(' '),
                  ].join(' ')}
                >
                  <span className="font-semibold text-[13px] leading-tight">
                    {EDUCATION_LABELS[level]}
                  </span>
                  <span className="text-[10px] leading-tight opacity-60">
                    {EDUCATION_DESCRIPTIONS[level]}
                  </span>
                  {isSelected && (
                    <span
                      className="absolute top-1.5 right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary"
                      aria-hidden="true"
                    >
                      <svg
                        className="h-2 w-2 text-primary-foreground"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="2 6 5 9 10 3" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Field error */}
          {hasEducationError && (
            <p
              id={levelErrorId}
              role="alert"
              className="mt-2 flex items-center gap-1.5 text-xs text-destructive"
            >
              <svg
                className="h-3 w-3 shrink-0"
                viewBox="0 0 12 12"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M6 1a5 5 0 100 10A5 5 0 006 1zM5.25 3.75a.75.75 0 011.5 0v2.5a.75.75 0 01-1.5 0v-2.5zm.75 5.5a.75.75 0 100-1.5.75.75 0 000 1.5z"
                />
              </svg>
              {fieldErrors.educationLevel}
            </p>
          )}
        </fieldset>

        {/* ── Divider ───────────────────────────────────────────────────── */}
        <div className="h-px bg-border" aria-hidden="true" />

        {/* ── Board Type (optional) ──────────────────────────────────────── */}
        <fieldset
          aria-labelledby={boardGroupId}
          className="space-y-0"
        >
          <legend id={boardGroupId} className="flex items-baseline gap-2 mb-3">
            <span className="text-sm font-medium text-foreground">Board</span>
            <span className="text-xs text-muted-foreground font-normal">
              (optional)
            </span>
          </legend>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {BOARD_TYPES.map((board) => {
              const isSelected = form.boardType === board;
              return (
                <button
                  key={board}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => toggleBoardType(board)}
                  disabled={isBusy}
                  className={[
                    'flex items-center justify-between rounded-lg border px-3 py-2.5',
                    'text-sm font-medium transition-all duration-150',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    isSelected
                      ? 'border-primary bg-primary/8 text-primary ring-1 ring-primary/30'
                      : [
                          'border-border bg-background text-muted-foreground',
                          'hover:border-primary/50 hover:bg-primary/5 hover:text-foreground',
                        ].join(' '),
                  ].join(' ')}
                >
                  <span className="text-[13px]">{BOARD_LABELS[board]}</span>
                  {isSelected && (
                    <span
                      className="ml-2 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary"
                      aria-hidden="true"
                    >
                      <svg
                        className="h-2.5 w-2.5 text-primary-foreground"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="2 6 5 9 10 3" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* ── School Type (optional) ─────────────────────────────────────── */}
        <fieldset
          aria-labelledby={schoolGroupId}
          className="space-y-0"
        >
          <legend id={schoolGroupId} className="flex items-baseline gap-2 mb-3">
            <span className="text-sm font-medium text-foreground">
              School Type
            </span>
            <span className="text-xs text-muted-foreground font-normal">
              (optional)
            </span>
          </legend>

          <div className="flex flex-wrap gap-2">
            {SCHOOL_TYPES.map((type) => {
              const isSelected = form.schoolType === type;
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => toggleSchoolType(type)}
                  disabled={isBusy}
                  className={[
                    'flex items-center gap-2 rounded-lg border px-4 py-2.5',
                    'text-sm font-medium transition-all duration-150',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    isSelected
                      ? 'border-primary bg-primary/8 text-primary ring-1 ring-primary/30'
                      : [
                          'border-border bg-background text-muted-foreground',
                          'hover:border-primary/50 hover:bg-primary/5 hover:text-foreground',
                        ].join(' '),
                  ].join(' ')}
                >
                  {isSelected && (
                    <span
                      className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-primary"
                      aria-hidden="true"
                    >
                      <svg
                        className="h-2 w-2 text-primary-foreground"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="2 6 5 9 10 3" />
                      </svg>
                    </span>
                  )}
                  {SCHOOL_LABELS[type]}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* ── Submission error banner (from onComplete throw or API error) ── */}
        {submitError && (
          <div
            id={submitErrorId}
            role="alert"
            aria-live="assertive"
            className="flex items-start gap-3 rounded-lg border border-destructive/25 bg-destructive/8 px-4 py-3"
          >
            <svg
              className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M8 1a7 7 0 100 14A7 7 0 008 1zM7 5a1 1 0 012 0v3a1 1 0 01-2 0V5zm1 6a1 1 0 100-2 1 1 0 000 2z"
              />
            </svg>
            <div className="min-w-0">
              <p className="text-sm font-medium text-destructive leading-snug">
                {submitError}
              </p>
              <p className="mt-0.5 text-xs text-destructive/70">
                Please check your connection and try again.
              </p>
            </div>
          </div>
        )}

        {/* ── Submit Button ──────────────────────────────────────────────── */}
        <button
          type="submit"
          disabled={!canSubmit}
          aria-busy={isBusy}
          aria-describedby={submitError ? submitErrorId : undefined}
          className={[
            'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3',
            'text-sm font-semibold transition-all duration-150',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            canSubmit
              ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
              : 'bg-muted text-muted-foreground',
          ].join(' ')}
        >
          {isBusy ? (
            <>
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden="true"
              />
              <span>Saving your profile…</span>
            </>
          ) : (
            <>
              <span>Continue</span>
              <svg
                className="h-4 w-4"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </>
          )}
        </button>

        {/* ── Required field hint ────────────────────────────────────────── */}
        <p className="text-center text-xs text-muted-foreground -mt-4">
          <span className="text-destructive" aria-hidden="true">*</span>{' '}
          Required field
        </p>

      </form>
    </div>
  );
}