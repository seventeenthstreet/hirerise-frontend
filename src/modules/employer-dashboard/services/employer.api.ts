/**
 * src/modules/employer-dashboard/services/employer.api.ts
 *
 * All API calls for the Employer Dashboard frontend.
 * Uses apiFetch from services/apiClient.ts — auth headers handled automatically.
 */

import { apiFetch } from '@/services/apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Employer {
  id:           string;
  company_name: string;
  industry:     string | null;
  website:      string | null;
  created_by:   string;
  created_at:   string;
}

export interface SalaryRange {
  min:      number;
  max:      number;
  currency: string;
}

export interface JobRole {
  id:              string;
  employer_id:     string;
  role_name:       string;
  required_skills: string[];
  salary_range:    SalaryRange;
  streams:         string[];
  experience_years: { min: number; max: number };
  active:          boolean;
  created_at:      string;
}

export interface SkillGap {
  skill:               string;
  students_with_skill: number;
  coverage_percent:    number;
}

export interface RolePipelineStats {
  role_id:         string;
  role_name:       string;
  required_skills: string[];
  salary_range:    SalaryRange;
  pipeline_count:  number;
  avg_match_score: number;
  skill_gap:       SkillGap[];
  stream_distribution: { stream: string; count: number }[];
}

export interface SkillTrend {
  skill:        string;
  demand_count: number;
}

export interface TalentPipeline {
  employer_id:  string;
  total_roles:  number;
  total_talent: number;
  skill_trends: SkillTrend[];
  roles:        RolePipelineStats[];
}

export interface RoleMatchInsights {
  role_id:        string;
  role_name:      string;
  total_pipeline: number;
  avg_match_score: number;
  skill_gap_analysis: SkillGap[];
  stream_distribution: { stream: string; count: number }[];
}

export interface CreateEmployerPayload {
  company_name: string;
  industry?:    string;
  website?:     string;
}

export interface CreateJobRolePayload {
  role_name:        string;
  required_skills?: string[];
  salary_min?:      number;
  salary_max?:      number;
  currency?:        string;
  streams?:         string[];
  exp_min?:         number;
  exp_max?:         number;
}

// ─── API methods ──────────────────────────────────────────────────────────────

export const employerApi = {
  createEmployer: (payload: CreateEmployerPayload) =>
    apiFetch<{ employer: Employer }>('/employer', {
      method: 'POST',
      body:   JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    }),

  getMyEmployers: () =>
    apiFetch<{ employers: Employer[] }>('/employer/my'),

  getEmployer: (employerId: string) =>
    apiFetch<{ employer: Employer }>(`/employer/${employerId}`),

  createJobRole: (employerId: string, payload: CreateJobRolePayload) =>
    apiFetch<{ role: JobRole }>(`/employer/${employerId}/roles`, {
      method: 'POST',
      body:   JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    }),

  listJobRoles: (employerId: string) =>
    apiFetch<{ roles: JobRole[] }>(`/employer/${employerId}/roles`),

  updateJobRole: (employerId: string, roleId: string, payload: Partial<CreateJobRolePayload>) =>
    apiFetch<{ role: JobRole }>(`/employer/${employerId}/roles/${roleId}`, {
      method: 'PATCH',
      body:   JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    }),

  deactivateJobRole: (employerId: string, roleId: string) =>
    apiFetch<{ deactivated: boolean }>(`/employer/${employerId}/roles/${roleId}`, {
      method: 'DELETE',
    }),

  getTalentPipeline: (employerId: string) =>
    apiFetch<TalentPipeline>(`/employer/${employerId}/talent-pipeline`),

  getRoleMatches: (employerId: string, roleId: string) =>
    apiFetch<RoleMatchInsights>(`/employer/${employerId}/roles/${roleId}/matches`),
};
