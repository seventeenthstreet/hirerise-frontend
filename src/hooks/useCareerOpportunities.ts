'use client';

// hooks/useCareerOpportunities.ts
//
// Calls POST /api/v1/career-opportunities/analyze
// Wired to the Career Opportunity Engine.
//
// Body:  { role, skills, experience_years, industry, country, top_n }
// Returns: { opportunities: [{ role, match_score, ... }], insights, meta }

import { useQuery }   from '@tanstack/react-query';
import { apiFetch }   from '@/services/apiClient';

export interface CareerOpportunity {
  role:                 string;
  match_score:          number;
  skill_overlap_weight: number;
  skill_overlap_ratio:  number;
  experience_factor:    number;
  // Firestore-enriched fields (optional)
  job_postings?:        number | null;
  growth_rate?:         string | null;
  remote_ratio?:        number | null;
  competition_score?:   number | null;
  domain?:              string | null;
  top_skills?:          string[];
}

export interface CareerOpportunitiesResult {
  opportunities: CareerOpportunity[];
  insights:      string[];
  meta:          Record<string, unknown>;
}

interface FetchInput {
  role:             string;
  skills:           string[];
  experience_years: number;
  industry?:        string | null;
  country?:         string | null;
  top_n?:           number;
}

export const CAREER_OPPORTUNITIES_KEY = (role: string) =>
  ['career-opportunities', role] as const;

export function useCareerOpportunities(input: FetchInput | null) {
  return useQuery<CareerOpportunitiesResult>({
    queryKey: CAREER_OPPORTUNITIES_KEY(input?.role ?? ''),
    queryFn:  async () => {
      const envelope = await apiFetch<{ data: CareerOpportunitiesResult }>(
        '/career-opportunities/analyze',
        {
          method: 'POST',
          body:   JSON.stringify({
            role:             input!.role,
            skills:           input!.skills,
            experience_years: input!.experience_years,
            industry:         input!.industry  ?? null,
            country:          input!.country   ?? null,
            top_n:            input!.top_n     ?? 5,
          }),
        },
      );
      // apiFetch unwraps { success, data } → returns data directly
      return (envelope as unknown as CareerOpportunitiesResult);
    },
    enabled:   !!input?.role,
    staleTime: 10 * 60 * 1000,
    retry:     1,
  });
}