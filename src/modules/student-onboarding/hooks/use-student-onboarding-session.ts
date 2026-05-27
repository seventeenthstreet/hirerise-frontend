/**
 * @file src/modules/student-onboarding/hooks/use-student-onboarding-session.ts
 *
 * HOOK: useStudentOnboardingSession
 * ──────────────────────────────────
 * Fetches and caches the authenticated student's onboarding session state.
 *
 * ARCHITECTURE POSITION (HireRise Blueprint):
 *   API (studentOnboardingApi.getOnboardingSession)
 *     ↓
 *   [THIS FILE: query hook, cache management, UI-safe state]
 *     ↓
 *   UI / Pages (read currentStep, completedSteps, completionPct, isComplete)
 *
 * WHAT THIS HOOK DOES:
 *   1. Fetches the student's onboarding session from Supabase via the API layer.
 *   2. Returns null safely when no session exists (the user has not started onboarding).
 *   3. Normalizes loading/error state into clean, UI-safe boolean flags.
 *   4. Guards against unauthenticated execution — query is disabled until userId is known.
 *   5. Prevents duplicate network calls via React Query's built-in deduplication.
 *   6. Applies a conservative staleTime so background refetches are infrequent during
 *      active onboarding (step transitions trigger cache invalidation instead).
 *
 * WHAT THIS HOOK DOES NOT DO:
 *   ✅  Contains NO Supabase logic — all DB access is in the API layer.
 *   ✅  Contains NO business rules — step validation belongs in the API.
 *   ✅  Contains NO UI components — presentational concerns belong in pages.
 *   ✅  Contains NO cache orchestration — invalidation happens in mutation hooks.
 *
 * SESSION LIFECYCLE:
 *   1. User arrives at the onboarding entry point.
 *   2. Page calls useStudentOnboardingSession() to check for an existing session.
 *   3. If session is null → page calls useSaveEducationProfile (which auto-creates
 *      the session via createOnboardingSession before the first save).
 *   4. If session exists → page reads currentStep and routes accordingly.
 *
 * NULL SESSION HANDLING:
 *   getOnboardingSession() returns null when no session row exists in Supabase.
 *   This is expected for first-time users. The hook surfaces null transparently:
 *     - `session` is null
 *     - `isSessionFound` is false
 *     - `isLoading` and `isError` behave normally
 *   UI should treat null as "session not started" (not as an error).
 *
 * STALE TIME STRATEGY:
 *   staleTime: 60 seconds — intentionally short compared to the global default (2 min).
 *
 *   REASONING:
 *     The onboarding session changes on every step completion. If the user opens
 *     a second tab or resumes from a different device mid-flow, a 2-minute stale
 *     window would show them the wrong step. 60 seconds balances freshness with
 *     network efficiency during the active onboarding flow.
 *
 *     After session invalidation (triggered by mutation hooks on step save),
 *     React Query immediately marks the session stale and schedules a background
 *     refetch — so the staleTime gap only matters between invalidations.
 *
 * DEDUPLICATION:
 *   Multiple components calling useStudentOnboardingSession with the same userId
 *   share a single in-flight request and a single cache entry. React Query's
 *   observer model ensures zero duplicate network calls regardless of mount count.
 *
 * ERROR HANDLING:
 *   The API layer normalizes all Supabase errors to StudentOnboardingError.
 *   The hook surfaces the error via `error` and `errorCategory` without swallowing
 *   or re-wrapping it. UI should branch on `errorCategory`:
 *     'auth'       → redirect to login
 *     'server'     → show generic retry UI
 *     'not_found'  → treat as null session (session doesn't exist yet)
 *
 * RETRY STRATEGY:
 *   - Auth errors: no retry (deterministic failure — the session is invalid).
 *   - Server/network errors: up to 2 retries with exponential back-off.
 *   - Validation errors: no retry (data shape issue — retrying won't help).
 *
 * FUTURE OPTIMISTIC UPDATE SUPPORT:
 *   This query is the primary target for optimistic session updates.
 *   When useUpdateOnboardingStep fires a mutation, it can:
 *     1. Read the current session via queryClient.getQueryData(session(userId))
 *     2. Compute the optimistic next state
 *     3. Write it via queryClient.setQueryData(session(userId), optimisticSession)
 *     4. On mutation failure, roll back via queryClient.setQueryData(session(userId), previous)
 *   The query key, data type (OnboardingSession | null), and invalidation contract
 *   are designed to support this flow without any refactor.
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { useAppContext } from '@/context/AppContext';
import { studentOnboardingApi } from '../api';
import {
  StudentOnboardingError,
  isStudentOnboardingError,
  StudentOnboardingErrorCode,
  type OnboardingSession,
} from '../api';
import { studentOnboardingQueryKeys } from './query-keys';
import { shouldRetry, retryDelay } from '@/lib/query';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How long the session is considered fresh (60 seconds).
 *
 * SHORTER than the global default (2 min) because the onboarding session
 * changes on every step completion. Freshness is critical during the active
 * onboarding flow — stale session state would route the user to the wrong step.
 *
 * Step-completion mutations trigger explicit invalidation, so this staleTime
 * primarily governs the gap between mutations (e.g. user pauses mid-step).
 */
const SESSION_STALE_TIME_MS = 60 * 1_000; // 60 seconds

/**
 * How long the session cache is retained after all observers unmount (5 min).
 *
 * Matches the global QUERY_GC_TIME. If a user navigates away mid-onboarding
 * and returns within 5 minutes, the cached session provides an instant render
 * while a background refetch validates freshness.
 */
const SESSION_GC_TIME_MS = 5 * 60 * 1_000; // 5 minutes

// ─────────────────────────────────────────────────────────────────────────────
// SELECTOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Module-level selector — extracts the session from the query result.
 *
 * Defined at module scope (not inline in the hook) so the function reference
 * is stable across renders. React Query uses referential equality on select
 * functions to determine when subscribers need re-notification. An inline
 * arrow function creates a new reference every render, defeating memoization
 * and causing unnecessary subscriber re-renders on every background refetch.
 *
 * This selector is a no-op (identity) — the session object from the API layer
 * is already in its final normalized shape. It exists to preserve the pattern
 * for consistency with other hooks and to allow future derived fields to be
 * added here without changing the hook's internal structure.
 */
function selectSession(data: OnboardingSession | null): OnboardingSession | null {
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// RETURN TYPE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * UI-safe state exposed by useStudentOnboardingSession.
 *
 * DESIGN PRINCIPLES:
 *  - All boolean flags are computed from query state — no raw React Query flags
 *    are forwarded directly. This gives UI a stable, semantic contract.
 *  - `error` is typed as StudentOnboardingError | null, not `unknown`. UI can
 *    always branch on `errorCategory` without runtime type narrowing.
 *  - `isSessionFound` is a derived convenience flag so UI never needs to
 *    write `session !== null` inline — naming makes intent clear.
 */
export interface UseStudentOnboardingSessionReturn {
  /** The current session state, or null if no session exists yet. */
  session: OnboardingSession | null;

  /** True while the initial fetch is in-flight (no cached data yet). */
  isLoading: boolean;

  /**
   * True when a background refetch is running (cached data is present).
   * UI can display a subtle indicator without blocking the view.
   */
  isFetching: boolean;

  /** True if the fetch completed successfully. */
  isSuccess: boolean;

  /** True if the fetch failed permanently (after retries). */
  isError: boolean;

  /**
   * The normalized error, or null if there is no error.
   * Always StudentOnboardingError — branch on `errorCategory` for UI decisions.
   */
  error: StudentOnboardingError | null;

  /**
   * Stable category string derived from the error, or null if there is no error.
   *
   * Possible values: 'auth' | 'not_found' | 'validation' | 'conflict' | 'server' | null
   *
   * UI RULE: Always branch on this, never on raw error codes.
   */
  errorCategory: StudentOnboardingError['category'] | null;

  /**
   * True when the fetch has completed and a session row exists in Supabase.
   * False when loading, errored, or when session is null (user hasn't started).
   *
   * Usage: `if (!isSessionFound) { show "Start Onboarding" CTA }`
   */
  isSessionFound: boolean;

  /**
   * True if the user has completed all onboarding steps.
   * Derived from session.isComplete — never computed locally.
   * False when session is null or loading.
   */
  isOnboardingComplete: boolean;

  /**
   * Manual refetch trigger — for network recovery or explicit retry UI.
   *
   * Does NOT invalidate the cache (use queryClient.invalidateQueries for that).
   * Triggers an immediate background refetch regardless of staleTime.
   *
   * Usage: `<button onClick={refetch}>Try again</button>`
   */
  refetch: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches and caches the authenticated student's onboarding session.
 *
 * Returns null safely when no session exists (first-time user before Step 1 save).
 * Query is disabled until userId is available from AppContext.
 *
 * @example
 * const { session, isLoading, isSessionFound } = useStudentOnboardingSession();
 *
 * if (isLoading) return <Skeleton />;
 * if (!isSessionFound) return <StartOnboardingPrompt />;
 * return <OnboardingStep step={session.currentStep} />;
 */
export function useStudentOnboardingSession(): UseStudentOnboardingSessionReturn {
  // ── Auth gate — read from AppContext, same pattern as useOnboarding ────────
  // userId drives the query key scoping and the enabled guard.
  // isHydrated ensures we don't fire before the boot sequence completes.
  const { user, isHydrated } = useAppContext();
  const userId = user?.id ?? null;

  const query = useQuery<
    OnboardingSession | null,  // TQueryFnData — what queryFn returns
    StudentOnboardingError,    // TError — what we catch and normalize
    OnboardingSession | null   // TData — what select returns (identity here)
  >({
    queryKey: studentOnboardingQueryKeys.session(userId ?? ''),

    queryFn: () => studentOnboardingApi.getOnboardingSession(),

    select: selectSession,

    // ── Guard: only fire when we have a real user and the app has booted ────
    // Pattern: isHydrated && !!userId — mirrors useOnboarding, useUser.
    //
    // WHY NOT just check userId:
    //   isHydrated ensures AppContext has finished its own boot sequence
    //   (app-entry → users/me) before this query fires. Without the guard,
    //   getOnboardingSession() would call requireAuthUserId() against a
    //   potentially incomplete Supabase session, risking UNAUTHENTICATED errors
    //   that force the student out of onboarding before it even loads.
    enabled: isHydrated && userId !== null,

    staleTime: SESSION_STALE_TIME_MS,
    gcTime:    SESSION_GC_TIME_MS,

    // ── Retry strategy ────────────────────────────────────────────────────
    // Uses the global shouldRetry predicate, but StudentOnboardingError is NOT
    // an ApiClientError, so the predicate falls through to the non-ApiClientError
    // branch and returns true (treat as transient).
    //
    // We override the predicate here to give StudentOnboardingError proper
    // category-aware retry logic — mirroring how useUser handles ApiClientError.
    retry: (failureCount: number, error: unknown): boolean => {
      if (failureCount >= 2) return false;
      if (isStudentOnboardingError(error)) {
        // Never retry auth failures — the session is definitively invalid.
        if (error.category === 'auth') return false;
        // Never retry validation errors — retrying a malformed shape won't fix it.
        if (error.category === 'validation') return false;
        // Server and network errors: retry (transient).
        return true;
      }
      // Unknown errors: use the global predicate.
      return shouldRetry(failureCount, error, 2);
    },

    retryDelay,

    // Focus refetch disabled — consistent with the global queryClient default.
    // onboarding session changes only on explicit step saves, not on window focus.
    refetchOnWindowFocus: false,
  });

  // ── Normalize error ───────────────────────────────────────────────────────
  // The raw query.error is StudentOnboardingError | null.
  // We cast it through isStudentOnboardingError to give TypeScript certainty.
  const error: StudentOnboardingError | null = isStudentOnboardingError(query.error)
    ? query.error
    : null;

  // ── Derive convenience flags ─────────────────────────────────────────────
  const session         = query.data ?? null;
  const isSessionFound  = query.isSuccess && session !== null;
  const isOnboardingComplete = session?.isComplete ?? false;
  const errorCategory   = error?.category ?? null;

  return {
    session,
    isLoading:           query.isLoading,
    isFetching:          query.isFetching,
    isSuccess:           query.isSuccess,
    isError:             query.isError,
    error,
    errorCategory,
    isSessionFound,
    isOnboardingComplete,
    refetch:             () => { void query.refetch(); },
  };
}