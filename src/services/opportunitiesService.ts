/**
 * src/services/opportunitiesService.ts
 *
 * Fetches matched university programs and job opportunities for a student.
 */

import { apiFetch } from '@/services/apiClient';

export interface UniversityOpportunity {
  program:        string;
  university:     string;
  degree_type:    string;
  duration_years: number;
  tuition_cost:   number;
  country:        string;
  match_score:    number;
}

export interface JobOpportunity {
  role:            string;
  company:         string;
  industry:        string;
  salary_range:    { min: number; max: number; currency: string };
  required_skills: string[];
  match_score:     number;
}

export interface StudentOpportunities {
  student_id:   string;
  universities: UniversityOpportunity[];
  jobs:         JobOpportunity[];
}

export const opportunitiesService = {
  getOpportunities: (studentId: string) =>
    apiFetch<StudentOpportunities>(`/opportunities/${studentId}`),
};
