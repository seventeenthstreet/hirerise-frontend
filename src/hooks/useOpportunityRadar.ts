// hooks/useOpportunityRadar.ts
// TanStack Query hooks for the AI Career Opportunity Radar module.
// Follows the same pattern as useJobMatches.ts and useSkillGraph.ts.

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/services/apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScoreBreakdown {
  job_growth:      number;
  salary_growth:   number;
  skill_demand:    number;
  industry_growth: number;
}

export interface EmergingOpportunity {
  role:              string;
  industry:          string;
  opportunity_score: number;   // 0–100 composite opportunity score
  match_score:       number;   // 0–100 how well user's skills match
  growth_trend:      'Very High' | 'High' | 'Moderate' | 'Emerging' | 'Stable';
  average_salary:    string;   // e.g. "₹12L"
  is_emerging:       boolean;
  skills_you_have:   string[];
  skills_to_learn:   string[];
  score_breakdown:   ScoreBreakdown;
}

export interface OpportunityRadarData {
  emerging_opportunities:   EmergingOpportunity[];
  user_skills_count:        number;
  target_role:              string | null;
  industry:                 string | null;
  total_signals_evaluated?: number;
  message?:                 string;
}

export interface EmergingRole {
  role:              string;
  industry:          string;
  opportunity_score: number;
  growth_trend:      string;
  average_salary:    string;
  demand_score:      number;
  emerging_score:    number;
  is_emerging:       boolean;
  required_skills:   string[];
  score_breakdown:   ScoreBreakdown;
}

export interface EmergingRolesData {
  roles: EmergingRole[];
  total: number;
}

// ─── useOpportunityRadar ──────────────────────────────────────────────────────

/**
 * Hook for the personalised opportunity radar.
 * Fetches top emerging career opportunities matched to the user's skill profile.
 *
 * @param limit               max results to return (default 10)
 * @param minOpportunityScore filter by minimum opportunity score (default 40)
 */
export function useOpportunityRadar(limit = 10, minOpportunityScore = 40) {
  return useQuery<OpportunityRadarData>({
    queryKey: ['career', 'opportunity-radar', limit, minOpportunityScore],
    queryFn:  () =>
      apiFetch<OpportunityRadarData>(
        `/career/opportunity-radar?limit=${limit}&minOpportunityScore=${minOpportunityScore}`
      ),
    staleTime: 25 * 60 * 1000,  // 25 min — just under the 30 min Redis TTL
    gcTime:    35 * 60 * 1000,
    retry:     1,
  });
}

// ─── useEmergingRoles ─────────────────────────────────────────────────────────

/**
 * Hook for the public catalogue of emerging roles.
 * Not personalised — useful for the explore/discover section.
 *
 * @param opts   optional filters
 */
export function useEmergingRoles(opts?: {
  limit?:        number;
  industry?:     string;
  emergingOnly?: boolean;
  minScore?:     number;
}) {
  const {
    limit        = 20,
    industry     = '',
    emergingOnly = false,
    minScore     = 60,
  } = opts || {};

  const params = new URLSearchParams({
    limit:        String(limit),
    minScore:     String(minScore),
    emergingOnly: String(emergingOnly),
    ...(industry ? { industry } : {}),
  }).toString();

  return useQuery<EmergingRolesData>({
    queryKey: ['career', 'emerging-roles', limit, industry, emergingOnly, minScore],
    queryFn:  () => apiFetch<EmergingRolesData>(`/career/emerging-roles?${params}`),
    staleTime: 25 * 60 * 1000,
    gcTime:    35 * 60 * 1000,
    retry:     1,
  });
}
