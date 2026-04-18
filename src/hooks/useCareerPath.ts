'use client';

// hooks/useCareerPath.ts
//
// Calls POST /api/v1/career-path/predict
// Wired to the Career Path Prediction Engine (CSV + experience-aware timeline).
//
// Body:    { role, experience_years, skills, industry }
// Returns: { current_role, career_path: [{ role, years_to_next, cumulative_years }], next_role, steps, ... }

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/services/apiClient';

export interface CareerPathStep {
  role:             string;
  years_to_next:    number;
  cumulative_years: number;
  industry?:        string | null;
}

export interface CareerPathResult {
  current_role:          string;
  experience_years:      number;
  career_path:           CareerPathStep[];
  total_estimated_years: number;
  next_role:             string | null;
  steps:                 number;
  source:                string;
}

interface FetchInput {
  role:             string;
  experience_years: number;
  skills?:          string[];
  industry?:        string | null;
}

export const CAREER_PATH_KEY = (role: string) => ['career-path', role] as const;

export function useCareerPath(input: FetchInput | null) {
  return useQuery<CareerPathResult>({
    queryKey: CAREER_PATH_KEY(input?.role ?? ''),
    queryFn:  async () => {
      const result = await apiFetch<CareerPathResult>(
        '/career-path/predict',
        {
          method: 'POST',
          body:   JSON.stringify({
            role:             input!.role,
            experience_years: input!.experience_years,
            skills:           input!.skills  ?? [],
            industry:         input!.industry ?? null,
          }),
        },
      );
      return result as unknown as CareerPathResult;
    },
    enabled:   !!input?.role,
    staleTime: 30 * 60 * 1000, // career paths change rarely
    retry:     1,
  });
}