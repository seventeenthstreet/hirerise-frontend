'use client';

/**
 * @file context/AppContext.tsx
 * @description Global hydration context — single source of truth for user state.
 *
 * PHASE 0 HARDENING — SaaS Maturity Layer (Pre-Implementation)
 *
 * Changes in this revision:
 *  1. SESSION ID
 *     - sessionId is generated once per app load using crypto.randomUUID()
 *       (falls back to a time-based UUID-like string for older browsers).
 *     - Generated synchronously before any fetch — safe before hydration.
 *     - Injected into analytics via setAnalyticsSession() immediately.
 *     - Exposed as `sessionId` on AppContextValue.
 *
 *  2. FLOW ID
 *     - currentFlowId tracks which major flow the user is in.
 *     - setFlowId(name) / clearFlowId() are exposed on AppContextValue.
 *     - Calling setFlowId also calls setAnalyticsFlow() to keep the analytics
 *       envelope in sync — one call site, always consistent.
 *     - Stored in a ref for analytics reads (avoids render-triggered effects)
 *       and in state only for consumers that need reactive updates.
 *     - No re-render explosion: flowId state is set only when the value changes.
 *
 *  3. ANALYTICS BRIDGE
 *     - setAnalyticsSession / setAnalyticsFlow / clearAnalyticsFlow are called
 *       from AppContext ONLY — never from pages, hooks, or UI.
 *     - This centralises all session/flow → analytics coupling.
 *
 * EXISTING BEHAVIOURS PRESERVED (no regression):
 *  - Race-safe refreshUser (Promise dedup via refreshRef).
 *  - SWR-style setUser (never clears mid-refresh).
 *  - Boot sequence: app-entry → users/me → isHydrated.
 *  - isError propagation.
 *
 * TYPE / MODULE FIXES (non-runtime, localised):
 *  - FIX-1: Added `import type { Session } from '@supabase/supabase-js'`
 *           Annotates the onAuthStateChange `session` parameter as
 *           `Session | null` — removes the implicit-any TS error.
 *  - FIX-2: Merged duplicate `@/lib/query` import statements into one line.
 *           No runtime change; purely cosmetic deduplication.
 *  - FIX-3: `process.env.NODE_ENV` — resolved by adding `"types": ["node"]`
 *           to tsconfig.json and installing @types/node. No source change here.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
// FIX-1: Import Session type from @supabase/supabase-js.
// This types the `session` parameter in the onAuthStateChange callback,
// removing the "Parameter 'session' implicitly has an 'any' type" error.
// @supabase/supabase-js ships its own types — no extra package required.
import type { Session } from '@supabase/supabase-js';
import type { User } from '@/hooks/useUser';
import {
  setAnalyticsSession,
  setAnalyticsFlow,
  clearAnalyticsFlow,
} from '@/lib/analytics';
import { apiClient } from '@/lib/api/client';
import { isApiClientError } from '@/lib/api/core/api-error';
import { useAppHydration } from '@/hooks/useAppHydration'; // RISK-02: network primitives extracted
import { getSupabaseClient } from '@/lib/supabase/client';
// FIX-2: Merged two separate `@/lib/query` import statements into one.
// Previously lines 57–58 were:
//   import { queryClient } from '@/lib/query';
//   import { queryKeys }   from '@/lib/query';
// Merged into a single import; identical runtime behaviour.
import { queryClient, queryKeys } from '@/lib/query';

// ─────────────────────────────────────────────────────────────────────────────
// OBSERVABILITY IMPORTS — Phases 1, 2, 8, 10
// Adds structured logging, correlation IDs, telemetry, and perf metrics.
// All existing logic below is UNCHANGED.
// ─────────────────────────────────────────────────────────────────────────────
import {
  logAuthEvent,
  AUTH_LOG_EVENTS,
  createHydrationIds,
  startTimer,
  endTimer,
  recordHydration,
  logHydrationMetrics,
  trackTelemetry,
  type HydrationCorrelationIds,
} from '@/lib/observability/authLogger';

// ─────────────────────────────────────────────────────────────────────────────
// SESSION ID GENERATION
//
// Generated once at module evaluation time so it is available synchronously
// before any React render or fetch. This avoids race conditions where an early
// analytics call fires before the session ID is ready.
//
// crypto.randomUUID() is available in all modern browsers and Node 14.17+.
// The fallback produces a UUID-v4-like string for environments that lack it.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deterministic entropy hash — combines available environment signals into
 * a low-collision hex string. Used as the fallback when crypto.randomUUID()
 * is unavailable. No randomness involved — entirely deterministic per tab.
 *
 * Entropy sources (all available in every browser without permissions):
 *  - Date.now()         — millisecond wall clock (changes each call)
 *  - performance.now()  — sub-millisecond monotonic clock since page load
 *                         (unique per tab, not shared across tabs)
 *  - navigator.userAgent — device/browser fingerprint (low entropy but stable)
 *
 * Hash: simple djb2-style 32-bit multiply-accumulate over each char code.
 * Two independent hashes over different seeds prevent trivial collisions.
 *
 * Collision probability: negligible in practice — the combination of time
 * (ms + sub-ms) makes two identical IDs within the same session impossible
 * without hash collision. Cross-session collision is astronomically unlikely.
 */
function deterministicFallbackId(): string {
  const ua   = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const now  = Date.now();
  const perf = typeof performance !== 'undefined' ? performance.now() : 0;

  // Seed string: combine all entropy sources into one input
  const seed = `${now}|${perf}|${ua}`;

  // djb2 hash — fast, well-distributed for short strings
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    h1 = (Math.imul(h1, 33) ^ c) >>> 0;
    h2 = (Math.imul(h2, 31) ^ c) >>> 0;
  }
  // Also mix in performance.now() separately — it changes between calls
  // even within the same millisecond, ensuring tab-level uniqueness
  const h3 = (Math.imul(Math.trunc(perf * 1000), 2654435761) >>> 0);

  return `${h1.toString(16).padStart(8, '0')}-${h2.toString(16).padStart(8, '0')}-${h3.toString(16).padStart(8, '0')}`;
}

function generateSessionId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  // Fallback: deterministic entropy-based ID — no Math.random().
  // See deterministicFallbackId() for entropy source documentation.
  return deterministicFallbackId();
}

/**
 * Module-level session ID — generated once per page load.
 * Stable across re-renders and context re-mounts.
 * Injected into analytics immediately on first import.
 */
const SESSION_ID = generateSessionId();

// Wire to analytics immediately — before any component mounts.
// This guarantees every analytics event carries a sessionId even if they
// fire before AppProvider is rendered (e.g. in lib/api error handlers).
setAnalyticsSession(SESSION_ID);

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// FLOW ID CONSTANTS — canonical flow names; never hard-code strings
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical flow identifiers for setFlowId().
 * These map to the funnel names in analytics.ts FUNNELS constants.
 *
 * @example
 * const { setFlowId } = useAppContext();
 * useEffect(() => { setFlowId(FLOW_IDS.ONBOARDING_PROFESSIONAL); }, []);
 */
export const FLOW_IDS = {
  ONBOARDING_PROFESSIONAL: 'onboarding_professional',
  ONBOARDING_STUDENT:      'onboarding_student',
  RESUME_UPLOAD:           'resume_upload',
  DIRECTION_SELECTION:     'direction_selection',
  DASHBOARD:               'dashboard',
} as const;

export type FlowId = typeof FLOW_IDS[keyof typeof FLOW_IDS];

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

const AppContext = createContext<AppContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// STRICTMODE BOOT LATCH
//
// Module-level flag that survives React StrictMode's cleanup/remount cycle.
// StrictMode (development) double-invokes useEffect: mount → cleanup → mount.
// Local variables inside useEffect reset on each invocation, so both the first
// and second mount would fire full hydration cycles (duplicate /app-entry +
// /users/me). A module-level variable persists across both mounts.
//
// Semantics:
//   false → no hydration has completed yet (initial state, and after sign-out)
//   true  → INITIAL_SESSION hydration already ran; skip on StrictMode remount
//
// Reset: set back to false on SIGNED_OUT so a subsequent login (page reload or
// SPA navigation) triggers a fresh hydration cycle with the new session.
//
// Why module-level and not a useRef?
//   useRef is stable within a single component instance but resets when the
//   component unmounts and remounts (which is exactly what StrictMode does).
//   A module-level variable has the same lifetime as the JS module — it
//   survives both mounts of the StrictMode cycle.
// ─────────────────────────────────────────────────────────────────────────────

let _strictModeBootCompleted = false;

// ─────────────────────────────────────────────────────────────────────────────
// TOKEN_REFRESHED DEDUP GUARD  (Phase 3)
//
// Problem:
//   When Supabase emits TOKEN_REFRESHED, AppContext calls hydrate('refresh')
//   which calls fetchUser(). Simultaneously, mounted useUser() observers may
//   trigger a React Query background refetch of ['user','me']. Both paths hit
//   GET /api/v1/users/me within the same tick — producing a duplicate request
//   that is visible as two [Auth] Verified entries in backend logs.
//
// Fix (two-part, applied only to the refresh path):
//   Part A — cancelQueries: before fetchUser() runs during TOKEN_REFRESHED
//     hydration, cancel any in-flight React Query request for ['user','me'].
//     React Query sets its isCancelled flag synchronously; when the in-flight
//     axios Promise resolves, the result is discarded and setQueryData is
//     never called. The fetchUser() call that follows then owns the single
//     authoritative /users/me request for this refresh cycle.
//
//   Part B — activeRefreshHydration guard: if TOKEN_REFRESHED fires twice in
//     rapid succession (Supabase SDK edge case), the second call reuses the
//     already-running Promise instead of starting a new fetch. This collapses
//     N concurrent refresh hydrations into exactly one.
//
// Scope (intentionally narrow):
//   - ONLY TOKEN_REFRESHED / source === 'refresh'.
//   - SIGNED_IN (login) and INITIAL_SESSION (boot) are NOT affected — those
//     paths must always run their full hydration sequence independently.
//   - mutation invalidation (invalidateQueries in useUpdateUser etc.) is NOT
//     affected — post-mutation refetches are expected and correct.
//
// Memory: the guard is a Promise reference, not a timer. It is cleared in
// finally() so it never leaks across hydration cycles.
// ─────────────────────────────────────────────────────────────────────────────

let activeRefreshHydration: Promise<void> | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {
  const [user,        setUser]        = useState<User | null>(null);
  const [isHydrated,  setIsHydrated]  = useState(false);
  const [isError,     setIsError]     = useState(false);

  // RISK-02: network primitives owned by useAppHydration, not AppContext directly.
  const { fetchUser, warmAppEntry } = useAppHydration({ setUser, setIsError });

  // ── Flow state ─────────────────────────────────────────────────────────────
  // currentFlowId state drives consumer re-renders (e.g. breadcrumbs, debug UI).
  // The ref mirrors it synchronously for read access in non-reactive contexts.
  const [currentFlowId, setCurrentFlowId] = useState<string | null>(null);
  const flowIdRef = useRef<string | null>(null);

  // ── Race-safety ref for refreshUser ────────────────────────────────────────
  const refreshRef = useRef<Promise<User | null> | null>(null);

  // ── OBS: Per-hydration correlation IDs ref (Phase 2) ─────────────────────
  // Holds the IDs for the currently-running hydrate() call so the finally
  // block can emit HYDRATION_END with the same IDs as HYDRATION_START.
  const hydrationIdsRef = useRef<HydrationCorrelationIds | null>(null);
  // Holds the hydration wall-clock timer for Phase 10 metrics.
  const hydrationTimerRef = useRef<{ name: string; startedAt: number } | null>(null);

  // ── H-03: Stable ref for fetchUser ────────────────────────────────────────
  //
  // Problem:
  //   The boot-subscription useEffect depends on `fetchUser` in its dep array.
  //   If `fetchUser` identity ever changes (e.g. during a future refactor of
  //   useAppHydration), the effect tears down and re-runs — tearing down the
  //   onAuthStateChange subscription, unwinding the hydration sequence, and
  //   hitting the StrictMode latch, which blocks rehydration permanently.
  //
  // Fix:
  //   A stable ref (fetchUserRef) mirrors the latest `fetchUser` value on
  //   every render. The subscription effect uses fetchUserRef.current inside
  //   its async closures rather than capturing `fetchUser` directly.
  //   The effect dep array can then be `[]` — the subscription is set up once
  //   and never torn down due to a callback identity change.
  //
  //   Stale closure risk: none. The ref is updated synchronously before any
  //   async call inside hydrate() — React renders are synchronous, so by the
  //   time an auth event fires and calls hydrate(), fetchUserRef.current
  //   already holds the latest fetchUser function.
  //
  //   StrictMode: the effect still runs once per mount (latched by
  //   _strictModeBootCompleted). A stable dep array does not affect latch
  //   semantics — it only removes the unnecessary teardown on identity change.
  const fetchUserRef = useRef(fetchUser);
  useEffect(() => {
    fetchUserRef.current = fetchUser;
  });

  // ── setFlowId — idempotent + lifecycle guard ──────────────────────────────
  //
  // Guard rules (in order):
  //  1. Same value → no-op. No re-render, no analytics call. Idempotent.
  //  2. Different value while a flow is active → auto-clear previous flow
  //     and warn in development. This prevents stale _fid leaking into the
  //     new flow's analytics envelope.
  //  3. No flow active → start the new flow normally.
  //
  // Re-render explosion is prevented: setCurrentFlowId is only called when
  // the value actually changes (guarded by step 1).
  const setFlowId = useCallback((flowName: string, options?: { strict?: boolean }): void => {
    // 1. Idempotent — same value is a strict no-op
    if (flowIdRef.current === flowName) return;

    // 2. Lifecycle guard — enforce or warn on stale flow before starting a new one
    if (flowIdRef.current !== null) {
      const msg =
        `[AppContext] setFlowId("${flowName}") called while flow ` +
        `"${flowIdRef.current}" is still active. ` +
        `Call clearFlowId() explicitly at flow exit points to suppress this warning.`;

      if (options?.strict) {
        // Strict mode: surface the bug loudly so it cannot be silently ignored.
        // Throw in development; warn + continue in production to stay non-blocking.
        // FIX-3: process.env.NODE_ENV is valid once @types/node is installed and
        // "types": ["node"] is added to tsconfig.json compilerOptions.
        if (process.env.NODE_ENV === 'development') {
          throw new Error(`[AppContext] strict: ${msg}`);
        } else {
          console.warn(msg);
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`${msg} Auto-clearing previous flow.`);
        }
      }

      // Clear analytics envelope for the outgoing flow before overwriting
      clearAnalyticsFlow();
    }

    // 3. Start the new flow
    flowIdRef.current = flowName;
    setCurrentFlowId(flowName);
    setAnalyticsFlow(flowName); // sync analytics envelope
  }, []);

  // ── clearFlowId ────────────────────────────────────────────────────────────
  const clearFlowId = useCallback((): void => {
    if (flowIdRef.current === null) return; // already clear
    flowIdRef.current = null;
    setCurrentFlowId(null);
    clearAnalyticsFlow(); // sync analytics envelope
  }, []);

  // ── fetchUser + warmAppEntry (RISK-02) ───────────────────────────────────────
  // Network primitives are owned by hooks/useAppHydration.ts.
  // fetchUser and warmAppEntry are wired above via useAppHydration({ setUser, setIsError }).
  // They are called inside hydrate() below exactly as before — runtime behaviour unchanged.

  // ── Boot sequence: check Supabase session → app-entry → users/me ────────────
  //
  // PHASE 1 AUTH STABILIZATION FIX — Session-ready gate
  //
  // ROOT CAUSE OF 401s:
  //   supabase.auth.getSession() in the INITIAL_SESSION path is an async call.
  //   In supabase-js v2, INITIAL_SESSION fires as a microtask — not synchronously.
  //   During the window between subscription setup and that microtask resolving,
  //   getSession() can return a session whose access_token is in the process of
  //   being refreshed (or is transiently null on the auth server). Any fetch() that
  //   runs in this window, or that receives a stale token before the refresh
  //   completes, produces a 401 from the backend.
  //
  // THE FIX — two complementary guards:
  //
  //   1. sessionConfirmed ref: an explicit boolean gate that is set to true only
  //      after getSession() returns a non-null session (initial path) or after
  //      SIGNED_IN / TOKEN_REFRESHED fires with a real token (login/refresh path).
  //      hydrate() DOES NOT proceed to the /app-entry fetch until this flag is set.
  //      This eliminates the race between "subscription registered" and
  //      "getSession() has resolved with a valid, refreshed token".
  //
  //   2. hydrateOnce ref: a boolean latch that prevents duplicate hydrate() runs
  //      for the same session identity. Without this, INITIAL_SESSION + SIGNED_IN
  //      both completing (when both fire on a warm login) would call /app-entry twice.
  //      The generation counter already prevents the WRONG generation from writing
  //      state, but it does not prevent two VALID generations both hitting the network.
  //      hydrateOnce ensures exactly one /app-entry + /users/me pair per session.
  //      It is reset to false on SIGNED_OUT so a subsequent login re-hydrates cleanly.
  //
  // PRESERVED:
  //   - generation counter (prevents stale async writes to state)
  //   - cancelled flag (prevents state writes after unmount)
  //   - all existing event handlers (INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED, SIGNED_OUT)
  //   - all existing API call shapes and URLs
  //   - all existing state setters
  //
  // STRICTMODE FIX — module-level boot latch:
  //   React StrictMode double-invokes useEffect in development (mount → cleanup →
  //   mount again). Each invocation creates fresh local variables (cancelled,
  //   generation, hydrateOnce, sessionConfirmed), so the second mount starts a
  //   completely new hydration cycle. This produces duplicate /app-entry and
  //   /users/me requests even in production-equivalent dev runs.
  //
  //   Fix: a MODULE-LEVEL ref that survives the StrictMode cleanup/remount cycle.
  //   The ref is set to true after the first successful INITIAL_SESSION hydration
  //   completes. The second StrictMode mount's INITIAL_SESSION handler checks this
  //   ref and exits immediately — one network pair per page load, guaranteed.
  //
  //   TOKEN_REFRESHED is always allowed through: it carries a new token and must
  //   update the axios interceptor regardless of prior hydrations. SIGNED_IN on a
  //   cold login is also always allowed — the latch resets on SIGNED_OUT.
  useEffect(() => {
    // AS-01: Per-effect AbortController for cancelling in-flight network
    // requests (warmAppEntry + fetchUser) on unmount.
    //
    // WHY a local AbortController rather than a ref:
    //   Each effect invocation creates a fresh controller with a fresh signal.
    //   On unmount, the cleanup function calls controller.abort() — this
    //   propagates to warmAppEntry (via AbortSignal.any) and fetchUser (via
    //   apiClient) cancelling any in-flight TCP requests at the transport layer.
    //
    //   The existing `cancelled` boolean prevents state writes after unmount;
    //   unmountController prevents the *network requests themselves* from
    //   completing after teardown. Together they close the full async cleanup
    //   gap: no orphan requests, no stale cache writes, no stale state writes.
    //
    //   StrictMode: each mount creates a fresh controller. The cleanup of the
    //   first StrictMode mount aborts its controller (cancelling any in-flight
    //   requests from that mount), and the second mount gets a fresh controller.
    //   This is the correct StrictMode-safe pattern for AbortController usage.
    const unmountController = new AbortController();

    // Component-level cancellation (used on unmount / effect cleanup).
    let cancelled = false;

    // Generation counter — incremented on every new auth event.
    // Each hydrate() call captures its own generation at start; if a newer event
    // arrives mid-flight (e.g. SIGNED_IN while INITIAL_SESSION is still waiting on
    // getSession()), the in-flight call sees its generation is stale and bails out.
    // This means SIGNED_IN always supersedes an in-progress INITIAL_SESSION hydration
    // even though both are async, eliminating the 401 race on page load with a
    // pre-existing expired session.
    let generation = 0;

    // PHASE 1 FIX — Gate 1: session-confirmed latch.
    // Set to true only after we hold a verified, non-null session.
    // hydrate() must not call /app-entry before this is true.
    // Using a local variable (not a ref) so it resets correctly on effect re-run.
    let sessionConfirmed = false;

    // PHASE 1 FIX — Gate 2: hydrate-once latch.
    // Prevents a second full hydration cycle when both INITIAL_SESSION and SIGNED_IN
    // fire for the same session (common on login and OAuth callback).
    // Reset to false by SIGNED_OUT so a new login always triggers a fresh hydration.
    let hydrateOnce = false;

    async function hydrate(
      source: 'initial' | 'login' | 'refresh',
      rawSession: { access_token: string } | null,
    ) {
      // PHASE 1 FIX — Duplicate hydration guard.
      // If this source is 'initial' and we already completed a hydration cycle
      // from a SIGNED_IN event that fired first (e.g. OAuth), skip re-entry.
      // TOKEN_REFRESHED is always allowed through — it carries a new token and must
      // update the user state and axios interceptor regardless of prior hydrations.
      if (source === 'initial' && hydrateOnce) return;

      // STRICTMODE FIX — module-level latch check.
      // If the module-level latch says a boot cycle already completed (from the
      // first StrictMode mount), skip this second INITIAL_SESSION invocation.
      // TOKEN_REFRESHED and SIGNED_IN are intentionally NOT gated here — they
      // carry new tokens and must always be processed.
      if (source === 'initial' && _strictModeBootCompleted) return;

      // Claim this generation slot. Any hydrate() running with a lower gen
      // will self-cancel at its next checkpoint.
      const myGen = ++generation;

      // OBS Phase 1+2+10: create correlation IDs + start wall-clock timer for
      // this hydration cycle. Stored in refs so the finally block can emit
      // HYDRATION_END with the same IDs regardless of which code path exits.
      const _obsIds = createHydrationIds();
      hydrationIdsRef.current  = _obsIds;
      hydrationTimerRef.current = startTimer('hydration');
      logAuthEvent(AUTH_LOG_EVENTS.HYDRATION_START, _obsIds, { source });

      try {
        let session: { access_token: string } | null;

        if (source === 'initial') {
          // INITIAL_SESSION fires with whatever is in localStorage — the token
          // may be expired if the tab was left open for hours.
          // Call getSession() so Supabase auto-refreshes before we hit the backend.
          // If SIGNED_IN arrives during this await, myGen < generation and we abort.
          const supabase = getSupabaseClient();
          const { data } = await supabase.auth.getSession();

          // Stale-check: a newer auth event arrived while we were refreshing. Abort.
          if (myGen < generation || cancelled) return;

          session = data.session;

          // PHASE 1 FIX — Gate 1: only mark session confirmed after getSession()
          // has resolved with a real, refreshed session. This is the EARLIEST point
          // at which we know the access_token is valid and safe to send to the backend.
          if (session) {
            sessionConfirmed = true;
          }
        } else {
          // SIGNED_IN / TOKEN_REFRESHED — Supabase guarantees a fresh token here.
          // Use it directly; no extra round-trip needed.
          session = rawSession;

          // PHASE 1 FIX — Gate 1: SIGNED_IN / TOKEN_REFRESHED always carry a valid
          // token from Supabase. Mark session confirmed immediately.
          if (session) {
            sessionConfirmed = true;
          }
        }

        if (!session) {
          // No active session → show login.
          if (myGen === generation && !cancelled) setIsHydrated(true);
          return;
        }

        // PHASE 1 FIX — Gate 1 enforcement: hard-stop before any backend call
        // if session readiness has not been confirmed. This is the safety net
        // that prevents /app-entry from being called with a missing or stale token
        // during the async gap before getSession() resolves.
        if (!sessionConfirmed) {
          if (myGen === generation && !cancelled) setIsHydrated(true);
          return;
        }

        if (myGen < generation || cancelled) return;

        // PHASE 1 FIX — Gate 2: mark hydration as in-flight so a concurrent
        // INITIAL_SESSION (fired after SIGNED_IN) skips the full hydration cycle.
        // Set here — after all guards pass and before the first network call —
        // so the latch is visible to any INITIAL_SESSION that arrives during the
        // await below.
        hydrateOnce = true;

        // NOTE: _strictModeBootCompleted is intentionally NOT set here.
        // It is set only after both fetches succeed and state is committed.
        // Setting it here (before the network calls) would permanently block
        // future hydration attempts if the fetch below throws or is cancelled —
        // leaving the app in a permanently unhydrated, unrecoverable state.
        // See the post-commit assignment below.

        // RISK-02: app-entry cache warm delegated to warmAppEntry (hooks/useAppHydration.ts).
        // Semantics unchanged: fire-and-forget, body drained, errors absorbed.
        //
        // AS-01: Thread the unmount controller signal so warmAppEntry's fetch
        // is cancelled on component unmount, eliminating the orphan network
        // request that previously continued after AppProvider teardown.
        await warmAppEntry(session.access_token, unmountController.signal);

        if (myGen < generation || cancelled) return;

        // ── Phase 3: TOKEN_REFRESHED dedup — cancel + guard ────────────────
        // Applies ONLY when this hydration was triggered by TOKEN_REFRESHED
        // (source === 'refresh'). For login and initial boot the full fetch
        // must always run unconditionally.
        if (source === 'refresh') {
          // Part A — cancel any React Query background refetch that may have
          // started concurrently with this TOKEN_REFRESHED handler.
          // cancelQueries sets the isCancelled flag synchronously; the resolved
          // value of the in-flight request is discarded before it can repopulate
          // the cache. This leaves fetchUser() as the sole writer for this cycle.
          console.debug('[auth-refresh] cancelling in-flight user query before refresh hydration');
          await queryClient.cancelQueries({ queryKey: queryKeys.user.me(), exact: true });

          if (myGen < generation || cancelled) return;

          // Part B — module-level dedup guard.
          // If a refresh hydration is already in flight (e.g. TOKEN_REFRESHED
          // fired twice in rapid succession), reuse its Promise — do NOT start
          // a second fetchUser() call.
          if (activeRefreshHydration) {
            console.debug('[auth-refresh] reusing active refresh hydration');
            await activeRefreshHydration;
            return;
          }

          activeRefreshHydration = (async () => {
            try {
              // AS-01: Thread the unmount signal so the /users/me request
              // is cancelled if AppProvider unmounts mid-refresh.
              await fetchUserRef.current(session.access_token, 'refresh', unmountController.signal);
            } finally {
              activeRefreshHydration = null;
            }
          })();

          await activeRefreshHydration;
        } else {
          // SIGNED_IN / INITIAL_SESSION — run fetchUser directly, no dedup guard.
          // AS-01: Thread the unmount signal for cancellation safety.
          await fetchUserRef.current(session.access_token, source, unmountController.signal);
        }

        // STRICTMODE FIX — set module-level latch AFTER successful commit.
        //
        // Placement rationale:
        //   This is the first point at which we know BOTH network calls completed
        //   without throwing AND the generation is still current (we are still the
        //   winning hydration cycle). Setting the latch here means it represents
        //   "hydration succeeded" rather than "hydration was attempted."
        //
        //   If fetchUser() throws, execution jumps to the catch block — this line
        //   is never reached, the latch stays false, and the next auth recovery
        //   event (SIGNED_IN, TOKEN_REFRESHED) can run a full hydration cycle.
        //
        //   If myGen < generation (superseded by a newer event), the guard above
        //   already returned — this line is also never reached.
        //
        //   If cancelled (unmount), same — already returned above.
        //
        //   StrictMode deduplication is still guaranteed: the second StrictMode
        //   mount's INITIAL_SESSION fires after the first mount's await resolves.
        //   By that point this latch is true (set by the first mount's success)
        //   and the second mount's check at the top of hydrate() returns early.
        //   The window between the two StrictMode mounts is synchronous cleanup
        //   + synchronous re-subscribe — by the time the second INITIAL_SESSION
        //   handler calls hydrate(), the first mount's awaits have already settled.
        if (myGen === generation && !cancelled) {
          _strictModeBootCompleted = true;
        }
      } catch {
        // OBS Phase 1+8: structured error log + telemetry counter
        const _ids = hydrationIdsRef.current ?? {};
        logAuthEvent(AUTH_LOG_EVENTS.AUTH_HYDRATION_FAILED, _ids, { source }, 'error');
        if (source === 'login') trackTelemetry('loginFailure', _ids, { source });
        trackTelemetry('bootstrapFailure', _ids, { source });
        if (myGen === generation && !cancelled) setIsError(true);
      } finally {
        // OBS Phase 1+10: emit HYDRATION_END + metrics for the winning generation
        if (myGen === generation && !cancelled) {
          const _ids  = hydrationIdsRef.current ?? {};
          const _durationMs = hydrationTimerRef.current
            ? endTimer(hydrationTimerRef.current)
            : undefined;
          if (_durationMs !== undefined) recordHydration(_durationMs);
          logAuthEvent(AUTH_LOG_EVENTS.HYDRATION_END, _ids, { source, durationMs: _durationMs });
          logHydrationMetrics(
            hydrationIdsRef.current ?? { hydrationId: '', authCycleId: '', requestId: '' },
            { totalHydrationMs: _durationMs },
            { source },
          );
          hydrationIdsRef.current  = null;
          hydrationTimerRef.current = null;
        }
        // Only the winning generation marks hydration as complete.
        if (myGen === generation && !cancelled) setIsHydrated(true);

        // STRICTMODE CANCEL FIX — reset hydrateOnce if this hydration was
        // cancelled before it completed (e.g. StrictMode double-mount teardown).
        //
        // THE BUG WITHOUT THIS:
        //   hydrateOnce is set to `true` *before* the network calls so a
        //   concurrent INITIAL_SESSION (fired after SIGNED_IN) skips re-entry.
        //   But if the component is torn down mid-flight (React StrictMode unmounts
        //   the first mount before warmAppEntry / fetchUser resolve):
        //     1. First mount: hydrateOnce = true → network calls start → cleanup
        //        fires → cancelled = true, unmountController.abort() → requests abort
        //     2. Second mount: INITIAL_SESSION fires → hydrateOnce check returns true
        //        → skips the entire hydration cycle
        //     3. isHydrated stays false forever → page.tsx never routes → login loop
        //
        // THE FIX:
        //   In the finally block, if `cancelled` is true and `_strictModeBootCompleted`
        //   is still false (i.e. hydration never successfully committed), reset
        //   hydrateOnce so the second StrictMode mount's INITIAL_SESSION can proceed.
        //   This mirrors the existing rationale for NOT setting _strictModeBootCompleted
        //   early — cancelled hydration must not permanently block future attempts.
        if (cancelled && !_strictModeBootCompleted) {
          hydrateOnce = false;
        }
      }
    }

    // Subscribe first so INITIAL_SESSION is never missed.
    // onAuthStateChange fires INITIAL_SESSION synchronously on subscription setup
    // with whatever session is currently in storage.
    const supabase = getSupabaseClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      // FIX-1: Annotate `session` as `Session | null` using the imported Supabase type.
      // Previously this was untyped, causing "Parameter 'session' implicitly has an
      // 'any' type" under strict mode. Session is the correct type per the supabase-js
      // v2 onAuthStateChange contract. No runtime behaviour change.
      (event: string, session: Session | null) => {
        // OBS Phase 1+2: emit a structured log for every Supabase auth state
        // transition so the full event sequence is visible in production logs.
        // createHydrationIds() generates a fresh authCycleId per event; hydrate()
        // will create its own IDs internally for the network phase.
        const _evtIds = createHydrationIds();
        if (event === 'INITIAL_SESSION') {
          logAuthEvent(AUTH_LOG_EVENTS.INITIAL_SESSION, _evtIds, { hasSession: !!session });
          hydrate('initial', session);
        }
        if (event === 'SIGNED_IN') {
          logAuthEvent(AUTH_LOG_EVENTS.SIGNED_IN, _evtIds, { hasSession: !!session });
          hydrate('login', session);
        }
        // TOKEN_REFRESHED: Supabase silently renewed the token — re-hydrate so
        // the user state and axios interceptor both use the new token.
        if (event === 'TOKEN_REFRESHED') {
          logAuthEvent(AUTH_LOG_EVENTS.TOKEN_REFRESHED, _evtIds, { hasSession: !!session });
          trackTelemetry('tokenRefresh', _evtIds); // OBS Phase 8
          hydrate('refresh', session);
        }
        if (event === 'SIGNED_OUT') {
          // OBS Phase 1: structured sign-out event
          logAuthEvent(AUTH_LOG_EVENTS.SIGNED_OUT, {}, { sessionId: SESSION_ID });
          sessionConfirmed = false;
          hydrateOnce = false;

          // STRICTMODE FIX — reset module-level latch on sign-out.
          // The next login must re-run the full boot sequence.
          _strictModeBootCompleted = false;

          // CACHE INVALIDATION FIX — Bump generation to cancel any in-flight
          // hydrate() that may be writing stale data from the outgoing session.
          // This closes the race window where INITIAL_SESSION arrives just as
          // SIGNED_OUT fires (e.g. rapid login/logout or account switch): the
          // in-flight hydrate() will see myGen < generation at its next checkpoint
          // and self-cancel before calling setUser() or setQueryData().
          generation++;

          // IN-FLIGHT QUERY CANCELLATION — Cancel active React Query fetches
          // BEFORE removing cache entries to close the repopulation race.
          //
          // THE RACE WITHOUT THIS:
          //   1. useUser's queryFn fires → in-flight GET /users/me
          //   2. SIGNED_OUT fires → removeQueries deletes ['user','me']
          //   3. Axios resolves the response → React Query writes result back
          //   4. Cache is repopulated with stale data from the previous session
          //
          // HOW cancelQueries SEALS IT:
          //   cancelQueries() synchronously sets React Query's internal
          //   isCancelled flag on matching query observers. When the in-flight
          //   Promise resolves (step 3 above), React Query checks this flag and
          //   discards the result — setQueryData is never called, the cache
          //   stays empty after removeQueries clears it.
          //
          // NOTE — void, not await:
          //   cancelQueries returns a Promise (for signal-aware queryFns that
          //   need drain time). We void it rather than await because:
          //   a) useUser and useAppEntry do not thread AbortSignal — there is
          //      no transport to drain. The isCancelled flag is set synchronously;
          //      the Promise rejection happens in a microtask.
          //   b) Awaiting would require making the SIGNED_OUT handler async,
          //      which introduces a tick gap between cancelQueries and the state
          //      resets below — a new race, not fewer.
          //   c) The synchronous flag-set is sufficient to prevent cache writes.
          //      The void Promise merely defers the observer cleanup.
          //
          // exact: true prevents prefix-match cancellation — without it,
          // cancelQueries(['user','me']) would also cancel any future query
          // whose key starts with ['user'] (e.g. ['user','preferences']).
          void queryClient.cancelQueries({ queryKey: queryKeys.user.me(),    exact: true });
          void queryClient.cancelQueries({ queryKey: queryKeys.appEntry.all(), exact: true });

          // Remove user-scoped React Query cache entries seeded by fetchUser().
          //
          // CONTEXT: fetchUser() calls queryClient.setQueryData(queryKeys.user.me(), payload)
          // after every successful /users/me fetch. This seeds the React Query cache
          // so useUser() consumers get a cache hit instead of a duplicate network call.
          //
          // RISK WITHOUT THIS: The ['user', 'me'] entry survives SIGNED_OUT with
          // the previous session's { user, credits, quota } payload. staleTime is 2
          // minutes (global default). Any component mounting useUser() in that window
          // — including during the next user's login flow — receives stale data as a
          // cache hit before the new fetchUser() overwrites it. On account switch this
          // means User B briefly sees User A's credits/quota/profile.
          //
          // removeQueries vs invalidateQueries:
          //   invalidateQueries marks the entry stale → React Query fires a background
          //   refetch immediately → 401 (no session) → error state propagates to consumers.
          //   removeQueries deletes the entry entirely → useUser().data = undefined,
          //   isLoading = false, no network call until enabled flips true again.
          //   removeQueries is the correct choice here: it produces a clean empty state
          //   with no spurious 401 side-effects.
          queryClient.removeQueries({ queryKey: queryKeys.user.me() });

          // Remove the app-entry cache entry so the next authenticated session
          // always triggers a fresh /app-entry boot call rather than reusing the
          // 5-minute gcTime window from the previous session's profile state.
          // This is a safety measure — useAppEntry already has staleTime: 0, so it
          // would refetch on the next mount regardless. Removing here makes the
          // empty-cache state explicit and avoids any edge case where gcTime
          // serves a stale warm result before the next hydration completes.
          queryClient.removeQueries({ queryKey: queryKeys.appEntry.all() });

          setUser(null);
          setIsError(false);   // FIX: clear stale error state from previous session
          setIsHydrated(true);
        }
      },
    );

    return () => {
      cancelled = true;
      // AS-01: Abort any in-flight warmAppEntry or fetchUser network requests.
      // This cancels TCP requests at the transport layer — the `cancelled` flag
      // above prevents state writes, but without this abort the requests
      // themselves would continue to completion (orphan network requests).
      unmountController.abort();
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── refreshUser — race-safe ────────────────────────────────────────────────
  const refreshUser = useCallback((): Promise<User | null> => {
    if (refreshRef.current) return refreshRef.current;

    refreshRef.current = (async () => {
      try {
        // CRITICAL: pass source='refresh' so transient errors (429, network)
        // do NOT call setIsError(true) and send the user to /login.
        // source=undefined would match 'undefined !== refresh' = true in fetchUser,
        // causing any refreshUser() failure to permanently kill the session.
        return await fetchUser(undefined, 'refresh');
      } finally {
        refreshRef.current = null;
      }
    })();

    return refreshRef.current;
  }, [fetchUser]);

  return (
    <AppContext.Provider
      value={{
        user,
        isHydrated,
        isError,
        refreshUser,
        // Phase 0 additions
        sessionId:     SESSION_ID,
        currentFlowId,
        setFlowId,
        clearFlowId,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Access the global app hydration state.
 * Must be used inside <AppProvider>.
 */
export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used within <AppProvider>');
  }
  return ctx;
}