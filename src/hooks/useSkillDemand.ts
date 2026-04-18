'use client';

// hooks/useSkillDemand.ts
//
// Calls POST /api/v1/skills/analyze
// Wired to the Skill Demand Intelligence Engine.
//
// Body:    { role, skills }
// Returns: { role, skill_score, user_skills, required_skills, skill_gaps, top_recommended_skills }

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/services/apiClient';

export interface SkillGapRow {
  skill:        string;
  demand_score: number;
  growth_rate:  number;
  salary_boost: number;
  industry:     string;
}

export interface SkillDemandResult {
  role:                   string;
  skill_score:            number;           // 0-100 match score
  user_skills:            string[];
  required_skills:        string[];
  skill_gaps:             string[];         // skills you're missing
  top_recommended_skills: SkillGapRow[];    // ranked by demand_score
}

interface FetchInput {
  role:   string;
  skills: string[];
}

export const SKILL_DEMAND_KEY = (role: string) => ['skill-demand', role] as const;

export function useSkillDemand(input: FetchInput | null) {
  return useQuery<SkillDemandResult>({
    queryKey: SKILL_DEMAND_KEY(input?.role ?? ''),
    queryFn:  async () => {
      const result = await apiFetch<SkillDemandResult>(
        '/skills/analyze',
        {
          method: 'POST',
          body:   JSON.stringify({
            role:   input!.role,
            skills: input!.skills,
          }),
        },
      );
      return result as unknown as SkillDemandResult;
    },
    enabled:   !!input?.role,
    staleTime: 10 * 60 * 1000,
    retry:     1,
  });
}