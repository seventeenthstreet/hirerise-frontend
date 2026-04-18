'use client';

/**
 * hooks/useSkillRecommendations.ts
 *
 * Fetches personalised skill recommendations from GET /api/v1/skills/recommendations.
 * Also exposes addSkills() and addAllSkills() mutations with optimistic UI updates.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/services/apiClient';
import { skillsKey } from '@/hooks/useSkills';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecommendedSkill {
  name:             string;
  demandScore:      number;   // 0–100
  matchScoreImpact: number;   // pts added to match score if added
}

export interface SkillRecommendationsData {
  missingSkills:     string[];
  recommendedSkills: RecommendedSkill[];
  matchScore:        number;
  matchScoreImpact:  number;
  targetRole:        string | null;
  hasTargetRole:     boolean;
  explanation:       string;
  userSkillCount:    number;
  benchmarkSkills:   string[];
}

// ─── Query key ────────────────────────────────────────────────────────────────

export const SKILL_RECS_KEY = ['skill-recommendations'] as const;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSkillRecommendations() {
  const qc = useQueryClient();

  // ── Fetch recommendations ──────────────────────────────────────────────────
  const query = useQuery<SkillRecommendationsData>({
    queryKey:  SKILL_RECS_KEY,
    queryFn:   () => apiFetch<SkillRecommendationsData>('/skills/recommendations'),
    staleTime: 5 * 60 * 1000,   // 5 min — skills don't change every second
    retry:     1,
  });

  // ── Add single skill ───────────────────────────────────────────────────────
  const addSkillMutation = useMutation({
    mutationFn: (skillName: string) =>
      apiFetch<{ added: number; skills: string[] }>('/skills/add', {
        method: 'POST',
        body:   JSON.stringify({ skills: [skillName] }),
      }),

    // Optimistic update — remove from recommendations immediately
    onMutate: async (skillName: string) => {
      await qc.cancelQueries({ queryKey: SKILL_RECS_KEY });
      const prev = qc.getQueryData<SkillRecommendationsData>(SKILL_RECS_KEY);

      if (prev) {
        qc.setQueryData<SkillRecommendationsData>(SKILL_RECS_KEY, {
          ...prev,
          missingSkills:     prev.missingSkills.filter(s => s !== skillName),
          recommendedSkills: prev.recommendedSkills.filter(s => s.name !== skillName),
          matchScore:        Math.min(100, prev.matchScore + (prev.recommendedSkills.find(s => s.name === skillName)?.matchScoreImpact ?? 4)),
        });
      }

      return { prev };
    },

    onError: (_err, _vars, ctx) => {
      // Roll back on failure
      if (ctx?.prev) qc.setQueryData(SKILL_RECS_KEY, ctx.prev);
    },

    onSettled: () => {
      // Refresh both recommendations and skills list
      qc.invalidateQueries({ queryKey: SKILL_RECS_KEY });
      qc.invalidateQueries({ queryKey: skillsKey() });
    },
  });

  // ── Add all missing skills ─────────────────────────────────────────────────
  const addAllMutation = useMutation({
    mutationFn: (skillNames: string[]) =>
      apiFetch<{ added: number; skills: string[] }>('/skills/add', {
        method: 'POST',
        body:   JSON.stringify({ skills: skillNames }),
      }),

    // Optimistic update — clear all recommendations immediately
    onMutate: async (skillNames: string[]) => {
      await qc.cancelQueries({ queryKey: SKILL_RECS_KEY });
      const prev = qc.getQueryData<SkillRecommendationsData>(SKILL_RECS_KEY);
      const nameSet = new Set(skillNames);

      if (prev) {
        qc.setQueryData<SkillRecommendationsData>(SKILL_RECS_KEY, {
          ...prev,
          missingSkills:     prev.missingSkills.filter(s => !nameSet.has(s)),
          recommendedSkills: prev.recommendedSkills.filter(s => !nameSet.has(s.name)),
          matchScore:        Math.min(100, prev.matchScore + prev.matchScoreImpact),
          matchScoreImpact:  0,
        });
      }

      return { prev };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(SKILL_RECS_KEY, ctx.prev);
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: SKILL_RECS_KEY });
      qc.invalidateQueries({ queryKey: skillsKey() });
    },
  });

  return {
    // Query state
    data:       query.data,
    isLoading:  query.isLoading,
    isError:    query.isError,
    error:      query.error,
    refetch:    query.refetch,

    // Mutations
    addSkill:    (name: string)     => addSkillMutation.mutate(name),
    addAllSkills:(names: string[])  => addAllMutation.mutate(names),
    isAdding:    addSkillMutation.isPending,
    isAddingAll: addAllMutation.isPending,
    addingSkill: addSkillMutation.variables ?? null,
  };
}