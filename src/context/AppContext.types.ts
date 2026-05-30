/**
 * src/context/AppContext.types.ts
 *
 * Public types for AppContext.
 * Extracted from AppContext.tsx for Vite Fast Refresh compatibility.
 */

import type { User } from '@/hooks/useUser';

export interface AppContextValue {
  /** Authenticated user — null until hydration completes or if unauthenticated. */
  user:           User | null;
  /**
   * True once both /app-entry and /users/me have settled (success or error).
   * Pages MUST wait for isHydrated before making routing decisions.
   */
  isHydrated:     boolean;
  /** True if the hydration fetch failed (e.g. network error or 401). */
  isError:        boolean;
  /**
   * Re-fetches /users/me and updates the cached user.
   * Race-safe: concurrent callers all receive the same in-flight Promise.
   */
  refreshUser:    () => Promise<User | null>;

  // ── Phase 0: Session + Flow tracking ─────────────────────────────────────

  /**
   * Stable session identifier — generated once per page load.
   * Use for journey reconstruction and cross-event correlation.
   * Never changes within a tab's lifetime.
   */
  sessionId:      string;

  /**
   * Current major flow name, or null if no flow is active.
   * Automatically synced to the analytics envelope via setAnalyticsFlow.
   *
   * Canonical flow names — use FLOW_IDS constants:
   *   'onboarding_professional' | 'onboarding_student' | 'resume_upload' | etc.
   */
  currentFlowId:  string | null;

  /**
   * Begin a major flow. Syncs to analytics envelope immediately.
   * Call at flow entry points (first page of a funnel).
   * Do NOT call from the UI layer — call from page-level effects or hooks.
   *
   * @param flowName - Use FLOW_IDS constants for canonical names.
   * @param options.strict - When true, throws (dev) / warns (prod) if a flow
   *   is already active instead of silently auto-clearing it. Use at entry
   *   points where overlapping flows indicate a lifecycle bug.
   */
  setFlowId:      (flowName: string, options?: { strict?: boolean }) => void;

  /**
   * End the current major flow. Clears analytics envelope flow context.
   * Call when a flow completes, is abandoned, or the user navigates away.
   */
  clearFlowId:    () => void;
}