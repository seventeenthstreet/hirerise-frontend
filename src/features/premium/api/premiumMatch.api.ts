/**
 * @file src/features/premium/api/premiumMatch.api.ts
 * @description API wrappers for the WP-13B Premium Match endpoints.
 *
 * RULES:
 *  - All requests via apiRequest<T>() — no raw fetch, no axios direct calls
 *  - NO UI, NO business logic, NO state — pure transport
 *  - No hardcoded URLs — paths are string literals matching backend routes
 *  - Reuses existing auth flow (token attached by apiRequest/axiosInstance)
 *
 * Architecture position: API layer (first tier)
 *   API → Hooks → Components → Pages
 */

import { apiRequest } from '@/lib/api/core';
import type { MatchResult } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface TriggerPremiumMatchParams {
  resumeId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// API FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/premium/match
 *
 * Triggers a new premium match analysis for the given resumeId.
 * Deducts credits from the user's account.
 * Returns the full MatchResult including score, breakdown, skill gaps,
 * explanation, and actionable insights.
 *
 * @throws {ApiClientError} 402 when credits are insufficient.
 * @throws {ApiClientError} 404 when the resume is not found.
 */
export async function triggerPremiumMatch(
  params: TriggerPremiumMatchParams,
  signal?: AbortSignal,
): Promise<MatchResult> {
  return apiRequest<MatchResult>({
    method: 'POST',
    url:    '/api/v1/premium/match',
    data:   { resumeId: params.resumeId },
    signal,
  });
}

/**
 * GET /api/v1/premium/match/:resumeId/latest
 *
 * Returns the most recent premium match analysis for a resume.
 * Does NOT deduct credits.
 *
 * @throws {ApiClientError} 404 when no analysis exists yet.
 */
export async function getLatestMatch(
  resumeId: string,
  signal?: AbortSignal,
): Promise<MatchResult> {
  return apiRequest<MatchResult>({
    method: 'GET',
    url:    `/api/v1/premium/match/${encodeURIComponent(resumeId)}/latest`,
    signal,
  });
}
