/**
 * @file front/src/modules/student-onboarding/activities/api/activities.api.ts
 *
 * ACTIVITIES STEP API CLIENT — Phase 3B
 * ──────────────────────────────────────
 * Thin HTTP client for all activities endpoints.
 * Uses fetch with credentials — no Axios dependency.
 *
 * All error handling is done by the hooks layer.
 * This module only makes requests and returns typed responses.
 */

import type {
  AddActivityInput,
  AddActivityResponse,
  AddAchievementInput,
  AddAchievementResponse,
  CommitActivitiesResponse,
  GetActivitiesResponse,
  SaveReflectionInput,
  SaveReflectionResponse,
  UpdateDepthInput,
  UpdateDepthResponse,
} from '../types';

const BASE = '/api/v1/student-onboarding/v2/step/activities';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function parseOrThrow<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (body as { error?: { message?: string } })?.error?.message ??
        `Activities API error (${res.status})`,
    );
  }
  return body as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET — full activities step data
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchActivities(
  signal?: AbortSignal,
): Promise<GetActivitiesResponse> {
  const res = await fetch(BASE, {
    method:      'GET',
    credentials: 'include',
    signal,
  });
  return parseOrThrow<GetActivitiesResponse>(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — add activity (immediately persists as partial)
// ─────────────────────────────────────────────────────────────────────────────

export async function addActivity(
  input: AddActivityInput,
  signal?: AbortSignal,
): Promise<AddActivityResponse> {
  const res = await fetch(`${BASE}/add`, {
    method:      'POST',
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json' },
    // Map camelCase → snake_case for the backend
    body: JSON.stringify({
      activity_key:      input.activityKey,
      activity_category: input.activityCategory,
      proficiency_level: input.proficiencyLevel ?? null,
      duration_months:   input.durationMonths   ?? null,
      weekly_frequency:  input.weeklyFrequency  ?? null,
      currently_active:  input.currentlyActive  ?? true,
      leadership_level:  input.leadershipLevel  ?? 'participant',
      is_partial:        input.isPartial         ?? true,
    }),
    signal,
  });
  return parseOrThrow<AddActivityResponse>(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT — update participation depth
// ─────────────────────────────────────────────────────────────────────────────

export async function updateActivityDepth(
  activityKey: string,
  input: UpdateDepthInput,
  signal?: AbortSignal,
): Promise<UpdateDepthResponse> {
  const res = await fetch(`${BASE}/${encodeURIComponent(activityKey)}/depth`, {
    method:      'PUT',
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      activity_category: input.activityCategory,
      proficiency_level: input.proficiencyLevel,
      duration_months:   input.durationMonths   ?? null,
      weekly_frequency:  input.weeklyFrequency  ?? null,
      currently_active:  input.currentlyActive,
      leadership_level:  input.leadershipLevel,
      is_partial:        input.isPartial,
    }),
    signal,
  });
  return parseOrThrow<UpdateDepthResponse>(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE — remove activity
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteActivity(
  activityKey: string,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${BASE}/${encodeURIComponent(activityKey)}`, {
    method:      'DELETE',
    credentials: 'include',
    signal,
  });
  await parseOrThrow<{ ok: boolean }>(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — add achievement
// ─────────────────────────────────────────────────────────────────────────────

export async function addAchievement(
  activityKey: string,
  input: AddAchievementInput,
  signal?: AbortSignal,
): Promise<AddAchievementResponse> {
  const res = await fetch(`${BASE}/${encodeURIComponent(activityKey)}/achievements`, {
    method:      'POST',
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      achievement_title:    input.achievementTitle,
      achievement_level:    input.achievementLevel,
      achievement_position: input.achievementPosition ?? null,
      achievement_year:     input.achievementYear     ?? null,
    }),
    signal,
  });
  return parseOrThrow<AddAchievementResponse>(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE — remove achievement
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteAchievement(
  achievementId: string,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${BASE}/achievements/${encodeURIComponent(achievementId)}`, {
    method:      'DELETE',
    credentials: 'include',
    signal,
  });
  await parseOrThrow<{ ok: boolean }>(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — save reflection (optional)
// ─────────────────────────────────────────────────────────────────────────────

export async function saveReflection(
  input: SaveReflectionInput,
  signal?: AbortSignal,
): Promise<SaveReflectionResponse> {
  const res = await fetch(`${BASE}/reflection`, {
    method:      'POST',
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      favorite_activity_key:     input.favoriteActivityKey    ?? null,
      pursue_seriously_key:      input.pursuesSeriouslyKey    ?? null,
      proudest_achievement_text: input.proudestAchievementText ?? null,
    }),
    signal,
  });
  return parseOrThrow<SaveReflectionResponse>(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — commit step (advance to 'cognitive')
// ─────────────────────────────────────────────────────────────────────────────

export async function commitActivities(
  signal?: AbortSignal,
): Promise<CommitActivitiesResponse> {
  const res = await fetch(`${BASE}/commit`, {
    method:      'POST',
    credentials: 'include',
    signal,
  });
  return parseOrThrow<CommitActivitiesResponse>(res);
}