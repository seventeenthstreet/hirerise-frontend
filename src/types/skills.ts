// types/skills.ts
//
// Skill data originates from Firestore via backend API.
// createdAt / updatedAt are ISO 8601 strings — normalized by backend.
// NEVER access ._seconds or call .toDate() on these fields.

export type SkillCategory = 'technical' | 'soft' | 'domain' | 'tool' | 'language' | 'framework';

export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  aliases: string[];
  description: string;
  demandScore: number | null;
  createdAt: string; // ISO 8601 — normalized by backend
  updatedAt: string; // ISO 8601 — normalized by backend
}

export type CreateSkillDto = Omit<Skill, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateSkillDto = Partial<CreateSkillDto>;

export const SKILL_CATEGORIES: { value: SkillCategory; label: string }[] = [
  { value: 'technical',  label: 'Technical'  },
  { value: 'soft',       label: 'Soft'       },
  { value: 'domain',     label: 'Domain'     },
  { value: 'tool',       label: 'Tool'       },
  { value: 'language',   label: 'Language'   },
  { value: 'framework',  label: 'Framework'  },
];
