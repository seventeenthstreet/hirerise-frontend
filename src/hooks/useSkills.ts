// hooks/useSkills.ts
//
// Hook — GET /api/v1/skills (paginated + filtered).
// Drives the public skill catalog page and any skill picker components.
// Uses keepPreviousData so the grid does not flash when changing page/filters.

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { skillsService, type SkillQueryParams } from '@/services/skillsService';
import type { PaginatedResponse } from '@/types/api';
import type { Skill } from '@/types/skills';

/** Build a stable, serialisable query key from the filter params */
export const skillsKey = (params: SkillQueryParams = {}) =>
  ['skills', 'list', params] as const;

/**
 * useSkills(params?)
 *
 * @param params  Optional filters: page, limit, search, category
 *
 * @returns TanStack Query result wrapping PaginatedResponse<Skill>
 *          Access via data.items (Skill[]), data.total, data.hasMore
 *
 * @example
 *   const { data, isLoading } = useSkills({ search: 'react', limit: 18 });
 *   const skills = data?.items ?? [];
 */
export function useSkills(params: SkillQueryParams = {}) {
  return useQuery<PaginatedResponse<Skill>>({
    queryKey:        skillsKey(params),
    queryFn:         () => skillsService.listSkills(params),
    staleTime:       5 * 60 * 1000,
    placeholderData: keepPreviousData, // keep prev page visible while next loads
  });
}