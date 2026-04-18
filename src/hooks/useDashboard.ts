// hooks/useDashboard.ts — PHASE 2
//
// Replaces the dual useCareerHealth() + useProfile() calls on the dashboard page
// with a single call to GET /api/v1/dashboard, which:
//   - Returns tier, features, careerIntelligence, credits, applySmarter
//   - Is Redis-cached (120s TTL) — cheaper than two separate Firestore reads
//   - Is invalidated automatically by resume upload / CHI recalculate
//
// The hook still falls back to useProfile() for auth state (name, email etc.)
// since the dashboard endpoint only returns career-specific user data.
//
// SHAPE returned by GET /api/v1/dashboard:
// {
//   tier: string,
//   features: {
//     basicAnalysis: { locked, jobMatchScore },
//     careerHealth:  { locked, chiScore, skillCoverage, growthSummary },
//     salaryGap:     { locked, salaryPreview },
//     advancedInsights: { locked, data }
//   },
//   user: { tier, aiCreditsRemaining },
//   careerIntelligence: { chiScore, skillCoverage, growthSummary, salaryPreview },
//   applySmarter: { hasAnalyzedBefore, lastMatchScore, lastJobTitle, lastAnalyzedAt },
//   credits: { remaining, remainingUses, canRunJobMatch, canGenerateJobSpecificCV }
// }

'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch }  from '@/services/apiClient';

export const DASHBOARD_KEY = ['dashboard'] as const;

export interface DashboardFeatures {
  basicAnalysis:    { locked: boolean; jobMatchScore: number | null };
  careerHealth:     { locked: boolean; chiScore: number | null; skillCoverage: number | null; growthSummary: string | null };
  salaryGap:        { locked: boolean; salaryPreview: { min: number; max: number; currency: string } | null };
  advancedInsights: { locked: boolean; data: null };
}

export interface DashboardCredits {
  remaining:              number;
  remainingUses:          Record<string, number> | null;
  canRunJobMatch:         boolean;
  canGenerateJobSpecificCV: boolean;
}

export interface DashboardApplySmarter {
  hasAnalyzedBefore: boolean;
  lastMatchScore:    number | null;
  lastJobTitle:      string | null;
  lastAnalyzedAt:    string | null;
}

export interface DashboardData {
  tier:               string;
  features:           DashboardFeatures;
  user:               { tier: string; aiCreditsRemaining: number };
  careerIntelligence: {
    chiScore:      number | null;
    skillCoverage: number | null;
    growthSummary: string | null;
    salaryPreview: { min: number; max: number; currency: string } | null;
  };
  applySmarter:  DashboardApplySmarter;
  credits:       DashboardCredits;
}

/**
 * useDashboard()
 *
 * Fetches the aggregated dashboard payload from GET /api/v1/dashboard.
 * Single source of truth for tier, credits, career intelligence, and job match
 * data shown on the dashboard page.
 *
 * @example
 *   const { data, isLoading } = useDashboard();
 *   const chiScore = data?.careerIntelligence?.chiScore;
 */
export function useDashboard() {
  return useQuery<DashboardData>({
    queryKey: DASHBOARD_KEY,
    queryFn:  async () => {
      const envelope = await apiFetch<{ success: boolean; data: DashboardData }>('/dashboard');
      // apiFetch already unwraps { success, data } → returns data directly
      return envelope as unknown as DashboardData;
    },
    staleTime: 2 * 60 * 1000, // 2 min — matches Redis TTL on backend
    retry:     1,
  });
}