// features/skills/hooks/useSkills.ts
//
// TanStack Query hooks for the user-facing skill catalog (read-only).
// Uses /api/v1/skills channel — NOT the admin CMS channel.
// This module must never call createSkill / updateSkill / deleteSkill.

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { skillsService, type SkillQueryParams } from '@/services/skillsService';

// Query key factory — keeps cache invalidation consistent
export const publicSkillKeys = {
  all:    () => ['skills'] as const,
  list:   (params: SkillQueryParams) => [...publicSkillKeys.all(), 'list', params] as const,
  detail: (id: string)               => [...publicSkillKeys.all(), 'detail', id] as const,
};

/** Paginated skill list with search + category filter */
export function useSkills(params: SkillQueryParams = {}) {
  return useQuery({
    queryKey:        publicSkillKeys.list(params),
    queryFn:         () => skillsService.listSkills(params),
    staleTime:       5 * 60 * 1000, // 5 minutes — skills change infrequently
    placeholderData: keepPreviousData,
  });
}

/** Single skill by id */
export function useSkill(id: string | null) {
  return useQuery({
    queryKey: publicSkillKeys.detail(id ?? ''),
    queryFn:  () => skillsService.getSkill(id!),
    enabled:  !!id,
    staleTime: 10 * 60 * 1000,
  });
}
