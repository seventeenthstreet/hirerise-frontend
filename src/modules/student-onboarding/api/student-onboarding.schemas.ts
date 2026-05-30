/**
 * @file src/modules/student-onboarding/api/student-onboarding.schemas.ts
 *
 * ZOD VALIDATION SCHEMAS
 * ──────────────────────
 * This file owns all input validation schemas for the student-onboarding API layer.
 *
 * ARCHITECTURE POSITION:
 *   Request Input → [THIS FILE: Zod parse] → student-onboarding.api.ts → Supabase
 *
 * WHY ZOD HERE (AND NOT JUST TYPESCRIPT):
 *   TypeScript types are erased at runtime. Any data that crosses the API boundary
 *   from React state → API function must be validated at runtime. Zod provides:
 *     1. Runtime validation with zero-cost inference (type = schema shape).
 *     2. Detailed parse errors with path + message for form field mapping.
 *     3. Safe .parse() (throws) and .safeParse() (returns Result) variants.
 *     4. `.transform()` to normalize inputs (e.g. null coercion for optional fields).
 *
 * PARALLEL VALIDATION CONTRACT:
 *   These schemas mirror the server-side validator (studentOnboarding.validator.js).
 *   They are NOT a replacement — server validation is authoritative and protects the DB.
 *   Client-side Zod schemas provide:
 *     - Fast feedback (no network round-trip for obvious errors)
 *     - Type inference for API function parameters
 *     - Defense against accidental data corruption before Supabase upserts
 *
 * ENUM ALIGNMENT:
 *   All enum arrays in this file must stay in sync with:
 *     - student-onboarding.types.ts (EDUCATION_LEVELS, BOARD_TYPES, SCHOOL_TYPES)
 *     - backend constants/index.js
 *     - SQL CHECK constraints in 20260518000001_student_onboarding_foundation.sql
 *
 * RULES:
 *  - DO NOT add business logic here. Schemas validate shape only.
 *  - DO NOT throw StudentOnboardingError from schemas. Callers decide error handling.
 *  - DO NOT import from lib/api/core. This file is infrastructure-agnostic.
 *  - DO export Zod inferred types where they are used as function parameter types.
 */

import { z } from 'zod';
import {
  EDUCATION_LEVELS,
  BOARD_TYPES,
  SCHOOL_TYPES,
  ONBOARDING_STEPS,
  COMPLETABLE_STEPS,
  type BoardType,
  type SchoolType,
} from './student-onboarding.types';

// ─────────────────────────────────────────────────────────────────────────────
// PRIMITIVE VALIDATORS
// Shared building blocks. Reuse in composite schemas to stay DRY.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates a Supabase Auth UUID (v4 UUID string).
 * Used to verify user IDs before passing them to Supabase queries.
 *
 * WHY NOT TRUST THE AUTH CONTEXT:
 *   The user ID is read from the Supabase session, but defensive validation
 *   ensures a malformed UUID never reaches a DB query where it might cause
 *   unexpected behavior or ambiguous error messages.
 */
export const userIdSchema = z
  .string()
  .uuid('User ID must be a valid UUID.');

/**
 * Validates an education level value.
 * Must be one of the EDUCATION_LEVELS constant values.
 *
 * ZOD v4: z.enum() requires a mutable array — spread the readonly tuple.
 * Custom messages use { error: string } — errorMap was removed in Zod v4.
 */
export const educationLevelSchema = z.enum(
  [...EDUCATION_LEVELS],
  { error: `Education level must be one of: ${EDUCATION_LEVELS.join(', ')}.` },
);

/**
 * Validates an optional board type value.
 * Accepts: a valid BOARD_TYPES value, null, or undefined.
 * Normalizes undefined → null for safe Supabase upsert behavior.
 *
 * WHY NORMALIZE TO NULL:
 *   Supabase distinguishes between `undefined` (field not included in upsert)
 *   and `null` (field explicitly set to NULL). For optional profile fields,
 *   we always want explicit NULL to avoid partial upserts that leave stale data.
 */
export const boardTypeSchema = z
  .enum(
    [...BOARD_TYPES],
    { error: `Board type must be one of: ${BOARD_TYPES.join(', ')}.` },
  )
  .nullable()
  .optional()
  .transform((val: BoardType | null | undefined): BoardType | null => val ?? null);

/**
 * Validates an optional school type value.
 * Same null-normalization behavior as boardTypeSchema.
 */
export const schoolTypeSchema = z
  .enum(
    [...SCHOOL_TYPES],
    { error: `School type must be one of: ${SCHOOL_TYPES.join(', ')}.` },
  )
  .nullable()
  .optional()
  .transform((val: SchoolType | null | undefined): SchoolType | null => val ?? null);

/**
 * Validates an onboarding step value.
 * Used to verify step transitions before committing them to the DB.
 */
export const onboardingStepSchema = z.enum(
  [...ONBOARDING_STEPS],
  { error: `Step must be one of: ${ONBOARDING_STEPS.join(', ')}.` },
);

/**
 * Validates a completable step value (excludes 'processing' and 'result').
 */
export const completableStepSchema = z.enum(
  [...COMPLETABLE_STEPS],
  { error: `Completable step must be one of: ${COMPLETABLE_STEPS.join(', ')}.` },
);

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSITE SCHEMAS
// One schema per API function that accepts user input.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schema for saveEducationProfile() input.
 *
 * Validates the payload a student submits when completing Step 1 (Education).
 *
 * VALIDATION RULES:
 *  - educationLevel: required, must be a valid class level.
 *  - boardType:      optional, must be a valid board if present.
 *  - schoolType:     optional, must be a valid school type if present.
 *
 * TRANSFORM:
 *  - Optional fields are normalized to null (not undefined) for Supabase compatibility.
 */
export const saveEducationProfileInputSchema = z.object({
  educationLevel: educationLevelSchema,
  boardType:      boardTypeSchema,
  schoolType:     schoolTypeSchema,
});

export type SaveEducationProfileInput = z.infer<typeof saveEducationProfileInputSchema>;

/**
 * Schema for updateOnboardingStep() input.
 *
 * Validates the step transition parameters before writing to Supabase.
 *
 * VALIDATION RULES:
 *  - completedStep: required, must be a completable step (not 'processing' or 'result').
 *  - nextStep:      required, must be a valid onboarding step.
 *
 * NOTE: Order validity (nextStep must follow completedStep) is enforced in
 * the API function using the ONBOARDING_STEPS order, not in this schema.
 * Schemas validate shape; business rules belong in the API function.
 */
export const updateOnboardingStepInputSchema = z.object({
  completedStep: completableStepSchema,
  nextStep:      onboardingStepSchema,
});

export type UpdateOnboardingStepInput = z.infer<typeof updateOnboardingStepInputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// DB ROW VALIDATORS
// Used to validate raw Supabase responses before normalizing them.
// These guard against contract drift between the DB schema and the client types.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates a raw Supabase row from student_onboarding_sessions.
 *
 * WHY VALIDATE DB RESPONSES:
 *   Supabase returns `unknown` typed data. Without validation, a schema migration
 *   that renames a column would silently produce undefined values in the app
 *   instead of a clear error. This validator catches schema drift early.
 *
 * STRICTNESS LEVEL:
 *   Uses .strip() behavior (default in Zod objects) — extra fields from future
 *   DB schema additions are silently ignored. This makes the client forward-compatible
 *   with new columns without requiring an immediate frontend update.
 */
export const dbOnboardingSessionRowSchema = z.object({
  id:              z.string().uuid(),
  user_id:         z.string().uuid(),
  current_step:    z.string().min(1),
  completed_steps: z.array(z.string()),
  is_complete:     z.boolean(),
  engine_version:  z.string(),
  created_at:      z.string(),
  updated_at:      z.string(),
});

/**
 * Validates a raw Supabase row from student_education_profiles.
 *
 * board_type and school_type are nullable — they may be NULL in the DB
 * if the student did not provide them.
 */
export const dbEducationProfileRowSchema = z.object({
  id:              z.string().uuid(),
  user_id:         z.string().uuid(),
  education_level: z.string().min(1),
  board_type:      z.string().nullable(),
  school_type:     z.string().nullable(),
  created_at:      z.string(),
  updated_at:      z.string(),
});

// ─────────────────────────────────────────────────────────────────────────────
// PARSE HELPERS
// Thin wrappers that convert ZodError → StudentOnboardingError.
// Only use these in student-onboarding.api.ts, not in hooks.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses input data against a Zod schema and returns the strongly-typed result.
 * Throws a plain Error with a human-readable message on failure.
 *
 * WHY THROW INSTEAD OF TUPLE RETURN:
 *   TypeScript cannot narrow a destructured tuple `[T | null, string | null]`
 *   via a conditional on the second element — the first element remains `T | null`
 *   even after `if (err) throw`. Throwing gives TypeScript a definitive
 *   control-flow assertion: after `parseOrThrow(...)`, the return is always `T`.
 *
 *   Callers in student-onboarding.api.ts wrap the thrown Error in a
 *   StudentOnboardingError inside a try/catch before re-throwing.
 *
 * @example
 * try {
 *   const input = parseOrThrow(saveEducationProfileInputSchema, rawInput);
 *   // input is SaveEducationProfileInput — no null check needed
 * } catch (err) {
 *   throw new StudentOnboardingError({ message: (err as Error).message, ... });
 * }
 */
export function parseOrThrow<T>(
  schema: z.ZodSchema<T>,
  data:   unknown,
): T {
  const result = schema.safeParse(data);

  if (result.success) {
    return result.data;
  }

  const firstIssue   = result.error.issues[0];
  const fieldPath    = firstIssue?.path.join('.') ?? 'unknown';
  const message      = firstIssue?.message ?? 'Validation failed.';
  const errorMessage = firstIssue?.path.length
    ? `${fieldPath}: ${message}`
    : message;

  throw new Error(errorMessage);
}