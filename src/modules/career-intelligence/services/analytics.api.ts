/**
 * src/modules/career-intelligence/services/analytics.api.ts
 *
 * Typed API client for the Global Career Intelligence Dashboard endpoints.
 * Uses apiFetch from apiClient.ts — auth headers handled automatically.
 */

import { apiFetch } from '@/services/apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CareerDemandItem {
  career:          string;
  demand_index:    number;
  demand_score:    number;
  trend_score:     number;
  salary_growth:   number;
  automation_risk: number;
  entry_salary:    number;
  salary_10yr:     number;
}

export interface CareerDemandResponse {
  careers:      CareerDemandItem[];
  generated_at: string;
}

export interface SkillDemandItem {
  skill:         string;
  demand_index:  number;
  demand_score:  number;
  growth_rate:   number;
  industries:    string[];
}

export interface SkillDemandResponse {
  skills:       SkillDemandItem[];
  generated_at: string;
}

export interface ROIPath {
  path:           string;
  duration_years: number;
  estimated_cost: number;
  avg_salary:     number;
  roi_score:      number;
  roi_level:      'Very High' | 'High' | 'Moderate' | 'Low';
  payback_years:  number;
  streams:        string[];
}

export interface EducationROIResponse {
  paths:        ROIPath[];
  generated_at: string;
}

export interface GrowthMilestone {
  year:   number;
  salary: number;
}

export interface CareerGrowthItem {
  career:        string;
  entry_salary:  number;
  salary_3yr:    number;
  salary_5yr:    number;
  salary_10yr:   number;
  annual_growth: number;
  demand_score:  number;
  milestones:    GrowthMilestone[];
}

export interface CareerGrowthResponse {
  forecasts:    CareerGrowthItem[];
  generated_at: string;
}

export interface IndustryItem {
  industry:      string;
  growth_signal: number;
  growth_label:  string;
  yoy:           number;
  jobs_added:    number;
  description:   string;
}

export interface IndustryTrendsResponse {
  industries:   IndustryItem[];
  generated_at: string;
}

export interface OverviewResponse {
  careerDemand:   CareerDemandResponse;
  skillDemand:    SkillDemandResponse;
  educationROI:   EducationROIResponse;
  careerGrowth:   CareerGrowthResponse;
  industryTrends: IndustryTrendsResponse;
}

// ─── API functions ────────────────────────────────────────────────────────────

export function getCareerDemand(): Promise<CareerDemandResponse> {
  return apiFetch('/analytics/career-demand');
}

export function getSkillDemand(): Promise<SkillDemandResponse> {
  return apiFetch('/analytics/skill-demand');
}

export function getEducationROI(): Promise<EducationROIResponse> {
  return apiFetch('/analytics/education-roi');
}

export function getCareerGrowth(): Promise<CareerGrowthResponse> {
  return apiFetch('/analytics/career-growth');
}

export function getIndustryTrends(): Promise<IndustryTrendsResponse> {
  return apiFetch('/analytics/industry-trends');
}

/** Fetch all five metrics in a single round trip. */
export function getOverview(): Promise<OverviewResponse> {
  return apiFetch('/analytics/overview');
}

export const analyticsApi = {
  getCareerDemand,
  getSkillDemand,
  getEducationROI,
  getCareerGrowth,
  getIndustryTrends,
  getOverview,
};
