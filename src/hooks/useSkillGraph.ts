// hooks/useSkillGraph.ts
// TanStack Query hooks for the Job Seeker Skill Graph Engine.

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/services/apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SkillGraphData {
  existing_skills:      string[];
  adjacent_skills:      string[];
  next_level_skills:    string[];
  role_specific_skills: string[];
  target_role:          string | null;
  industry:             string | null;
  skill_count:          number;
  message?:             string;
}

export interface MissingSkill {
  name:         string;
  demand_score: number;
  category:     string | null;
  difficulty:   number | null;
}

export interface RoleGap {
  target_role:      string;
  match_percentage: number;
  missing_required: string[];
  priority_missing: { name: string; priority: string }[];
}

export interface LearningPath {
  skill: string;
  path:  unknown;
}

export interface SkillGapData {
  existing_skills:     string[];
  adjacent_skills:     string[];
  missing_high_demand: MissingSkill[];
  role_gap:            RoleGap | null;
  learning_paths:      LearningPath[];
  years_experience:    number;
  target_role:         string | null;
  industry:            string | null;
  gap_summary?:        string;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useSkillGraph() {
  return useQuery<SkillGraphData>({
    queryKey: ['job-seeker', 'skill-graph'],
    queryFn:  () =>
      apiFetch<SkillGraphData>('/job-seeker/skills/user-graph'),
    staleTime: 5 * 60 * 1000, // 5 min — matches server-side 10 min TTL
    gcTime:    10 * 60 * 1000,
    retry: 1,
  });
}

export function useSkillGap() {
  return useQuery<SkillGapData>({
    queryKey: ['job-seeker', 'skill-gap'],
    queryFn:  () =>
      apiFetch<SkillGapData>('/job-seeker/skills/skill-gap'),
    staleTime: 5 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
    retry: 1,
  });
}