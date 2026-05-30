/**
 * @file lib/api/resume.ts  (EXTENDED — replaces original)
 * @description Frontend API wrappers for the full Resume module lifecycle.
 *
 * Endpoints covered:
 *   POST /api/v1/resumes                    → uploadResume  (async, returns jobId)
 *   GET  /api/v1/resumes                    → listResumes
 *   GET  /api/v1/resumes/:id                → getResume
 *   GET  /api/v1/resumes/:resumeId/status   → getResumeStatus
 *   DELETE /api/v1/resumes/:id              → deleteResume
 *   POST /api/v1/resumes/set-active         → setActiveResume
 *   POST /api/v1/resumes/:resumeId/rescore  → rescoreResume
 *   POST /api/v1/resumes/:resumeId/refresh-url → refreshSignedUrl
 *
 * RULES:
 *  - No endpoints invented — all match core/src/modules/resume/resume.routes.js
 *  - No business logic — thin wrappers around apiRequest only
 *  - Hooks own state; pages own polling
 */

import { apiRequest } from './core';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Possible processing states for a resume record. */
export type ResumeStatus = 'pending' | 'processing' | 'done' | 'failed';

/**
 * A single resume record as returned by GET /resumes and GET /resumes/:id.
 * `score` and `parsedData` are populated only when status === 'done'.
 */
export interface ResumeRecord {
  id:          string;
  userId:      string;
  fileName:    string;
  mimeType?:   string;
  status:      ResumeStatus;
  isActive:    boolean;
  score?:      number | null;
  parsedData?: unknown | null;
  signedUrl?:  string | null;
  createdAt:   string;
  updatedAt:   string;
}

/**
 * Returned immediately after a POST /resumes upload.
 * Processing is async — use getResumeStatus() to poll until done | failed.
 */
export interface UploadResumeResponse {
  resumeId: string;
  jobId:    string;
  status:   ResumeStatus;
}

/**
 * Polling response from GET /resumes/:resumeId/status.
 * `result` is populated only when status === 'done'.
 * `error`  is populated only when status === 'failed'.
 */
export interface ResumeStatusResponse {
  resumeId:   string;
  status:     ResumeStatus;
  result?:    unknown;
  error?:     { code?: string; message?: string };
  updatedAt?: string;
}

/** Response from POST /resumes/set-active */
export interface SetActiveResumeResponse {
  resumeId: string;
  isActive: boolean;
}

/** Response from POST /resumes/:id/rescore */
export interface RescoreResumeResponse {
  resumeId: string;
  jobId:    string;
  status:   ResumeStatus;
}

/** Response from POST /resumes/:id/refresh-url */
export interface RefreshSignedUrlResponse {
  resumeId:  string;
  signedUrl: string;
  expiresAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upload a resume file (PDF, DOC, DOCX, TXT — max 10 MB).
 * Processing is async. Use the returned resumeId to poll getResumeStatus().
 * Form field name must be 'resume' (validated by backend multer config).
 */
export function uploadResume(file: File): Promise<UploadResumeResponse> {
  const form = new FormData();
  form.append('resume', file);

  return apiRequest<UploadResumeResponse>({
    url:     '/resumes',
    method:  'POST',
    data:    form,
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// LIST & GET
// ─────────────────────────────────────────────────────────────────────────────

/**
 * List all resumes for the authenticated user.
 * Returns them sorted newest-first; the active resume has isActive === true.
 */
export function listResumes(): Promise<ResumeRecord[]> {
  return apiRequest<ResumeRecord[]>({
    url:    '/resumes',
    method: 'GET',
  });
}

/**
 * Fetch a single resume record by ID.
 * Includes signedUrl for download if still valid.
 */
export function getResume(resumeId: string): Promise<ResumeRecord> {
  return apiRequest<ResumeRecord>({
    url:    `/resumes/${resumeId}`,
    method: 'GET',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS (POLLING)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Poll the processing status of an uploaded resume.
 * Use this after uploadResume() until status is 'done' or 'failed'.
 * Canonical polling endpoint — do NOT use /ai-jobs/:jobId.
 */
export function getResumeStatus(resumeId: string): Promise<ResumeStatusResponse> {
  return apiRequest<ResumeStatusResponse>({
    url:    `/resumes/${resumeId}/status`,
    method: 'GET',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// LIFECYCLE ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Set a specific resume as the active resume.
 * Only one resume can be active at a time — backend handles deactivating others.
 */
export function setActiveResume(resumeId: string): Promise<SetActiveResumeResponse> {
  return apiRequest<SetActiveResumeResponse>({
    url:    '/resumes/set-active',
    method: 'POST',
    data:   { resumeId },
  });
}

/**
 * Trigger a rescore for an existing resume.
 * Returns a new jobId — poll getResumeStatus() for the updated score.
 * Requires a paid plan (backend enforces via requirePaidPlan middleware).
 */
export function rescoreResume(resumeId: string): Promise<RescoreResumeResponse> {
  return apiRequest<RescoreResumeResponse>({
    url:    `/resumes/${resumeId}/rescore`,
    method: 'POST',
  });
}

/**
 * Refresh the signed download URL for a resume.
 * Signed URLs expire — call this when signedUrl is stale or missing.
 */
export function refreshSignedUrl(resumeId: string): Promise<RefreshSignedUrlResponse> {
  return apiRequest<RefreshSignedUrlResponse>({
    url:    `/resumes/${resumeId}/refresh-url`,
    method: 'POST',
  });
}

/**
 * Delete a resume by ID.
 * If the deleted resume was active, the backend selects the next resume as active.
 */
export function deleteResume(resumeId: string): Promise<void> {
  return apiRequest<void>({
    url:    `/resumes/${resumeId}`,
    method: 'DELETE',
  });
}