/**
 * @file features/student-onboarding/lib/polling-guard.ts
 *
 * POLLING GUARD
 * ──────────────
 * Centralized, controlled polling logic for the student onboarding session query.
 *
 * RULES:
 *   ✅ Poll ONLY during the 'processing' step
 *   ✅ Poll ONLY while onboarding is incomplete
 *   ✅ Disable polling automatically in all other cases
 *   ✅ No manual setInterval scattered across components
 *   ✅ No polling inside UI components — all logic lives here
 *
 * IMPLEMENTATION NOTE:
 *   useStudentOnboardingSession() takes no options argument (existing contract).
 *   Polling is therefore implemented via useEffect + the hook's refetch() return value
 *   inside useStudentOnboardingFlow — NOT via refetchInterval on the query itself.
 *   computePollingInterval() returns the interval ms to use, or false to disable.
 */

/** Polling interval in ms during the 'processing' step. */
export const PROCESSING_POLL_INTERVAL_MS = 5_000;

/**
 * How long to suppress polling after a rate-limit (429) response, in ms.
 * The backend retryAfter hint is typically 60 s; we use the same floor here.
 */
export const RATE_LIMIT_BACKOFF_MS = 60_000;

export interface PollingGuardResult {
  /** Interval in ms when polling is active, false when disabled. */
  readonly refetchInterval: number | false;
  readonly mode: 'active' | 'inactive' | 'rate_limited';
}

/**
 * Computes whether polling should be active and what interval to use.
 *
 * All three conditions must be true to enable polling:
 *   1. currentStepId === 'processing'
 *   2. isOnboardingComplete === false
 *   3. isRateLimited === false  (suppress polling during a 429 backoff window)
 */
export function computePollingInterval(
  currentStepId: string,
  isOnboardingComplete: boolean,
  isRateLimited = false,
): PollingGuardResult {
  if (isRateLimited) {
    return { refetchInterval: false, mode: 'rate_limited' };
  }

  const shouldPoll = currentStepId === 'processing' && !isOnboardingComplete;

  return shouldPoll
    ? { refetchInterval: PROCESSING_POLL_INTERVAL_MS, mode: 'active' }
    : { refetchInterval: false, mode: 'inactive' };
}