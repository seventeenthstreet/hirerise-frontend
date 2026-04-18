/**
 * src/modules/university-dashboard/services/university.api.ts
 *
 * All API calls for the University Dashboard frontend.
 * Uses apiFetch from services/apiClient.ts — auth headers handled automatically.
 */

import { apiFetch } from '@/services/apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface University {
  id:              string;
  university_name: string;
  country:         string | null;
  website:         string | null;
  created_by:      string;
  created_at:      string;
}

export interface Program {
  id:              string;
  university_id:   string;
  program_name:    string;
  degree_type:     string;
  duration_years:  number;
  tuition_cost:    number;
  streams:         string[];
  career_outcomes: string[];
  created_at:      string;
}

export interface ProgramMatch {
  program_id:          string;
  program_name:        string;
  degree_type:         string;
  university_name:     string;
  country:             string;
  match_score:         number;
  match_reasons: {
    stream_alignment: number;
    career_alignment: number;
    skill_match:      number;
  };
}

export interface ProgramAnalytics {
  program_id:     string;
  program_name:   string;
  degree_type:    string;
  matched_count:  number;
  avg_score:      number;
  top_skills:     { skill: string; student_count: number }[];
}

export interface UniversityAnalytics {
  university_id:           string;
  total_programs:          number;
  total_matched_students:  number;
  programs:                ProgramAnalytics[];
}

export interface StudentMatchInsights {
  program_id:    string;
  program_name:  string;
  total_matched: number;
  avg_match_score: number;
  stream_distribution: { stream: string; count: number }[];
  top_student_skills:  { skill: string; student_count: number }[];
}

export interface CreateUniversityPayload {
  university_name: string;
  country?:        string;
  website?:        string;
}

export interface CreateProgramPayload {
  program_name:    string;
  degree_type?:    string;
  duration_years?: number;
  tuition_cost?:   number;
  streams?:        string[];
  career_outcomes?: string[];
}

// ─── API methods ──────────────────────────────────────────────────────────────

export const universityApi = {
  // University management
  createUniversity: (payload: CreateUniversityPayload) =>
    apiFetch<{ university: University }>('/university', {
      method: 'POST',
      body:   JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    }),

  getMyUniversities: () =>
    apiFetch<{ universities: University[] }>('/university/my'),

  getUniversity: (universityId: string) =>
    apiFetch<{ university: University }>(`/university/${universityId}`),

  // Programs
  createProgram: (universityId: string, payload: CreateProgramPayload) =>
    apiFetch<{ program: Program }>(`/university/${universityId}/programs`, {
      method: 'POST',
      body:   JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    }),

  listPrograms: (universityId: string) =>
    apiFetch<{ programs: Program[] }>(`/university/${universityId}/programs`),

  updateProgram: (universityId: string, programId: string, payload: Partial<CreateProgramPayload>) =>
    apiFetch<{ program: Program }>(`/university/${universityId}/programs/${programId}`, {
      method: 'PATCH',
      body:   JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    }),

  deleteProgram: (universityId: string, programId: string) =>
    apiFetch<{ deleted: boolean }>(`/university/${universityId}/programs/${programId}`, {
      method: 'DELETE',
    }),

  // Analytics
  getAnalytics: (universityId: string) =>
    apiFetch<UniversityAnalytics>(`/university/${universityId}/analytics`),

  getProgramMatches: (universityId: string, programId: string) =>
    apiFetch<StudentMatchInsights>(
      `/university/${universityId}/programs/${programId}/matches`
    ),
};
