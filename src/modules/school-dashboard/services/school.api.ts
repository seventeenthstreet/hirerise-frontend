/**
 * src/modules/school-dashboard/services/school.api.ts
 *
 * All API calls for the School & Counselor Platform frontend.
 * Uses apiFetch from services/apiClient.ts — auth headers handled automatically.
 */

import { apiFetch } from '@/services/apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface School {
  id:          string;
  school_name: string;
  location:    string | null;
  created_by:  string;
  created_at:  string;
}

export interface SchoolUser {
  id:         string;
  school_id:  string;
  user_id:    string;
  role:       'school_admin' | 'counselor';
  created_at: string;
}

export interface SchoolStudent {
  link_id:            string;
  student_id:         string;
  name:               string | null;
  email:              string | null;
  class:              string | null;
  section:            string | null;
  education_level:    string | null;
  onboarding_step:    string | null;
  assessment_done:    boolean;
  recommended_stream: string | null;
  recommended_label:  string | null;
  stream_confidence:  number | null;
}

export interface StreamDistribution {
  stream:   string;
  label:    string;
  count:    number;
  percent:  number;
}

export interface CareerCount {
  career:        string;
  student_count: number;
}

export interface SchoolAnalytics {
  total_students:      number;
  students_assessed:   number;
  assessment_rate:     number;
  stream_distribution: StreamDistribution[];
  top_careers:         CareerCount[];
}

export interface StudentReport {
  student:            Record<string, unknown> | null;
  stream_analysis:    Record<string, unknown> | null;
  cognitive_profile:  Record<string, unknown> | null;
  academic_records:   Record<string, unknown>[];
  career_predictions: Record<string, unknown>[];
  education_roi:      Record<string, unknown>[];
  career_simulations: Record<string, unknown>[];
  generated_at:       string;
}

export interface ImportResult {
  imported: number;
  skipped:  number;
  errors:   { row: number; email: string; reason: string }[];
  students: { name: string; email: string; uid: string; class: string; section: string }[];
}

// ─── API functions ────────────────────────────────────────────────────────────

export function createSchool(payload: { school_name: string; location?: string }): Promise<{ school: School }> {
  return apiFetch('/school', { method: 'POST', body: JSON.stringify(payload) });
}

export function getMySchools(): Promise<{ schools: School[] }> {
  return apiFetch('/school/my');
}

export function getSchool(schoolId: string): Promise<{ school: School }> {
  return apiFetch(`/school/${schoolId}`);
}

export function addCounselor(schoolId: string, email: string): Promise<unknown> {
  return apiFetch(`/school/${schoolId}/counselors`, {
    method: 'POST',
    body:   JSON.stringify({ email }),
  });
}

export function getCounselors(schoolId: string): Promise<{ counselors: SchoolUser[] }> {
  return apiFetch(`/school/${schoolId}/counselors`);
}

export function listStudents(schoolId: string): Promise<{ students: SchoolStudent[] }> {
  return apiFetch(`/school/${schoolId}/students`);
}

export function importStudentsCSV(schoolId: string, file: File): Promise<ImportResult> {
  const form = new FormData();
  form.append('file', file);
  return apiFetch(`/school/${schoolId}/students/import`, {
    method: 'POST',
    body:   form,
  });
}

export function runAssessment(schoolId: string, studentId: string): Promise<unknown> {
  return apiFetch(`/school/${schoolId}/run-assessment/${studentId}`, { method: 'POST' });
}

export function getStudentReport(schoolId: string, studentId: string): Promise<StudentReport> {
  return apiFetch(`/school/${schoolId}/student-report/${studentId}`);
}

export function getAnalytics(schoolId: string): Promise<SchoolAnalytics> {
  return apiFetch(`/school/${schoolId}/analytics`);
}

export const schoolApi = {
  createSchool,
  getMySchools,
  getSchool,
  addCounselor,
  getCounselors,
  listStudents,
  importStudentsCSV,
  runAssessment,
  getStudentReport,
  getAnalytics,
};
