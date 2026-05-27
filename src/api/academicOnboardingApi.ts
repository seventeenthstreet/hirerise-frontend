/**
 * src/api/academicOnboardingApi.ts
 *
 * ACADEMIC ONBOARDING — API REPOSITORY
 * ──────────────────────────────────────
 * The ONLY file where Supabase RPC calls for academic onboarding live.
 * All functions return typed RpcResult<T>.
 *
 * LIVE RPCs (Phase 2 / 2B):
 *  - fn_create_student_academic_profile(...)
 *  - fn_get_student_full_profile()
 *  - fn_save_student_subjects(p_subject_ids)
 *  - fn_save_student_languages(p_medium_language_ids, p_additional_language_ids)
 *  - fn_complete_academic_onboarding()
 *
 * REPLAY SAFETY:
 *  The backend RPCs are designed to be idempotent — calling them multiple times
 *  with the same payload produces the same result. The `was_replay` flag in
 *  create/complete responses lets the UI distinguish first-run from resume.
 *
 * ARCHITECTURE POSITION:
 *   [THIS FILE] ← only Supabase RPC calls for onboarding
 *   hooks/mutations/* ← import from here
 *   hooks/queries/useStudentAcademicProfile ← imports getStudentFullProfile
 *
 * GOVERNANCE:
 *  ❌ No React imports.
 *  ❌ No React Query imports.
 *  ❌ No business logic.
 *  ✅ All calls instrumented via executeRpc.
 */

import { getSupabaseClient } from '@/lib/supabase/client';
import { executeRpc } from '../hooks/utils/rpcExecutor';
import type { RpcResult } from '../hooks/types/rpcEnvelope.types';
import type {
  StudentFullProfile,
  CreateAcademicProfilePayload,
  CreateAcademicProfileResult,
  SaveSubjectsPayload,
  SaveSubjectsResult,
  SaveLanguagesPayload,
  SaveLanguagesResult,
  CompleteOnboardingResult,
} from '../hooks/types/onboarding.types';

// ─────────────────────────────────────────────────────────────────────────────
// CREATE PROFILE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates (or replaces) the student's academic profile.
 * Idempotent — safe to call again if onboarding is replayed from the start.
 *
 * RPC: fn_create_student_academic_profile(
 *   p_country_code, p_region_code, p_board_code,
 *   p_stream_code, p_stream_id, p_class_level
 * )
 */
export async function createAcademicProfile(
  payload: CreateAcademicProfilePayload,
): Promise<RpcResult<CreateAcademicProfileResult>> {
  const client = getSupabaseClient();
  return executeRpc<CreateAcademicProfileResult>(
    client,
    'fn_create_student_academic_profile',
    {
      p_country_code: payload.country_code.toUpperCase(),
      p_region_code:  payload.region_code.toUpperCase(),
      p_board_code:   payload.board_code.toUpperCase(),
      p_stream_code:  payload.stream_code.toUpperCase(),
      p_stream_id:    payload.stream_id,
      p_class_level:  payload.class_level,
    },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GET FULL PROFILE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches the complete academic profile for the currently authenticated student.
 * Returns profile + subjects + languages + onboarding_status + is_complete.
 *
 * RPC: fn_get_student_full_profile()
 * Auth: uses current Supabase session — no userId param needed (RLS-scoped).
 */
export async function getStudentFullProfile(): Promise<RpcResult<StudentFullProfile>> {
  const client = getSupabaseClient();
  return executeRpc<StudentFullProfile>(client, 'fn_get_student_full_profile');
}

// ─────────────────────────────────────────────────────────────────────────────
// SAVE SUBJECTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Saves the student's subject selections.
 * Replaces any existing selection — not additive.
 * Idempotent: calling with the same IDs produces the same result.
 *
 * RPC: fn_save_student_subjects(p_subject_ids UUID[])
 */
export async function saveStudentSubjects(
  payload: SaveSubjectsPayload,
): Promise<RpcResult<SaveSubjectsResult>> {
  const client = getSupabaseClient();
  return executeRpc<SaveSubjectsResult>(
    client,
    'fn_save_student_subjects',
    { p_subject_ids: payload.subject_ids },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SAVE LANGUAGES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Saves the student's language selections (medium + additional).
 * Replaces any existing selection — not additive.
 * Idempotent: safe to call multiple times.
 *
 * RPC: fn_save_student_languages(
 *   p_medium_language_ids UUID[],
 *   p_additional_language_ids UUID[]
 * )
 */
export async function saveStudentLanguages(
  payload: SaveLanguagesPayload,
): Promise<RpcResult<SaveLanguagesResult>> {
  const client = getSupabaseClient();
  return executeRpc<SaveLanguagesResult>(
    client,
    'fn_save_student_languages',
    {
      p_medium_language_ids:     payload.medium_language_ids,
      p_additional_language_ids: payload.additional_language_ids,
    },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETE ONBOARDING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Marks the academic onboarding as complete for the current student.
 * Idempotent — replay-safe. Returns `was_replay: true` if already completed.
 *
 * RPC: fn_complete_academic_onboarding()
 * Precondition: profile + subjects + languages must be saved first.
 */
export async function completeAcademicOnboarding(): Promise<
  RpcResult<CompleteOnboardingResult>
> {
  const client = getSupabaseClient();
  return executeRpc<CompleteOnboardingResult>(
    client,
    'fn_complete_academic_onboarding',
  );
}
