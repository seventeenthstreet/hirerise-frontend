import { useState, useCallback, useRef } from 'react';

import { uploadResume as uploadResumeApi, getResumeStatus as getResumeStatusApi } from '@/lib/api/resume';
import type { ResumeStatus } from '@/lib/api/resume';
import type { ApiClientError } from '@/lib/api/core';

// ── PHASE 1: Analytics + Monitoring integration ───────────────────────────────
// Imported directly from lib — hooks are permitted lib consumers.
// UI layer must NOT call these directly.
import {
  trackEvent,
  funnelContract,
  EVENTS,
  FUNNELS,
} from '@/lib/analytics';
import {
  captureError,
  startTimer,
  trackPerformance,
  METRICS,
  SUBSYSTEMS,
  ACTIONS,
} from '@/lib/monitoring';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface ResumeUploadResult {
  resumeId: string;
  jobId: string;
  status: ResumeStatus;
}

export interface ResumeStatusResult {
  status: ResumeStatus;
  errorCode?: string;
  errorMessage?: string;
  data?: unknown;
}

export interface UseResumeReturn {
  // State
  resumeId: string | null;
  jobId: string | null;
  status: ResumeStatus | null;
  isUploading: boolean;
  uploadError: ApiClientError | null;
  // Actions — named to match page expectations
  uploadResume: (file: File) => Promise<ResumeUploadResult>;
  getResumeStatus: (id: string) => Promise<ResumeStatusResult>;
  /**
   * [FIX 3] Reset the hook's internal poll attempt counter.
   * Call at the start of every retry so terminal event payloads reflect
   * attempt counts for the current retry session, not the cumulative total.
   * The page layer owns its own attemptRef; this resets the hook's parallel counter.
   */
  resetPollAttempts: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useResume(): UseResumeReturn {
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [jobId,    setJobId]    = useState<string | null>(null);
  const [status,   setStatus]   = useState<ResumeStatus | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<ApiClientError | null>(null);

  // ── PHASE 1: Per-upload attempt counter ───────────────────────────────────
  // Shared between uploadResume and getResumeStatus so terminal events carry
  // the correct total attempt count across the full upload → poll lifecycle.
  const pollAttemptRef = useRef(0);

  // ── uploadResume ────────────────────────────────────────────────────────
  // POST /api/v1/resume/upload — multipart/form-data.
  // Returns the full result so the page layer can extract jobId for polling.
  //
  // PHASE 1 TRACKING:
  //  - resume_upload_started: intent event, carries file_size_kb
  //  - funnelContract.start: opens resume_upload funnel (sessionStorage-guarded,
  //    safe under StrictMode double-invoke and retry)
  //  - startTimer: measures upload transport latency
  //  - resume_upload_success / resume_upload_failed: outcome event
  //  - captureError on failure: monitoring context for observability
  //
  // FUNNEL NOTE: funnel is NOT completed on upload success.
  // Upload success ≠ processing success. The funnel terminal state
  // (complete or error) is set by getResumeStatus when polling settles.
  const uploadResume = useCallback(async (file: File): Promise<ResumeUploadResult> => {
    setIsUploading(true);
    setUploadError(null);
    pollAttemptRef.current = 0; // reset counter for this upload session

    // [PHASE 1] Upload intent + funnel open
    trackEvent(EVENTS.RESUME_UPLOAD_STARTED, {
      file_size_kb: Math.round(file.size / 1024),
    });
    funnelContract.start(FUNNELS.RESUME_UPLOAD, 'upload_started');

    const stopUploadTimer = startTimer(METRICS.RESUME_UPLOAD_DURATION);

    try {
      const result = await uploadResumeApi(file);
      setResumeId(result.resumeId);
      setJobId(result.jobId);
      setStatus(result.status);

      // [PHASE 1] Upload transport success — funnel remains open
      stopUploadTimer({ status: 'success' });
      trackEvent(EVENTS.RESUME_UPLOAD_SUCCESS, {});

      return result;
    } catch (err) {
      // [PHASE 1] Upload failure — funnel closed with error terminal state
      stopUploadTimer({ status: 'failed' });
      trackEvent(EVENTS.RESUME_UPLOAD_FAILED, {});
      funnelContract.error(FUNNELS.RESUME_UPLOAD, 'upload_failed');
      captureError(err, {
        subsystem: SUBSYSTEMS.RESUME_UPLOAD,
        action:    ACTIONS.UPLOAD_RESUME,
        severity:  'error',
      });

      setUploadError(err as ApiClientError);
      throw err; // re-throw: page handles quota / UI transitions
    } finally {
      setIsUploading(false);
    }
  }, []);

  // ── getResumeStatus ─────────────────────────────────────────────────────
  // GET /api/v1/resume/status/:id — called on each polling tick.
  //
  // PHASE 1 TRACKING:
  //  - Increments pollAttemptRef on each call
  //  - 'done': resume_processing_done (idempotency key on jobId) +
  //            funnelContract.complete + trackPerformance(attempts)
  //  - 'failed': resume_processing_failed (idempotency key on jobId) +
  //              funnelContract.error + captureError
  //  - network error: captureError only — page owns retry/timeout decisions
  //    and calls funnelContract.error on final terminal failure
  //
  // IDEMPOTENCY: terminal trackEvent calls are keyed on jobId so a duplicate
  // poll response (e.g. race between interval tick and manual retry) cannot
  // fire duplicate events. funnelContract calls are guarded by sessionStorage.
  const getResumeStatus = useCallback(async (id: string): Promise<ResumeStatusResult> => {
    pollAttemptRef.current += 1;
    const attempts = pollAttemptRef.current;

    try {
      const result = await getResumeStatusApi(id);
      setStatus(result.status);

      if (result.status === 'done') {
        // [PHASE 1] Processing complete — close funnel with success
        trackEvent(
          EVENTS.RESUME_PROCESSING_DONE,
          { attempts },
          { idempotencyKey: `resume_processing_done:${id}` },
        );
        funnelContract.complete(FUNNELS.RESUME_UPLOAD, 'processing_done', { attempts });
        trackPerformance(METRICS.RESUME_POLLING_ATTEMPTS, attempts, 'count', {
          exit_reason: 'success',
        });

      } else if (result.status === 'failed') {
        // [PHASE 1] Processing failure — close funnel with error terminal state
        const errorCode = result.error?.code;
        trackEvent(
          EVENTS.RESUME_PROCESSING_FAILED,
          { errorCode },
          { idempotencyKey: `resume_processing_failed:${id}` },
        );
        funnelContract.error(FUNNELS.RESUME_UPLOAD, 'processing_failed', {
          reason:    'api_error',
          errorCode: errorCode ?? 'unknown',
          attempts,
        });
        captureError(
          new Error(result.error?.message ?? 'Resume processing failed'),
          {
            subsystem: SUBSYSTEMS.RESUME_POLLING,
            action:    ACTIONS.POLL_TICK,
            errorCode: errorCode,
            metadata:  { attempts },
            severity:  'error',
          },
        );
      }
      // 'pending' | 'processing': intermediate — no tracking, polling continues

      // Map ResumeStatusResponse → ResumeStatusResult (page-layer contract)
      return {
        status:       result.status,
        errorCode:    result.error?.code,
        errorMessage: result.error?.message,
        data:         result.result,
      } satisfies ResumeStatusResult;
    } catch (err) {
      // [PHASE 1] Network error during poll — captureError only.
      // Funnel stays open — network may recover. Page calls funnelContract.error
      // only when it makes the final decision to stop (timeout / max retries).
      captureError(err, {
        subsystem: SUBSYSTEMS.RESUME_POLLING,
        action:    ACTIONS.POLL_TICK,
        metadata:  { attempts },
        severity:  'warning',
      });
      throw err; // re-throw: page owns retry / backoff / terminal decisions
    }
  }, []);

  // ── resetPollAttempts ────────────────────────────────────────────────────
  // [FIX 3] Called by the page at the start of every retry so that terminal
  // event payloads reflect attempt counts for the current retry session only.
  // Without this, attempts in `resume_processing_done` / `resume_processing_failed`
  // would count from the very first upload rather than the current retry window.
  const resetPollAttempts = useCallback((): void => {
    pollAttemptRef.current = 0;
  }, []);

  return {
    resumeId,
    jobId,
    status,
    isUploading,
    uploadError,
    uploadResume,
    getResumeStatus,
    resetPollAttempts, // [FIX 3]
  };
}