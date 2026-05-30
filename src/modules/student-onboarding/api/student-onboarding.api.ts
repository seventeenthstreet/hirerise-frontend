/**
 * @file src/modules/student-onboarding/api/student-onboarding.api.ts
 *
 * STUDENT ONBOARDING API LAYER
 * ────────────────────────────
 * This is the DB access layer for the Student Onboarding module.
 *
 * ARCHITECTURE POSITION (HireRise Blueprint):
 *   Supabase Client (lib/supabase/client.ts)
 *     ↓
 *   [THIS FILE: DB queries, normalization, error handling]
 *     ↓
 *   Hooks (useStudentOnboardingSession, useEducationProfile, ...)
 *     ↓
 *   UI / Pages
 *
 * STRICT RULES:
 *  ✅  All Supabase calls live here — NEVER in hooks or UI components.
 *  ✅  All raw DB types are normalized to domain types before returning.
 *  ✅  All errors are normalized to StudentOnboardingError before throwing.
 *  ✅  All inputs are validated with Zod before reaching Supabase.
 *  ✅  Authentication is checked before every mutation.
 *  ✅  Upsert operations are idempotent — safe to call multiple times.
 *  ❌  No React imports. No hooks. No useState/useEffect.
 *  ❌  No try/catch suppression — all errors propagate to the hook layer.
 *  ❌  No business logic (step completion rules live in helpers, not here).
 *
 * ONE SESSION PER USER CONTRACT:
 *   student_onboarding_sessions has a UNIQUE(user_id) constraint.
 *   createOnboardingSession() uses upsert logic (fetch-first, insert-if-missing).
 *   getOnboardingSession() returns null for users with no session — never throws.
 *
 * PROGRESSION INTEGRITY:
 *   updateOnboardingStep() validates that nextStep is a valid forward transition.
 *   Steps can only advance, never regress. The completed_steps array only grows.
 *   If a step is already completed, it is idempotently preserved (not duplicated).
 *
 * UPSERT SAFETY:
 *   saveEducationProfile() uses Supabase upsert with onConflict: 'user_id'.
 *   This ensures exactly one profile per user and makes the operation safe
 *   to call multiple times (e.g. the user goes back and edits Step 1).
 */



import { getSupabaseClient } from '@/lib/supabase/client';
import {
  StudentOnboardingError,
  StudentOnboardingErrorCode,
  ONBOARDING_STEPS,
  COMPLETABLE_STEPS,
  type DbOnboardingSession,
  type DbEducationProfile,
  type OnboardingSession,
  type EducationProfile,
  type EducationLevel,
  type BoardType,
  type SchoolType,
  type OnboardingStep,
  type CompletableStep,
  type GetOnboardingSessionResponse,
  type CreateOnboardingSessionResponse,
  type UpdateOnboardingStepInput,
  type UpdateOnboardingStepResponse,
  type SaveEducationProfileInput,
  type SaveEducationProfileResponse,
  type GetEducationProfileResponse,
} from './student-onboarding.types';
import {
  saveEducationProfileInputSchema,
  updateOnboardingStepInputSchema,
  dbOnboardingSessionRowSchema,
  dbEducationProfileRowSchema,
  parseOrThrow,
} from './student-onboarding.schemas';
import { logOnboardingEvent } from '@/features/student-onboarding/lib/onboarding-diagnostics';

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_TABLE  = 'student_onboarding_sessions'  as const;
const PROFILE_TABLE  = 'student_education_profiles'    as const;
const ENGINE_VERSION = '1.0.0'                         as const;

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retrieves the authenticated user's ID from the Supabase session.
 * Throws StudentOnboardingError(UNAUTHENTICATED) if no session exists.
 *
 * WHY NOT ACCEPT userId AS A PARAM:
 *   Accepting a userId parameter would allow callers to pass an arbitrary
 *   user ID, bypassing the Supabase Auth session check. By reading the
 *   user ID from the live session here, we guarantee:
 *     1. The operation is always scoped to the authenticated user.
 *     2. RLS policies on the DB side get a matching auth.uid().
 *     3. Unauthenticated callers are rejected before any DB query runs.
 *
 * @internal Used by all API functions in this file.
 */
async function requireAuthUserId(): Promise<string> {
  const supabase = getSupabaseClient();
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session?.user?.id) {
    throw new StudentOnboardingError({
      message:  'You must be signed in to access your onboarding session.',
      code:     StudentOnboardingErrorCode.UNAUTHENTICATED,
      category: 'auth',
    });
  }

  return session.user.id;
}

/**
 * Internal variant of getOnboardingSession that accepts a pre-resolved userId.
 * Used inside _saveEducationProfileImpl to avoid redundant getSession() calls
 * that can transiently fail between token refresh windows.
 * @internal
 */
async function _getOnboardingSessionForUser(userId: string): Promise<GetOnboardingSessionResponse> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SESSION_TABLE)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle<DbOnboardingSession>();

  if (error) {
    throw new StudentOnboardingError({
      message:  'Failed to retrieve your onboarding session. Please try again.',
      code:     StudentOnboardingErrorCode.SESSION_FETCH_FAILED,
      category: 'server',
      details:  { supabaseCode: error.code, supabaseMessage: error.message },
    });
  }

  if (!data) return null;
  return normalizeSession(data);
}

/**
 * Internal variant of createOnboardingSession that accepts a pre-resolved userId.
 * Avoids a redundant getSession() call inside _saveEducationProfileImpl.
 * @internal
 */
async function _createOnboardingSessionForUser(userId: string): Promise<CreateOnboardingSessionResponse> {
  const supabase = getSupabaseClient();

  const { data: existing, error: fetchError } = await supabase
    .from(SESSION_TABLE)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle<DbOnboardingSession>();

  if (fetchError) {
    console.error('[_createOnboardingSessionForUser] fetch error:', fetchError.code, fetchError.message);
    throw new StudentOnboardingError({
      message:  'Failed to check for an existing onboarding session.',
      code:     StudentOnboardingErrorCode.SESSION_FETCH_FAILED,
      category: 'server',
      details:  { supabaseCode: fetchError.code, supabaseMessage: fetchError.message },
    });
  }

  if (existing) {
    return { session: normalizeSession(existing), created: false };
  }

  const { data: created, error: insertError } = await supabase
    .from(SESSION_TABLE)
    .insert({
      user_id:         userId,
      current_step:    'education' satisfies OnboardingStep,
      completed_steps: [] as string[],
      is_complete:     false,
      engine_version:  ENGINE_VERSION,
    })
    .select('*')
    .single<DbOnboardingSession>();

  if (insertError) {
    if (insertError.code === '23505') {
      const { data: raceData, error: raceError } = await supabase
        .from(SESSION_TABLE)
        .select('*')
        .eq('user_id', userId)
        .maybeSingle<DbOnboardingSession>();

      if (raceError || !raceData) {
        throw new StudentOnboardingError({
          message:  'Failed to create your onboarding session. Please refresh and try again.',
          code:     StudentOnboardingErrorCode.SESSION_CREATE_FAILED,
          category: 'server',
          details:  { supabaseCode: insertError.code },
        });
      }

      return { session: normalizeSession(raceData), created: false };
    }

    throw new StudentOnboardingError({
      message:  'Failed to create your onboarding session. Please try again.',
      code:     StudentOnboardingErrorCode.SESSION_CREATE_FAILED,
      category: 'server',
      details:  { supabaseCode: insertError.code, supabaseMessage: insertError.message },
    });
  }

  return { session: normalizeSession(created), created: true };
}

/**
 * Internal variant of updateOnboardingStep that accepts a pre-resolved userId.
 * Avoids a redundant getSession() call inside _saveEducationProfileImpl.
 * @internal
 */
async function _updateOnboardingStepForUser(
  userId:    string,
  input:     UpdateOnboardingStepInput,
): Promise<UpdateOnboardingStepResponse> {
  let validInput: ReturnType<typeof updateOnboardingStepInputSchema.parse>;
  try {
    validInput = parseOrThrow(updateOnboardingStepInputSchema, input);
  } catch (err) {
    throw new StudentOnboardingError({
      message:  `Invalid step transition: ${(err as Error).message}`,
      code:     StudentOnboardingErrorCode.VALIDATION_FAILED,
      category: 'validation',
      details:  { input },
    });
  }

  const transitionErr = validateStepTransition(validInput.completedStep, validInput.nextStep);
  if (transitionErr) {
    throw new StudentOnboardingError({
      message:  transitionErr,
      code:     StudentOnboardingErrorCode.INVALID_STEP_TRANSITION,
      category: 'validation',
      details:  { completedStep: validInput.completedStep, nextStep: validInput.nextStep },
    });
  }

  const supabase = getSupabaseClient();

  const { data: current, error: fetchError } = await supabase
    .from(SESSION_TABLE)
    .select('completed_steps, is_complete')
    .eq('user_id', userId)
    .maybeSingle<Pick<DbOnboardingSession, 'completed_steps' | 'is_complete'>>();

  if (fetchError || !current) {
    throw new StudentOnboardingError({
      message:  'Onboarding session not found. Please start a new session.',
      code:     StudentOnboardingErrorCode.SESSION_NOT_FOUND,
      category: fetchError ? 'server' : 'not_found',
      details:  fetchError
        ? { supabaseCode: fetchError.code, supabaseMessage: fetchError.message }
        : null,
    });
  }

  const newCompletedSteps = addCompletedStep(current.completed_steps, validInput.completedStep);
  const nowComplete       = isOnboardingComplete(newCompletedSteps);

  const { data: updated, error: updateError } = await supabase
    .from(SESSION_TABLE)
    .update({
      current_step:    validInput.nextStep,
      completed_steps: newCompletedSteps,
      is_complete:     nowComplete,
    })
    .eq('user_id', userId)
    .select('*')
    .single<DbOnboardingSession>();

  if (updateError) {
    throw new StudentOnboardingError({
      message:  'Failed to update your onboarding progress. Please try again.',
      code:     StudentOnboardingErrorCode.SESSION_UPDATE_FAILED,
      category: 'server',
      details:  { supabaseCode: updateError.code, supabaseMessage: updateError.message },
    });
  }

  return { session: normalizeSession(updated) };
}

/**
 * Calculates the completion percentage based on completedSteps.
 *
 * Uses COMPLETABLE_STEPS.length as the denominator — not ONBOARDING_STEPS,
 * because 'processing' and 'result' are system-driven states that do not
 * count toward the user's progress percentage.
 *
 * Returns 0 for empty arrays. Never returns NaN or values outside [0, 100].
 */
function calculateCompletionPct(completedSteps: string[]): number {
  if (!completedSteps.length) return 0;
  const pct = (completedSteps.length / COMPLETABLE_STEPS.length) * 100;
  return Math.min(100, Math.round(pct));
}

/**
 * Determines whether the user has completed all completable steps.
 *
 * Uses set intersection to check all COMPLETABLE_STEPS are present —
 * order-independent and safe against duplicates in the array.
 */
function isOnboardingComplete(completedSteps: string[]): boolean {
  const completedSet = new Set(completedSteps);
  return COMPLETABLE_STEPS.every((step) => completedSet.has(step));
}

/**
 * Adds a step to the completedSteps array if not already present.
 * Returns a new array (immutable). Preserves order.
 */
function addCompletedStep(
  existing:      string[],
  stepToAdd:     CompletableStep,
): CompletableStep[] {
  const set = new Set(existing);
  set.add(stepToAdd);
  // Preserve the canonical step order from COMPLETABLE_STEPS
  return COMPLETABLE_STEPS.filter((step) => set.has(step));
}

/**
 * Validates that the proposed step transition is a valid forward move.
 *
 * Rules:
 *  - nextStep must come after completedStep in ONBOARDING_STEPS order.
 *  - 'processing' and 'result' are valid nextStep targets (system states).
 *  - Advancing to an earlier step is rejected (PROGRESSION_REGRESSION).
 *
 * Returns an error message string if invalid, null if valid.
 */
function validateStepTransition(
  completedStep: string,
  nextStep:      string,
): string | null {
  const completedIndex = ONBOARDING_STEPS.indexOf(completedStep as OnboardingStep);
  const nextIndex      = ONBOARDING_STEPS.indexOf(nextStep as OnboardingStep);

  if (completedIndex === -1) {
    return `Unknown step: "${completedStep}".`;
  }
  if (nextIndex === -1) {
    return `Unknown next step: "${nextStep}".`;
  }
  if (nextIndex <= completedIndex) {
    return `Step transition regression: cannot move from "${completedStep}" to "${nextStep}". Steps can only advance.`;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZERS
// Translate raw DB rows → typed domain objects.
// The ONLY place where column names are translated to camelCase.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalizes a raw student_onboarding_sessions row to an OnboardingSession domain object.
 *
 * @throws {StudentOnboardingError} If the row fails schema validation (DB contract drift).
 * @internal
 */
function normalizeSession(raw: unknown): OnboardingSession {
  let row: ReturnType<typeof dbOnboardingSessionRowSchema.parse>;
  try {
    row = parseOrThrow(dbOnboardingSessionRowSchema, raw);
  } catch (err) {
    throw new StudentOnboardingError({
      message:  `Onboarding session data is malformed: ${(err as Error).message}`,
      code:     StudentOnboardingErrorCode.SESSION_FETCH_FAILED,
      category: 'server',
      details:  { raw },
    });
  }

  const completedSteps = (row.completed_steps as string[]).filter(
    (s): s is CompletableStep => (COMPLETABLE_STEPS as readonly string[]).includes(s),
  );

  const engineVersion = row.engine_version;

  // ── Dev diagnostic — verify engine_version normalization ───────────────────
  // Confirms engine_version has flowed from DB → normalizeSession correctly,
  // BEFORE the Version Guard runs isSupportedSessionVersion().
  // logOnboardingEvent is a no-op in production (env-aware by design).
  if (process.env.NODE_ENV !== 'production') {
    logOnboardingEvent({
      event:     'session_version_received',
      severity:  'info',
      timestamp: new Date().toISOString(),
      metadata: {
        engineVersion,
        supportedVersions: [ENGINE_VERSION],
        isCompatible:      engineVersion === ENGINE_VERSION,
      },
    });
  }

  return {
    currentStep:    row.current_step as OnboardingStep,
    completedSteps,
    completionPct:  calculateCompletionPct(completedSteps),
    isComplete:     row.is_complete,
    updatedAt:      row.updated_at,
    engineVersion,
  };
}

/**
 * Normalizes a raw student_education_profiles row to an EducationProfile domain object.
 *
 * @throws {StudentOnboardingError} If the row fails schema validation.
 * @internal
 */
function normalizeEducationProfile(raw: unknown): EducationProfile {
  let row: ReturnType<typeof dbEducationProfileRowSchema.parse>;
  try {
    row = parseOrThrow(dbEducationProfileRowSchema, raw);
  } catch (err) {
    throw new StudentOnboardingError({
      message:  `Education profile data is malformed: ${(err as Error).message}`,
      code:     StudentOnboardingErrorCode.EDUCATION_PROFILE_FETCH_FAILED,
      category: 'server',
      details:  { raw },
    });
  }

  return {
    educationLevel: row.education_level as EducationLevel,
    boardType:      (row.board_type as BoardType | null) ?? null,
    schoolType:     (row.school_type as SchoolType | null) ?? null,
    updatedAt:      row.updated_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// API FUNCTIONS
// Public surface of this module. Consumed exclusively by hooks.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retrieves the authenticated user's onboarding session.
 *
 * Returns null if no session exists yet.
 * Throws StudentOnboardingError on auth failure or DB error.
 *
 * HOOK USAGE:
 *   useQuery({
 *     queryKey: studentOnboardingQueryKeys.session(userId),
 *     queryFn:  () => studentOnboardingApi.getOnboardingSession(),
 *   })
 *
 * @returns The current session state, or null if no session exists.
 * @throws {StudentOnboardingError} On auth failure or DB error.
 */
export async function getOnboardingSession(): Promise<GetOnboardingSessionResponse> {
  const userId   = await requireAuthUserId();
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from(SESSION_TABLE)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle<DbOnboardingSession>();

  if (error) {
    throw new StudentOnboardingError({
      message:  'Failed to retrieve your onboarding session. Please try again.',
      code:     StudentOnboardingErrorCode.SESSION_FETCH_FAILED,
      category: 'server',
      details:  { supabaseCode: error.code, supabaseMessage: error.message },
    });
  }

  if (!data) {
    return null;
  }

  return normalizeSession(data);
}

/**
 * Creates a new onboarding session or resumes an existing one.
 *
 * Implements "fetch-first, insert-if-missing" pattern:
 *   1. Attempts to SELECT the existing session.
 *   2. If none exists, INSERTs a fresh session starting at 'education'.
 *   3. Returns { session, created: true/false }.
 *
 * WHY NOT UPSERT:
 *   Supabase upsert on UNIQUE conflicts would reset completed_steps to []
 *   on re-entry. The fetch-first pattern preserves the user's progress
 *   and only creates a new row when genuinely needed.
 *
 * IDEMPOTENT: Safe to call on every app boot or page load.
 *
 * @returns { session: OnboardingSession, created: boolean }
 * @throws {StudentOnboardingError} On auth failure or DB error.
 */
export async function createOnboardingSession(): Promise<CreateOnboardingSessionResponse> {
  const userId   = await requireAuthUserId();
  const supabase = getSupabaseClient();

  // 1. Check for existing session first
  const { data: existing, error: fetchError } = await supabase
    .from(SESSION_TABLE)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle<DbOnboardingSession>();

  if (fetchError) {
    throw new StudentOnboardingError({
      message:  'Failed to check for an existing onboarding session.',
      code:     StudentOnboardingErrorCode.SESSION_FETCH_FAILED,
      category: 'server',
      details:  { supabaseCode: fetchError.code, supabaseMessage: fetchError.message },
    });
  }

  if (existing) {
    return {
      session: normalizeSession(existing),
      created: false,
    };
  }

  // 2. No existing session — create a fresh one
  const { data: created, error: insertError } = await supabase
    .from(SESSION_TABLE)
    .insert({
      user_id:         userId,
      current_step:    'education' satisfies OnboardingStep,
      completed_steps: [] as string[],
      is_complete:     false,
      engine_version:  ENGINE_VERSION,
    })
    .select('*')
    .single<DbOnboardingSession>();

  if (insertError) {
    // Handle race condition: another tab/request created the session concurrently.
    // Supabase returns a unique constraint violation code '23505'.
    if (insertError.code === '23505') {
      // Re-fetch the session that was just created by the concurrent request.
      const { data: raceData, error: raceError } = await supabase
        .from(SESSION_TABLE)
        .select('*')
        .eq('user_id', userId)
        .maybeSingle<DbOnboardingSession>();

      if (raceError || !raceData) {
        throw new StudentOnboardingError({
          message:  'Failed to create your onboarding session. Please refresh and try again.',
          code:     StudentOnboardingErrorCode.SESSION_CREATE_FAILED,
          category: 'server',
          details:  { supabaseCode: insertError.code },
        });
      }

      return {
        session: normalizeSession(raceData),
        created: false, // Was created by the concurrent request — return as resumed
      };
    }

    throw new StudentOnboardingError({
      message:  'Failed to create your onboarding session. Please try again.',
      code:     StudentOnboardingErrorCode.SESSION_CREATE_FAILED,
      category: 'server',
      details:  { supabaseCode: insertError.code, supabaseMessage: insertError.message },
    });
  }

  return {
    session: normalizeSession(created),
    created: true,
  };
}

/**
 * Advances the onboarding session to the next step.
 *
 * Called by step-specific API functions (e.g. saveEducationProfile) after
 * successfully persisting step data. Should NOT be called directly from hooks.
 *
 * PROGRESSION GUARANTEES:
 *  1. Validates that nextStep is a valid forward transition from completedStep.
 *  2. Adds completedStep to completed_steps (idempotent — no duplicates).
 *  3. Updates current_step to nextStep.
 *  4. Sets is_complete = true when all COMPLETABLE_STEPS are done.
 *  5. Returns the normalized, updated session state.
 *
 * @param input.completedStep  The step just completed (e.g. 'education').
 * @param input.nextStep       The step to navigate to (e.g. 'academics').
 * @throws {StudentOnboardingError} On validation failure, auth failure, or DB error.
 */
export async function updateOnboardingStep(
  input: UpdateOnboardingStepInput,
): Promise<UpdateOnboardingStepResponse> {
  // 1. Validate input shape
  let validInput: ReturnType<typeof updateOnboardingStepInputSchema.parse>;
  try {
    validInput = parseOrThrow(updateOnboardingStepInputSchema, input);
  } catch (err) {
    throw new StudentOnboardingError({
      message:  `Invalid step transition: ${(err as Error).message}`,
      code:     StudentOnboardingErrorCode.VALIDATION_FAILED,
      category: 'validation',
      details:  { input },
    });
  }

  // 2. Validate step transition direction
  const transitionErr = validateStepTransition(validInput.completedStep, validInput.nextStep);
  if (transitionErr) {
    throw new StudentOnboardingError({
      message:  transitionErr,
      code:     StudentOnboardingErrorCode.INVALID_STEP_TRANSITION,
      category: 'validation',
      details:  { completedStep: validInput.completedStep, nextStep: validInput.nextStep },
    });
  }

  const userId   = await requireAuthUserId();
  const supabase = getSupabaseClient();

  // 3. Read the current session to get the authoritative completed_steps array.
  //    We never trust the caller to provide the full completed steps list.
  const { data: current, error: fetchError } = await supabase
    .from(SESSION_TABLE)
    .select('completed_steps, is_complete')
    .eq('user_id', userId)
    .maybeSingle<Pick<DbOnboardingSession, 'completed_steps' | 'is_complete'>>();

  if (fetchError || !current) {
    throw new StudentOnboardingError({
      message:  'Onboarding session not found. Please start a new session.',
      code:     StudentOnboardingErrorCode.SESSION_NOT_FOUND,
      category: fetchError ? 'server' : 'not_found',
      details:  fetchError
        ? { supabaseCode: fetchError.code, supabaseMessage: fetchError.message }
        : null,
    });
  }

  // 4. Compute the new completed steps array (immutably, with deduplication)
  const newCompletedSteps = addCompletedStep(current.completed_steps, validInput.completedStep);
  const nowComplete       = isOnboardingComplete(newCompletedSteps);

  // 5. Persist the progression update
  const { data: updated, error: updateError } = await supabase
    .from(SESSION_TABLE)
    .update({
      current_step:    validInput.nextStep,
      completed_steps: newCompletedSteps,
      is_complete:     nowComplete,
    })
    .eq('user_id', userId)
    .select('*')
    .single<DbOnboardingSession>();

  if (updateError) {
    console.error('[_updateOnboardingStepForUser] update error:', updateError.code, updateError.message, updateError.hint);
    throw new StudentOnboardingError({
      message:  'Failed to update your onboarding progress. Please try again.',
      code:     StudentOnboardingErrorCode.SESSION_UPDATE_FAILED,
      category: 'server',
      details:  { supabaseCode: updateError.code, supabaseMessage: updateError.message },
    });
  }

  return {
    session: normalizeSession(updated),
  };
}

/**
 * Saves (or updates) the student's education profile, then advances the session.
 *
 * This is an atomic two-step operation:
 *   1. Upsert the education profile (student_education_profiles).
 *   2. Advance the session to the 'academics' step (student_onboarding_sessions).
 *
 * If step 1 succeeds but step 2 fails:
 *   The profile is saved but the session step is not advanced.
 *   The user can retry — the upsert will overwrite the same profile row safely.
 *   This is a deliberate trade-off: profile data is never lost due to session failures.
 *
 * IDEMPOTENT: Safe to call multiple times (user editing Step 1 data).
 *   Each call overwrites the previous profile and re-advances the session.
 *
 * @param rawInput  Education data from the Step 1 form.
 * @returns { profile, session, nextStep }
 * @throws {StudentOnboardingError} On validation failure, auth failure, or DB error.
 */
export async function saveEducationProfile(
  rawInput: SaveEducationProfileInput,
): Promise<SaveEducationProfileResponse> {
  // ── Outer safety net: normalise any non-StudentOnboardingError that escapes ──
  // In normal operation, every throw inside this function is already a
  // StudentOnboardingError. This wrapper catches anything unexpected
  // (e.g. a network-level Error, a Supabase SDK regression, a Zod v4
  // schema change that bypasses our parseOrThrow wrapper) and re-throws it
  // as a typed StudentOnboardingError so the hook layer never sees raw errors.
  try {
    return await _saveEducationProfileImpl(rawInput);
  } catch (err) {
    if (err instanceof StudentOnboardingError) throw err; // already typed — pass through
    throw new StudentOnboardingError({
      message:  err instanceof Error ? err.message : 'An unexpected error occurred while saving your education profile.',
      code:     StudentOnboardingErrorCode.EDUCATION_PROFILE_SAVE_FAILED,
      category: 'server',
      details:  { originalError: err instanceof Error ? err.message : String(err) },
    });
  }
}

async function _saveEducationProfileImpl(
  rawInput: SaveEducationProfileInput,
): Promise<SaveEducationProfileResponse> {
  // 1. Validate and normalize input
  let input: ReturnType<typeof saveEducationProfileInputSchema.parse>;
  try {
    input = parseOrThrow(saveEducationProfileInputSchema, rawInput);
  } catch (err) {
    throw new StudentOnboardingError({
      message:  `Education profile validation failed: ${(err as Error).message}`,
      code:     StudentOnboardingErrorCode.VALIDATION_FAILED,
      category: 'validation',
      details:  { rawInput },
    });
  }

  // 2. Resolve userId ONCE here — reused by all subsequent operations.
  //    Previously, requireAuthUserId() was called independently inside
  //    createOnboardingSession() and updateOnboardingStep(), each firing a
  //    separate supabase.auth.getSession() call. Between token refresh windows,
  //    getSession() can transiently return null even for authenticated users.
  //    When that happened, the second or third call would throw UNAUTHENTICATED,
  //    which was caught by the outer safety net and re-wrapped as a generic
  //    EDUCATION_PROFILE_SAVE_FAILED 'server' error — losing the auth category
  //    and making it appear as a Supabase DB error in the console.
  //
  //    Fix: call getSession() exactly once, upfront, before any DB work.
  //    Pass userId to the internal _*ForUser helpers so they skip getSession().
  const userId   = await requireAuthUserId();
  const supabase = getSupabaseClient();

  // 3. Upsert the education profile
  const { data: profileData, error: upsertError } = await supabase
    .from(PROFILE_TABLE)
    .upsert(
      {
        user_id:         userId,
        education_level: input.educationLevel,
        board_type:      input.boardType,
        school_type:     input.schoolType,
      },
      { onConflict: 'user_id' },
    )
    .select('*')
    .single<DbEducationProfile>();

  if (upsertError) {
    // Log the raw Supabase error so it's visible in DevTools regardless of wrapping
    console.error('[saveEducationProfile] Supabase upsert error:', {
      code:    upsertError.code,
      message: upsertError.message,
      details: upsertError.details,
      hint:    upsertError.hint,
    });
    throw new StudentOnboardingError({
      message:  'Failed to save your education details. Please try again.',
      code:     StudentOnboardingErrorCode.EDUCATION_PROFILE_SAVE_FAILED,
      category: 'server',
      details:  { supabaseCode: upsertError.code, supabaseMessage: upsertError.message },
    });
  }

  // 4. Ensure session row exists before advancing it (idempotent, fetch-first).
  //    Uses the userId-scoped helper to avoid a redundant getSession() call.
  await _createOnboardingSessionForUser(userId);

  // 5. Advance the session step using the userId-scoped helper.
  const nextStep: OnboardingStep = 'academics';
  const { session } = await _updateOnboardingStepForUser(userId, {
    completedStep: 'education',
    nextStep,
  });

  // 6. Normalize and return both the profile and updated session
  const profile = normalizeEducationProfile(profileData);

  return {
    profile,
    session,
    nextStep,
  };
}

/**
 * Retrieves the authenticated user's saved education profile.
 *
 * Returns null if the user has not yet completed Step 1 (Education).
 * Callers must handle the null case — do not assume a profile always exists.
 *
 * HOOK USAGE:
 *   useQuery({
 *     queryKey: studentOnboardingQueryKeys.educationProfile(userId),
 *     queryFn:  () => studentOnboardingApi.getEducationProfile(),
 *   })
 *
 * @returns The saved education profile, or null if not yet completed.
 * @throws {StudentOnboardingError} On auth failure or DB error.
 */
export async function getEducationProfile(): Promise<GetEducationProfileResponse> {
  const userId   = await requireAuthUserId();
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from(PROFILE_TABLE)
    .select('education_level, board_type, school_type, updated_at')
    .eq('user_id', userId)
    .maybeSingle<Pick<DbEducationProfile, 'education_level' | 'board_type' | 'school_type' | 'updated_at'>>();

  if (error) {
    throw new StudentOnboardingError({
      message:  'Failed to retrieve your education profile. Please try again.',
      code:     StudentOnboardingErrorCode.EDUCATION_PROFILE_FETCH_FAILED,
      category: 'server',
      details:  { supabaseCode: error.code, supabaseMessage: error.message },
    });
  }

  if (!data) {
    return null;
  }

  // Augment the partial row with stub fields for the normalizer
  return normalizeEducationProfile({
    id:         '',
    user_id:    userId,
    created_at: '',
    ...data,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// NAMED EXPORT OBJECT
// Mirrors the `onboardingApi` pattern from lib/api/endpoints/onboarding.ts.
// Hooks import from this object, not individual function imports.
// This makes the module swappable and mockable in tests.
// ─────────────────────────────────────────────────────────────────────────────

export const studentOnboardingApi = {
  getOnboardingSession,
  createOnboardingSession,
  updateOnboardingStep,
  saveEducationProfile,
  getEducationProfile,
} as const;