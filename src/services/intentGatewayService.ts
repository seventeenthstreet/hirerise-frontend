/**
 * services/intentGatewayService.ts
 *
 * Handles all client-side logic for the Intent Gateway feature:
 *   1. Saving user direction to the backend (PATCH /users/me/direction)
 *   2. Caching direction in localStorage for instant redirects on future logins
 *   3. Clearing direction (for "reset" flows via Settings)
 *
 * Architecture rules followed:
 *   - Never constructs Authorization headers (apiFetch handles that)
 *   - Never includes uid in payloads (backend uses req.user.uid)
 *   - Never modifies existing services (userService, onboardingService, etc.)
 */

import { apiFetch } from '@/services/apiClient';
import type { UserDirection } from '@/types/intentGateway';

// ─── Constants ────────────────────────────────────────────────────────────────

const LS_KEY = 'hirerise_user_direction';

// ─── Service ──────────────────────────────────────────────────────────────────

export const intentGatewayService = {

  /**
   * saveDirection(direction)
   *
   * Persists the user's chosen direction to the backend.
   * POST /api/v1/users/me/direction
   *
   * The backend writes user_direction to users/{uid} in Firestore.
   * On subsequent logins, GET /users/me returns user_direction and
   * the gateway middleware redirects before this page renders.
   */
  async saveDirection(direction: UserDirection): Promise<void> {
    await apiFetch<void>('/users/me/direction', {
      method: 'POST',
      body: JSON.stringify({ direction }),
    });
  },

  /**
   * getDirectionFromServer()
   *
   * Fetches the stored direction from the server.
   * Used by middleware / auth context to pre-check before rendering gateway.
   * Returns null if the user has no direction set.
   */
  async getDirectionFromServer(): Promise<UserDirection | null> {
    try {
      const res = await apiFetch<{ direction: UserDirection | null }>('/users/me/direction');
      return res.direction ?? null;
    } catch {
      return null;
    }
  },

  /**
   * resetDirection()
   *
   * Clears the stored direction from both server and localStorage.
   * Called from Settings → "Change my focus area".
   * On next login, user will see the Intent Gateway again.
   */
  async resetDirection(): Promise<void> {
    await apiFetch<void>('/users/me/direction', { method: 'DELETE' });
    intentGatewayService.clearCache();
  },

  // ── localStorage helpers ──────────────────────────────────────────────────

  /** Write direction to localStorage for instant redirects. */
  cacheDirection(direction: UserDirection): void {
    try {
      localStorage.setItem(LS_KEY, direction);
    } catch {
      // Silently fail — incognito / storage blocked. Gateway will still work via server.
    }
  },

  /** Read direction from localStorage. Returns null if not set. */
  getDirectionFromCache(): UserDirection | null {
    try {
      const val = localStorage.getItem(LS_KEY);
      if (val === 'education' || val === 'career' || val === 'market') {
        return val;
      }
    } catch {
      // Silently fail
    }
    return null;
  },

  /** Remove direction from localStorage. */
  clearCache(): void {
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      // Silently fail
    }
  },
};