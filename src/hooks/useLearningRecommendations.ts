'use client';

// hooks/useLearningRecommendations.ts
//
// Calls POST /api/v1/learning/recommendations/from-profile
// Wired to the Learning Recommendation Engine.
//
// Accepts role + skills — the backend detects skill gaps and returns
// course recommendations in one call (no separate gap analysis needed).
//
// Body:    { role, skills, experience_years }
// Returns: { learning_recommendations: [{ skill, courses: [...] }], summary, meta }

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/services/apiClient';

export interface CourseRecord {
  skill:          string;
  course_name:    string;
  provider:       string;
  level:          'Beginner' | 'Intermediate' | 'Advanced';
  duration_hours: number;
  url:            string;
}

export interface LearningRecommendation {
  skill:   string;
  courses: CourseRecord[];
}

export interface LearningResult {
  learning_recommendations: LearningRecommendation[];
  summary: {
    total_skills_addressed: number;
    total_courses_found:    number;
    skills_without_courses: string[];
    total_hours:            number;
    estimated_weeks:        number;
    estimated_months:       number;
  };
  meta: {
    engine_version:  string;
    role:            string | null;
    target_role:     string | null;
    skill_gaps_in:   number;
    calculated_at:   string;
  };
}

interface FetchInput {
  role:             string;
  skills:           string[];
  experience_years?: number;
}

export const LEARNING_KEY = (role: string) => ['learning-recommendations', role] as const;

export function useLearningRecommendations(input: FetchInput | null) {
  return useQuery<LearningResult>({
    queryKey: LEARNING_KEY(input?.role ?? ''),
    queryFn:  async () => {
      const result = await apiFetch<LearningResult>(
        '/learning/recommendations/from-profile',
        {
          method: 'POST',
          body:   JSON.stringify({
            role:             input!.role,
            skills:           input!.skills,
            experience_years: input!.experience_years ?? 0,
          }),
        },
      );
      return result as unknown as LearningResult;
    },
    enabled:   !!input?.role && (input?.skills?.length ?? 0) > 0,
    staleTime: 15 * 60 * 1000,
    retry:     1,
  });
}