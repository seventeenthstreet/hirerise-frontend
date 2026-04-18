/**
 * src/modules/education/services/education.api.ts
 *
 * All API calls for the Education Intelligence module.
 * Uses apiFetch from services/apiClient.ts — auth headers handled automatically.
 */

import { apiFetch } from '@/services/apiClient';

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface ROIOption {
  path:            string;
  duration_years:  number;
  estimated_cost:  number;
  expected_salary: number;
  roi_score:       number;
  roi_level:       'Very High' | 'High' | 'Moderate' | 'Low';
  matched_careers: string[];
}

export interface Milestone {
  year:   number;
  salary: number;
}

export interface Simulation {
  career:              string;
  probability:         number;
  entry_salary:        number;
  salary_3_year:       number;
  salary_5_year:       number;
  salary_10_year:      number;
  annual_growth_rate:  number;
  demand_level:        string;
  roi_level:           string;
  best_education_path: string | null;
  milestones:          Milestone[];
}

export interface CareerTrend {
  career_name:     string;
  demand_score:    number;
  trend_score:     number;
  automation_risk: number;
  salary_growth:   number;
  top_skills?:     string[];
}

export interface SkillDemand {
  skill_name:     string;
  demand_score:   number;
  growth_rate:    number;
  industry_usage: string[];
}

export interface CareerItem {
  career:      string;
  probability: number;
}

export interface SubjectData {
  trend?:        string;
  latest_marks?: number;
  velocity?:     number;
  strength?:     string;
}

export interface StreamScores {
  engineering: number;
  medical:     number;
  commerce:    number;
  humanities:  number;
  [key: string]: number;
}

export interface AnalysisResult {
  recommended_stream:  string;
  recommended_label:   string;
  confidence:          number;
  alternative_stream?: string;
  alternative_label?:  string;
  stream_scores:       StreamScores;
  rationale:           string;
  top_careers?:        CareerItem[];
  education_options?:  ROIOption[];
  simulations?:        Simulation[];
  _debug?: {
    cognitive?: {
      scores?:        Record<string, number>;
      profile_label?: string;
      strengths?:     string[];
    };
    academic?: {
      subject_trends?:            Record<string, SubjectData>;
      overall_learning_velocity?: number;
    };
    activity?: Record<string, unknown>;
  };
}

// ─── API functions ────────────────────────────────────────────────────────────

export function createStudent(payload: { name: string; email: string; education_level: string }) {
  return apiFetch('/education/student', {
    method: 'POST',
    body:   JSON.stringify(payload),
  });
}

export function saveAcademics(records: unknown[]) {
  return apiFetch('/education/academics', {
    method: 'POST',
    body:   JSON.stringify({ records }),
  });
}

export function saveActivities(activities: unknown[]) {
  return apiFetch('/education/activities', {
    method: 'POST',
    body:   JSON.stringify({ activities }),
  });
}

export function saveCognitive(payload: Record<string, unknown>) {
  return apiFetch('/education/cognitive', {
    method: 'POST',
    body:   JSON.stringify(payload),
  });
}

export function getStudentProfile(userId: string) {
  return apiFetch(`/education/student/${userId}`);
}

export function getAnalysisResult(studentId: string): Promise<AnalysisResult> {
  return apiFetch(`/education/analyze/${studentId}`);
}

export function triggerAnalysis(studentId: string, { requireComplete = true } = {}) {
  return apiFetch(
    `/education/analyze/${studentId}?requireComplete=${requireComplete}`,
    { method: 'POST' }
  );
}

export function triggerCareerPrediction(studentId: string): Promise<{ top_careers: CareerItem[] }> {
  return apiFetch(`/education/career-prediction/${studentId}`, { method: 'POST' });
}

export function getCareerPredictions(studentId: string): Promise<{ top_careers: CareerItem[] }> {
  return apiFetch(`/education/career-prediction/${studentId}`);
}

export function triggerROIAnalysis(studentId: string): Promise<{ education_options: ROIOption[] }> {
  return apiFetch(`/education/roi-analysis/${studentId}`, { method: 'POST' });
}

export function getROIAnalysis(studentId: string): Promise<{ education_options: ROIOption[] }> {
  return apiFetch(`/education/roi-analysis/${studentId}`);
}

export function triggerCareerSimulation(studentId: string): Promise<{ simulations: Simulation[] }> {
  return apiFetch(`/education/career-simulation/${studentId}`, { method: 'POST' });
}

export function getCareerSimulations(studentId: string): Promise<{ simulations: Simulation[] }> {
  return apiFetch(`/education/career-simulation/${studentId}`);
}

// ─── Labor Market Intelligence API ───────────────────────────────────────────

export function getMarketCareerTrends(): Promise<{ career_trends: CareerTrend[] }> {
  return apiFetch('/market/career-trends');
}

export function getMarketSkillDemand(limit = 20): Promise<{ skills: SkillDemand[] }> {
  return apiFetch(`/market/skill-demand?limit=${limit}`);
}

export function getMarketSalaryBenchmarks() {
  return apiFetch('/market/salary-benchmarks');
}

export const educationApi = {
  createStudent,
  saveAcademics,
  saveActivities,
  saveCognitive,
  getStudentProfile,
  getAnalysisResult,
  triggerAnalysis,
  triggerCareerPrediction,
  getCareerPredictions,
  triggerROIAnalysis,
  getROIAnalysis,
  triggerCareerSimulation,
  getCareerSimulations,
  getMarketCareerTrends,
  getMarketSkillDemand,
  getMarketSalaryBenchmarks,
};
