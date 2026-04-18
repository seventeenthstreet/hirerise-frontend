// hooks/useJobMatches.ts
// TanStack Query hooks for the Job Seeker Job Matching Engine.

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/services/apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JobMatch {
  id:               string;
  title:            string;
  sector:           string | null;
  description:      string | null;
  match_score:      number;
  skill_score:      number;
  experience_score: number;
  industry_score:   number;
  role_score:       number;
  missing_skills:   string[];
  salary: {
    min: number | null;
    max: number | null;
    currency?: string;
    unit?: string;
  } | null;
}

export interface JobMatchData {
  recommended_jobs:      JobMatch[];
  total_roles_evaluated: number;
  user_skills_count:     number;
  target_role:           string | null;
  industry:              string | null;
  message?:              string;
}

export interface RecommendationsData extends JobMatchData {
  summary: string;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useJobMatches(limit = 10, minScore = 30) {
  return useQuery<JobMatchData>({
    queryKey: ['job-seeker', 'job-matches', limit, minScore],
    queryFn:  () =>
      apiFetch<JobMatchData>(
        `/job-seeker/jobs/match?limit=${limit}&minScore=${minScore}`
      ),
    staleTime: 5 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
    retry: 1,
  });
}

export function useJobRecommendations() {
  return useQuery<RecommendationsData>({
    queryKey: ['job-seeker', 'job-recommendations'],
    queryFn:  () =>
      apiFetch<RecommendationsData>('/job-seeker/jobs/recommendations'),
    staleTime: 5 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
    retry: 1,
  });
}