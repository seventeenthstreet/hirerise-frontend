/**
 * @file hooks/useResumeManager.ts
 * @description Resume lifecycle management hook.
 *
 * HARDENING CHANGES:
 *  1. Added `isProcessing: boolean` to the return type and value.
 *     True when the active resume's status is 'pending' or 'processing'.
 *     Allows dashboard, resume page, and other UI to reflect async
 *     processing state globally without a separate polling hook.
 *  2. Quota-aware blocking on upload and rescore: if quota.isExhausted is
 *     detected via a 429 response, the action throws immediately so the
 *     caller can surface the upgrade banner.
 *  3. [HARDENING #2] enableBackgroundPolling option: when false, the
 *     internal processing-status poller is suppressed entirely. Pages that
 *     run their own fine-grained polling (e.g. /resume) pass
 *     { enableBackgroundPolling: false } to avoid two simultaneous pollers
 *     hitting the same endpoint.
 *
 * Architecture unchanged: API → Hooks. No direct fetch() calls added.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  listResumes,
  deleteResume as deleteResumeApi,
  setActiveResume as setActiveResumeApi,
  rescoreResume as rescoreResumeApi,
  refreshSignedUrl as refreshSignedUrlApi,
  uploadResume as uploadResumeApi,
  getResumeStatus,
} from '@/lib/api/resume';
import type {
  ResumeRecord,
  ResumeStatus,
  RescoreResumeResponse,
} from '@/lib/api/resume';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Statuses that count as "actively processing" */
const PROCESSING_STATUSES: ResumeStatus[] = ['pending', 'processing'];

/** How often to poll when isProcessing is true (ms) */
const PROCESSING_POLL_INTERVAL_MS = 5_000;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface UseResumeManagerOptions {
  /**
   * When false, the background processing-status poller is disabled entirely.
   *
   * Use case: the /resume page runs its own page-level polling loop with
   * finer-grained progress tracking. Mounting useResumeManager there with
   * the default (true) would create TWO concurrent pollers hitting
   * GET /api/v1/resume/:id/status simultaneously.
   *
   * Pass `{ enableBackgroundPolling: false }` from the resume page so only
   * the page-level loop runs. All other pages (dashboard, etc.) use the
   * default (true) to keep the global isProcessing flag up to date.
   *
   * @default true
   */
  enableBackgroundPolling?: boolean;
}

export interface UseResumeManagerReturn {
  // State
  resumes:        ResumeRecord[];
  activeResume:   ResumeRecord | null;
  isLoading:      boolean;
  isError:        boolean;
  error:          Error | null;
  // Upload state
  isUploading:    boolean;
  uploadError:    Error | null;
  // Rescore state
  rescoreJobId:   string | null;
  rescoreStatus:  ResumeStatus | null;
  /**
   * True when the active resume's processing status is 'pending' or 'processing'.
   * Use this flag to:
   *   - Show a global processing banner on the dashboard
   *   - Disable rescore/delete actions while processing
   *   - Sync the resume page's progress bar state
   */
  isProcessing:   boolean;
  // Actions
  refresh:        () => Promise<void>;
  uploadResume:   (file: File) => Promise<void>;
  setActive:      (resumeId: string) => Promise<void>;
  rescore:        (resumeId: string) => Promise<RescoreResumeResponse>;
  refreshUrl:     (resumeId: string) => Promise<string | null>;
  deleteResume:   (resumeId: string) => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useResumeManager(
  options: UseResumeManagerOptions = {},
): UseResumeManagerReturn {
  // Destructure with explicit default so callers can omit the arg entirely
  const { enableBackgroundPolling = true } = options;

  const [resumes,       setResumes]       = useState<ResumeRecord[]>([]);
  const [isLoading,     setLoading]       = useState(false);
  const [isError,       setIsError]       = useState(false);
  const [error,         setError]         = useState<Error | null>(null);
  const [isUploading,   setIsUploading]   = useState(false);
  const [uploadError,   setUploadError]   = useState<Error | null>(null);
  const [rescoreJobId,  setRescoreJobId]  = useState<string | null>(null);
  const [rescoreStatus, setRescoreStatus] = useState<ResumeStatus | null>(null);

  // ── isProcessing: derived from active resume status ────────────────────────
  const activeResume  = resumes.find(r => r.isActive) ?? null;
  const isProcessing  = PROCESSING_STATUSES.includes(
    (activeResume?.status ?? '') as ResumeStatus
  );

  // Guard against duplicate polling intervals
  const processingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Guard against duplicate list-refresh calls (e.g. polling tick + upload
  // completing at the same time both calling refresh() simultaneously).
  const isRefreshingRef = useRef(false);

  // AS-01: Mounted ref — prevents state writes from the polling interval
  // callback after the component unmounts.
  //
  // RISK WITHOUT THIS: the setInterval callback calls refresh() every
  // PROCESSING_POLL_INTERVAL_MS (5 s). refresh() calls setResumes(),
  // setLoading(), setIsError() — React state setters. If the component
  // unmounts while the polling interval is active (e.g. navigating away from
  // the dashboard mid-poll), the next tick fires after unmount and calls those
  // setters — producing a React "setState on unmounted component" warning in
  // development and potential memory leaks in production.
  //
  // The poller cleanup in the useEffect return function clears the interval
  // synchronously, which eliminates the tick that would fire AFTER cleanup.
  // However, a tick that is ALREADY IN FLIGHT (i.e. the interval has fired
  // and refresh() is awaiting listResumes()) continues past cleanup. The
  // mounted ref is checked inside refresh() to guard those in-flight writes.
  //
  // WHY useRef instead of useState:
  //   The mounted flag is not a render input — it's a side-channel guard.
  //   Storing it in state would trigger a re-render on unmount, which React
  //   explicitly warns against. A ref is the correct pattern.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Fetch list ──────────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    // Deduplicate: if a list fetch is already in-flight, skip this call.
    // Prevents redundant API hits when polling tick and an upload completion
    // both fire refresh() within the same tick.
    if (isRefreshingRef.current) return;

    isRefreshingRef.current = true;
    // AS-01: Guard the initial state writes against an already-unmounted component.
    // This handles the edge case where refresh() is called synchronously just as
    // the component is unmounting (e.g. from an upload handler that fires as the
    // user navigates away). The async writes below are guarded by the post-await
    // mountedRef check.
    if (!mountedRef.current) { isRefreshingRef.current = false; return; }
    setLoading(true);
    setIsError(false);
    setError(null);
    try {
      const data = await listResumes();
      // AS-01: Guard post-await state writes against unmount.
      // This is the primary guard for the polling interval case: the interval
      // fires, refresh() starts awaiting listResumes(), the component unmounts,
      // listResumes() resolves — without this check setResumes() would fire on
      // an unmounted component.
      if (!mountedRef.current) return;
      // HARDENING: apiRequest() can legitimately resolve `undefined` for a
      // "no-content success" response (e.g. a 204/empty body, or the
      // documented dev-proxy 304-replay-as-`{}` case in api-parser.ts) since
      // listResumes() does not pass { requireData: true }. Without this
      // guard, setResumes(undefined) crashed the `resumes.find(...)` derivation
      // below on the very next render. Additive only — a genuine array of
      // resumes still passes straight through unchanged.
      setResumes(Array.isArray(data) ? data : []);
    } catch (err) {
      if (!mountedRef.current) return;
      const e = err instanceof Error ? err : new Error(String(err));
      setIsError(true);
      setError(e);
    } finally {
      // AS-01 (Phase 3A Step 5): Guard setLoading(false) against unmount.
      //
      // Risk without this: the finally block runs unconditionally — even when
      // the try/catch already returned early via `if (!mountedRef.current) return`.
      // In JavaScript, `return` inside try/catch does NOT skip the finally block.
      // This means setLoading(false) was previously firing on an unmounted
      // component every time an in-flight polling tick arrived after unmount.
      //
      // Fix: mirror the mountedRef guard into finally. isRefreshingRef reset is
      // always safe (it's a ref, not a state setter) and must run regardless of
      // mount status to prevent the dedup guard from locking out future refreshes
      // on a component that remounts (e.g. navigation back to dashboard).
      isRefreshingRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    // Async orchestration trigger: fires the initial resume list fetch after
    // mount. refresh() is an async function that sequences setLoading(true),
    // the listResumes() API call, and post-await state writes — all guarded
    // by mountedRef to prevent setState on unmounted components (AS-01).
    // This cannot be invoked at render time: the fetch is async and the
    // mountedRef guard requires post-commit timing to be valid. The effect
    // dep on `refresh` (a stable useCallback ref) ensures this fires once
    // on mount and re-fires only if the callback identity changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  // ── Background processing-status poller ────────────────────────────────────
  //
  // Only runs when enableBackgroundPolling is true (default).
  //
  // When the /resume page mounts it passes { enableBackgroundPolling: false }
  // because it manages its own polling loop with higher-resolution progress
  // tracking. This ensures at most ONE poller is active at any time:
  //
  //   Page            | enableBackgroundPolling | Active poller
  //   ────────────────┼─────────────────────────┼──────────────────────
  //   /resume         | false                   | page-level interval
  //   /dashboard      | true (default)          | this background loop
  //   other pages     | true (default)          | this background loop
  //
  useEffect(() => {
    // ── Poller suppressed for this mount ────────────────────────────────────
    if (!enableBackgroundPolling) {
      // Clear any stale interval that might linger from a previous render
      // (e.g. if the prop toggled from true → false mid-session).
      if (processingIntervalRef.current) {
        clearInterval(processingIntervalRef.current);
        processingIntervalRef.current = null;
      }
      return;
    }

    // ── No active resume or not processing — clear and stand down ───────────
    if (!isProcessing || !activeResume) {
      if (processingIntervalRef.current) {
        clearInterval(processingIntervalRef.current);
        processingIntervalRef.current = null;
      }
      return;
    }

    // Avoid duplicate intervals (idempotent guard)
    if (processingIntervalRef.current) return;

    processingIntervalRef.current = setInterval(async () => {
      // Phase 3B — Visibility-aware polling guard.
      //
      // Previously: the interval fired unconditionally every 5 seconds,
      // including when the tab was backgrounded (user switched to another
      // tab, locked their phone, etc.). This caused unnecessary network
      // requests to /api/v1/resume/:id/status during long resume processing
      // sessions with the app running in the background.
      //
      // Fix: skip the poll tick when the tab is hidden. The interval
      // remains active so it resumes immediately when the user returns
      // without requiring cleanup/restart logic. The document.visibilityState
      // check is synchronous, SSR-safe (no-op when document is undefined),
      // and has negligible runtime cost.
      //
      // On tab restoration, the next tick fires within PROCESSING_POLL_INTERVAL_MS
      // (≤5s), which is acceptable for a background status check.
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }

      try {
        const result = await getResumeStatus(activeResume.id);
        // If terminal status reached, refresh the full list to update state
        if (result.status === 'done' || result.status === 'failed') {
          clearInterval(processingIntervalRef.current!);
          processingIntervalRef.current = null;
          await refresh();
        }
      } catch (pollErr) {
        // Polling errors are non-destructive — background status check, not user-initiated.
        // Silent swallow is intentional: a transient poll failure should not interrupt
        // the user's session or show an error banner.
        //
        // Phase 3A Step 5 — observability: log at debug level in development so
        // repeated or unexpected poll failures are visible during testing without
        // surfacing noise in production. This converts a fully silent failure into
        // an observable one without changing user-visible behaviour.
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[useResumeManager] Polling tick error (non-fatal):', pollErr);
        }
      }
    }, PROCESSING_POLL_INTERVAL_MS);

    return () => {
      if (processingIntervalRef.current) {
        clearInterval(processingIntervalRef.current);
        processingIntervalRef.current = null;
      }
    };
  }, [isProcessing, activeResume, refresh, enableBackgroundPolling]);

  // ── Upload ──────────────────────────────────────────────────────────────────
  // Quota-aware: 429 from the API is re-thrown so pages can surface upgrade UI.

  const uploadResume = useCallback(async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    try {
      await uploadResumeApi(file);
      await refresh();
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setUploadError(e);
      throw e; // re-throw so page layer can handle quota (429)
    } finally {
      setIsUploading(false);
    }
  }, [refresh]);

  // ── Set active ──────────────────────────────────────────────────────────────

  const setActive = useCallback(async (resumeId: string) => {
    await setActiveResumeApi(resumeId);
    setResumes(prev =>
      prev.map(r => ({ ...r, isActive: r.id === resumeId }))
    );
  }, []);

  // ── Rescore ─────────────────────────────────────────────────────────────────
  // Quota-aware: 429 re-thrown for page layer to handle.

  const rescore = useCallback(async (resumeId: string): Promise<RescoreResumeResponse> => {
    const result = await rescoreResumeApi(resumeId); // throws on 429
    setRescoreJobId(result.jobId);
    setRescoreStatus(result.status);
    return result;
  }, []);

  // ── Refresh signed URL ──────────────────────────────────────────────────────

  const refreshUrl = useCallback(async (resumeId: string): Promise<string | null> => {
    const result = await refreshSignedUrlApi(resumeId);
    setResumes(prev =>
      prev.map(r =>
        r.id === resumeId ? { ...r, signedUrl: result.signedUrl } : r
      )
    );
    return result.signedUrl;
  }, []);

  // ── Delete ──────────────────────────────────────────────────────────────────

  const deleteResume = useCallback(async (resumeId: string) => {
    await deleteResumeApi(resumeId);
    setResumes(prev => prev.filter(r => r.id !== resumeId));
  }, []);

  return {
    resumes,
    activeResume,
    isLoading,
    isError,
    error,
    isUploading,
    uploadError,
    rescoreJobId,
    rescoreStatus,
    isProcessing,
    refresh,
    uploadResume,
    setActive,
    rescore,
    refreshUrl,
    deleteResume,
  };
}