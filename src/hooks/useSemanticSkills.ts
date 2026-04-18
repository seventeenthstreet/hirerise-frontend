// hooks/useSemanticSkills.ts
// TanStack Query hooks for Upgrade 1 — Semantic Skill Intelligence

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/services/apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SimilarSkillsResult {
  skill: string;
  similar_skills: string[];
  scores: Array<{ skill: string; similarity: number }>;
}

export interface SemanticJobMatch {
  job_id:         string;
  title:          string;
  company:        string | null;
  location:       string | null;
  match_score:    number;       // final weighted score 0–100
  semantic_score: number;       // cosine similarity score 0–100
  missing_skills: string[];
  breakdown: {
    semantic:    number;
    experience:  number;
    industry:    number;
    location:    number;
  };
}

export interface SemanticMatchData {
  recommended_jobs:   SemanticJobMatch[];
  total_evaluated:    number;
  user_skills_count:  number;
  scoring_weights:    { semantic: number; experience: number; industry: number; location: number };
}

export interface CareerAdviceResult {
  career_insight:        string;
  key_opportunity:       string;
  salary_potential:      string;
  timeline:              string;
  skills_to_prioritise:  string[];
  generated_at:          string;
  _fallback?:            boolean;
}

export interface LearningStep {
  step:        number;
  title:       string;
  description: string;
  resources:   string[];
  duration:    string;
}

export interface LearningPathResult {
  skill:              string;
  estimated_duration: string;
  difficulty:         'beginner' | 'intermediate' | 'advanced';
  steps:              LearningStep[];
  outcome:            string;
  related_skills:     string[];
}

export interface MultiLearningPathResult {
  learning_paths: LearningPathResult[];
  total_skills:   number;
}

// ─── Upgrade 1: Similar Skills ────────────────────────────────────────────────

export function useSimilarSkills(skill: string, topK = 5) {
  return useQuery<SimilarSkillsResult>({
    queryKey: ['semantic', 'similar-skills', skill, topK],
    queryFn:  () =>
      apiFetch<SimilarSkillsResult>(
        `/skills/similar?skill=${encodeURIComponent(skill)}&topK=${topK}`
      ),
    enabled:   !!skill && skill.trim().length >= 2,
    staleTime: 10 * 60 * 1000,   // 10 min — matches server cache TTL
    gcTime:    20 * 60 * 1000,
    retry:     1,
  });
}

// ─── Upgrade 2: Semantic Job Matching ────────────────────────────────────────

export function useSemanticJobMatches(limit = 10, minScore = 30) {
  return useQuery<SemanticMatchData>({
    queryKey: ['semantic', 'job-matches', limit, minScore],
    queryFn:  () =>
      apiFetch<SemanticMatchData>(
        `/job-seeker/jobs/semantic-match?limit=${limit}&minScore=${minScore}`
      ),
    staleTime: 5 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
    retry:     1,
  });
}

// ─── Upgrade 3: Career Advice ─────────────────────────────────────────────────

export function useCareerAdvice() {
  return useQuery<CareerAdviceResult>({
    queryKey: ['semantic', 'career-advice'],
    queryFn:  () => apiFetch<CareerAdviceResult>('/career/advice'),
    staleTime: 5 * 60 * 1000,
    gcTime:    15 * 60 * 1000,
    retry:     1,
  });
}

// ─── Upgrade 4: Learning Path ─────────────────────────────────────────────────

export function useLearningPath(skill: string, targetRole?: string) {
  return useQuery<LearningPathResult>({
    queryKey: ['semantic', 'learning-path', skill, targetRole],
    queryFn:  () =>
      apiFetch<LearningPathResult>(
        `/skills/learning-path?skill=${encodeURIComponent(skill)}` +
        (targetRole ? `&targetRole=${encodeURIComponent(targetRole)}` : '')
      ),
    enabled:   !!skill && skill.trim().length >= 2,
    staleTime: 10 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
    retry:     1,
  });
}

export function useMultiLearningPaths(skills: string[], targetRole?: string) {
  const skillsParam = skills.map(s => encodeURIComponent(s)).join(',');
  return useQuery<MultiLearningPathResult>({
    queryKey: ['semantic', 'learning-paths', ...skills, targetRole],
    queryFn:  () =>
      apiFetch<MultiLearningPathResult>(
        `/skills/learning-path?skills=${skillsParam}` +
        (targetRole ? `&targetRole=${encodeURIComponent(targetRole)}` : '')
      ),
    enabled:   skills.length > 0,
    staleTime: 10 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
    retry:     1,
  });
}