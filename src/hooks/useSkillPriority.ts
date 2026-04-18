'use client';

/**
 * hooks/useSkillPriority.ts
 *
 * Calls GET /api/v1/skills/priority
 *
 * The backend reads the user's profile + CHI snapshot from Firestore
 * automatically — no body needed from the frontend.
 *
 * Enabled only when chi.isReady is true (user has uploaded a CV and
 * has a CHI snapshot). Returns null data gracefully when profile is
 * incomplete (no target role or no skills).
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch }                 from '@/services/apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PrioritizedSkill {
  skillId:                    string;
  skillName:                  string;
  priorityScore:              number;         // 0–100
  priorityLevel:              'HIGH' | 'MEDIUM' | 'LOW';
  marketDemandScore:          number;
  salaryImpactScore:          number;
  promotionBoostScore:        number;
  currentProficiency:         number;
  estimatedLearningTimeWeeks: number;
  roiCategory:                'FAST_GAIN' | 'STRATEGIC' | 'LONG_TERM';
  difficultyScore:            number;
  learningEfficiencyIndex:    number;
  cluster:                    string;
  dependencySkills:           string[];
}

export interface SkillPrioritySummary {
  totalSkillsAnalyzed: number;
  highPriorityCount:   number;
  avgPriorityScore:    number;
  estimatedSalaryDelta: number;
}

export interface CareerPathInsight {
  nextRoleUnlocked:              string | null;
  unlockProbabilityIncrease:     number;
  confidenceScore:               number;
  gatewayProgressPercent:        number;
  experienceAlignmentPercent:    number;
}

export interface ConfidenceInsight {
  confidenceScore:  number;
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  factors: {
    dataCoverage:          number;
    gatewayCompleteness:   number;
    profileStrength:       number;
    marketSignalStrength:  number;
  };
}

export interface SkillPriorityResult {
  meta: {
    engineVersion:  string;
    generatedAt:    string;
    isPremiumView:  boolean;
    skillsReturned: number;
    totalEvaluated: number;
  };
  summary:           SkillPrioritySummary;
  prioritizedSkills: PrioritizedSkill[];
  careerPathInsight: CareerPathInsight;
  confidenceInsight: ConfidenceInsight;
  narrative:         string;
}

export interface SkillPriorityResponse {
  data:    SkillPriorityResult | null;
  cached?: boolean;
  message?: string;
}

// ─── Query key ────────────────────────────────────────────────────────────────

export const SKILL_PRIORITY_KEY = ['skills', 'priority'] as const;

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseSkillPriorityOptions {
  /**
   * Only run when user has a ready CHI snapshot.
   * Pass chi.isReady here — avoids firing before CV is processed.
   */
  enabled?: boolean;
  /** Force a fresh result bypassing the 30-min backend cache. */
  forceRefresh?: boolean;
}

export function useSkillPriority(opts: UseSkillPriorityOptions = {}) {
  const { enabled = true, forceRefresh = false } = opts;
  const qs = forceRefresh ? '?refresh=true' : '';

  return useQuery<SkillPriorityResponse>({
    queryKey: [...SKILL_PRIORITY_KEY, forceRefresh],
    queryFn:  async () => {
      const envelope = await apiFetch<SkillPriorityResponse>(
        `/skills/priority${qs}`
      );
      return envelope as unknown as SkillPriorityResponse;
    },
    enabled,
    staleTime: 30 * 60 * 1000, // 30 min — matches backend cache TTL
    retry:     1,
  });
}

// ─── Invalidation helper ──────────────────────────────────────────────────────

export function useInvalidateSkillPriority() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: SKILL_PRIORITY_KEY });
}