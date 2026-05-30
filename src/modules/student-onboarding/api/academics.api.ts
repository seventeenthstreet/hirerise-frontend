/**
 * front/src/modules/student-onboarding/api/academics.api.ts
 *
 * ACADEMIC STEP API CLIENT
 * ─────────────────────────
 * Thin HTTP client for the two academics endpoints.
 * Uses the same fetch wrapper pattern as the existing onboarding API.
 *
 * All error handling is done by the hooks layer — this module only
 * makes requests and returns typed responses.
 *
 * AUTH NOTE:
 *   The backend auth middleware ONLY accepts Authorization: Bearer <token>.
 *   It does NOT read session cookies. getAccessToken() is called before every
 *   request to attach the current Supabase JWT — same pattern as the Axios
 *   interceptor in lib/api/core/api-client.ts.
 */

import { getAccessToken } from '@/lib/supabase/client';
import type {
  GetAcademicsResponse,
  SaveAcademicsPayload,
  SaveAcademicsResponse,
} from '@/features/student-onboarding/lib/academic.types';

const BASE = '/api/v1/student-onboarding/v2/step/academics';

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the Authorization header from the current Supabase session token.
 * Returns an empty object if no token is available — the backend will 401
 * and the hook's retry predicate will not retry auth failures.
 */
async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─────────────────────────────────────────────────────────────────────────────
// GET — fetch saved academic history
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches the student's saved academic history and current signal quality.
 *
 * @throws {Error} on non-ok HTTP response
 */
export async function fetchAcademics(signal?: AbortSignal): Promise<GetAcademicsResponse> {
  const res = await fetch(BASE, {
    method:      'GET',
    credentials: 'include',
    headers:     await authHeaders(),
    signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Failed to fetch academics (${res.status})`);
  }

  return res.json() as Promise<GetAcademicsResponse>;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — save academic year data
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Saves (upserts) academic year data.
 * Partial saves (is_partial: true) do not advance the session.
 * Commit saves (is_partial: false) advance to 'activities' if signal is sufficient.
 *
 * @throws {Error} on non-ok HTTP response or validation error
 */
export async function saveAcademics(
  payload: SaveAcademicsPayload,
  signal?: AbortSignal,
): Promise<SaveAcademicsResponse> {
  const res = await fetch(BASE, {
    method:      'POST',
    credentials: 'include',
    headers:     {
      'Content-Type': 'application/json',
      ...await authHeaders(),
    },
    body:        JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Failed to save academics (${res.status})`);
  }

  return res.json() as Promise<SaveAcademicsResponse>;
}