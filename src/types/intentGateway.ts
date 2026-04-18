/**
 * types/intentGateway.ts
 *
 * Shared TypeScript types for the Intent Gateway feature.
 * Extend BackendUser (types/auth.ts) with user_direction without modifying it.
 */

import type { BackendUser } from './auth';

// ─── Core direction type ──────────────────────────────────────────────────────

/** The three possible user focus directions. */
export type UserDirection = 'education' | 'career' | 'market';

/** Extends BackendUser with the new gateway field. */
export interface BackendUserWithDirection extends BackendUser {
  /** Set after the user completes the Intent Gateway. Null if never set. */
  user_direction: UserDirection | null;
}

/** API response shape for GET/POST /api/v1/users/me/direction */
export interface DirectionResponse {
  direction: UserDirection | null;
  savedAt:   string | null; // ISO 8601
}

// ─── Route map (imported by gateway page and middleware) ──────────────────────

export const DIRECTION_ROUTES: Record<UserDirection, string> = {
  education: '/education/onboarding',
  career:    '/dashboard',
  market:    '/market-insights',
};