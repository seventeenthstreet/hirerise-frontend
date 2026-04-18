// services/resumeService.ts
//
// Handles resume upload, history, and job polling via the HireRise API.
// POST /api/v1/resumes/upload  — multipart upload
// GET  /api/v1/resumes         — list resumes
// GET  /api/v1/ai-jobs/:jobId  — poll job status

import { apiFetch } from './apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ResumeStatus = 'processing' | 'completed' | 'failed' | 'pending';

export interface ResumeScoreBreakdown {
  clarity:      number;   // 0-100
  relevance:    number;
  experience:   number;
  skills:       number;
  achievements: number;
}

export interface Resume {
  id: string;
  fileName: string;
  fileSize: number;       // bytes
  mimeType: string;
  status: ResumeStatus;
  extractedSkills: string[];
  uploadedAt: string;     // ISO 8601
  analysedAt: string | null;
  // ATS coaching fields — populated after resume scoring
  resumeScore?:    number | null;
  scoreBreakdown?: ResumeScoreBreakdown | null;
  improvements?:   string[];
  topSkills?:      string[];
}

export interface ResumeUploadResponse {
  /** jobId to poll for processing status */
  jobId: string;
  resumeId: string;
  fileName: string;
  status: ResumeStatus;
  pollUrl: string;
  message: string;
}

export interface ResumeListResponse {
  items: Resume[];
  total: number;
}

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface AiJobResponse {
  jobId: string;
  operationType: string;
  status: JobStatus;
  result: Record<string, unknown> | null;
  error: { code: string; message: string } | null;
  createdAt: string;
  completedAt: string | null;
}

// ─── Progress steps for the UI ────────────────────────────────────────────────

export const UPLOAD_STEPS = [
  { key: 'uploading',  label: 'Uploading CV',                  statuses: [] as JobStatus[] },
  { key: 'parsing',   label: 'Parsing Resume',                 statuses: ['pending'] as JobStatus[] },
  { key: 'analyzing', label: 'Analyzing Skills',               statuses: ['processing'] as JobStatus[] },
  { key: 'generating',label: 'Generating Career Health Index', statuses: ['processing'] as JobStatus[] },
  { key: 'done',      label: 'Complete',                       statuses: ['completed', 'failed'] as JobStatus[] },
] as const;

// ─── Service ──────────────────────────────────────────────────────────────────

export const resumeService = {
  /**
   * POST /api/v1/resumes/upload
   *
   * CRITICAL: We pass headers: {} to prevent apiClient from setting
   * Content-Type: application/json. The browser must set multipart/form-data
   * with the correct boundary automatically when body is a FormData instance.
   *
   * The form field name MUST be 'resume' — this matches multer's
   * upload.single('resume') configuration in resume.routes.js.
   */
  async uploadResume(file: File): Promise<ResumeUploadResponse> {
    const form = new FormData();
    form.append('resume', file, file.name);

    const raw = await apiFetch<{
      resume: {
        resumeId: string;
        fileName: string;
        status: string;
        jobId?: string;
        pollUrl?: string;
      };
    }>('/resumes', {
      method: 'POST',
      body: form,
      headers: {}, // MUST be empty — let browser set multipart boundary
      skipRetry: true, // never retry file uploads
    });

    // Normalise the backend shape → frontend shape
    return {
      jobId:    raw.resume.jobId    ?? raw.resume.resumeId,
      resumeId: raw.resume.resumeId,
      fileName: raw.resume.fileName,
      status:   (raw.resume.status as ResumeStatus) ?? 'pending',
      pollUrl:  raw.resume.pollUrl  ?? `/api/v1/ai-jobs/${raw.resume.resumeId}`,
      message:  'Resume uploaded successfully. Processing has started.',
    };
  },

  /** GET /api/v1/resumes — list user's uploaded resumes */
  listResumes(): Promise<ResumeListResponse> {
    return apiFetch<ResumeListResponse>('/resumes');
  },

  /** GET /api/v1/resumes/:id */
  getResume(id: string): Promise<Resume> {
    return apiFetch<Resume>(`/resumes/${id}`);
  },

  /** DELETE /api/v1/resumes/:id */
  deleteResume(id: string): Promise<null> {
    return apiFetch<null>(`/resumes/${id}`, { method: 'DELETE' });
  },

  /** POST /api/v1/resumes/set-active */
  setActiveResume(resumeId: string): Promise<{ resumeId: string; message: string }> {
    return apiFetch(`/resumes/set-active`, {
      method: 'POST',
      body: JSON.stringify({ resumeId }),
    });
  },

  /** GET /api/v1/ai-jobs/:jobId — poll async job status */
  pollJob(jobId: string): Promise<AiJobResponse> {
    return apiFetch<AiJobResponse>(`/ai-jobs/${jobId}`);
  },
};