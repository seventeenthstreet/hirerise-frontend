/**
 * @file front/src/modules/student-onboarding/cognitive/api/cognitive.api.ts
 *
 * COGNITIVE STEP API CLIENT — Phase 3C
 * ──────────────────────────────────────
 * Thin HTTP client for all cognitive onboarding endpoints.
 * Uses fetch with credentials — no Axios dependency.
 *
 * CAMELCASE → SNAKE_CASE mapping happens here, at the API boundary.
 * Everything above (hooks, components) stays camelCase.
 * Everything below (backend) stays snake_case.
 *
 * All error handling is done by the hooks layer (not here).
 */

import type {
  BatchSaveResponsesInput,
  BatchSaveResponsesResponse,
  CommitCognitiveResponse,
  GetCognitiveStepResponse,
  SaveResponseInput,
  SaveResponseResponse,
} from '../types';

const BASE = '/api/v1/student-onboarding/v2/step/cognitive';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function parseOrThrow<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (body as { error?: { message?: string } })?.error?.message ??
        `Cognitive API error (${res.status})`,
    );
  }
  return body as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /step/cognitive
// Full step data: taxonomy (domains → questions → options), existing student
// responses, derived signals (if previously committed), and signal_quality.
// Safe to call on mount — supports full refresh recovery.
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchCognitiveStep(
  signal?: AbortSignal,
): Promise<GetCognitiveStepResponse> {
  const res = await fetch(BASE, {
    method:      'GET',
    credentials: 'include',
    signal,
  });
  return parseOrThrow<GetCognitiveStepResponse>(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /step/cognitive/response
// Persists a single question response immediately (progressive persistence).
// ─────────────────────────────────────────────────────────────────────────────

export async function saveResponse(
  input: SaveResponseInput,
  signal?: AbortSignal,
): Promise<SaveResponseResponse> {
  const res = await fetch(`${BASE}/response`, {
    method:      'POST',
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question_id:          input.questionId,
      selected_option_keys: input.selectedOptionKeys,
      is_partial:           input.isPartial ?? true,
    }),
    signal,
  });
  return parseOrThrow<SaveResponseResponse>(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /step/cognitive/responses/batch
// Saves multiple responses in a single request.
// ─────────────────────────────────────────────────────────────────────────────

export async function batchSaveResponses(
  input: BatchSaveResponsesInput,
  signal?: AbortSignal,
): Promise<BatchSaveResponsesResponse> {
  const res = await fetch(`${BASE}/responses/batch`, {
    method:      'POST',
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      responses: input.responses.map((r) => ({
        question_id:          r.questionId,
        selected_option_keys: r.selectedOptionKeys,
      })),
    }),
    signal,
  });
  return parseOrThrow<BatchSaveResponsesResponse>(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /step/cognitive/commit
// Validates signal sufficiency, extracts cognitive signals, and marks all
// responses as committed (is_partial = false).
// Does NOT advance the onboarding session — page.tsx advanceStep() does that.
// ─────────────────────────────────────────────────────────────────────────────

export async function commitCognitiveStep(
  signal?: AbortSignal,
): Promise<CommitCognitiveResponse> {
  const res = await fetch(`${BASE}/commit`, {
    method:      'POST',
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json' },
    body:        JSON.stringify({}),
    signal,
  });
  return parseOrThrow<CommitCognitiveResponse>(res);
}
