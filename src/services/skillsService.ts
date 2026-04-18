// services/skillsService.ts
//
// Interacts with: GET/POST/PATCH/DELETE /api/v1/skills
// Data source: Firestore (via backend — never direct SDK calls)
// Timestamps: All createdAt / updatedAt fields are ISO 8601 strings

import { apiFetch } from './apiClient';
import type { Skill, CreateSkillDto, UpdateSkillDto } from '@/types/skills';
import type { PaginatedResponse } from '@/types/api';

export interface SkillQueryParams {
  page?:     number;
  limit?:    number;
  search?:   string;
  category?: string;
}

function buildSkillQuery(params: SkillQueryParams = {}): string {
  const q = new URLSearchParams();
  if (params.page)     q.set('page',     String(params.page));
  if (params.limit)    q.set('limit',    String(params.limit));
  if (params.search)   q.set('search',   params.search);
  if (params.category) q.set('category', params.category);
  const qs = q.toString();
  return qs ? `?${qs}` : '';
}

export const skillsService = {
  /** GET /api/v1/skills */
  listSkills(params: SkillQueryParams = {}): Promise<PaginatedResponse<Skill>> {
    return apiFetch<PaginatedResponse<Skill>>(`/skills${buildSkillQuery(params)}`);
  },

  /** GET /api/v1/skills/:id */
  getSkill(id: string): Promise<Skill> {
    return apiFetch<Skill>(`/skills/${id}`);
  },

  /** POST /api/v1/skills — admin only, backend enforces requireAdmin */
  createSkill(data: CreateSkillDto): Promise<Skill> {
    return apiFetch<Skill>('/skills', {
      method: 'POST',
      body:   JSON.stringify(data),
    });
  },

  /** PATCH /api/v1/skills/:id — admin only */
  updateSkill(id: string, data: UpdateSkillDto): Promise<Skill> {
    return apiFetch<Skill>(`/skills/${id}`, {
      method: 'PATCH',
      body:   JSON.stringify(data),
    });
  },

  /** DELETE /api/v1/skills/:id — admin only, soft delete */
  deleteSkill(id: string): Promise<null> {
    return apiFetch<null>(`/skills/${id}`, { method: 'DELETE' });
  },
};
