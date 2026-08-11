/**
 * pages/admin/master-data/skills.config.tsx
 *
 * Skills-specific configuration for the Master Data framework. Per
 * WP-ADMIN-02A §18, this is the ONLY place skill-specific field/column
 * knowledge should live — SkillsPage.tsx and the MasterData* components
 * stay generic. Roles / Career Domains / Skill Clusters each get their
 * own sibling config file with the same shape.
 */

import type { AdminSkill, SkillCategory } from '@/lib/api/adminCmsSkills';
import type { MasterDataColumn, MasterDataFieldConfig } from '@/components/master-data';

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY OPTIONS — must match the backend's express-validator .isIn() list
// (adminCmsSkills.routes.js) exactly.
// ─────────────────────────────────────────────────────────────────────────────

export const SKILL_CATEGORY_OPTIONS: { value: SkillCategory; label: string }[] = [
  { value: 'technical', label: 'Technical' },
  { value: 'soft', label: 'Soft skill' },
  { value: 'domain', label: 'Domain' },
  { value: 'tool', label: 'Tool' },
  { value: 'language', label: 'Language' },
  { value: 'framework', label: 'Framework' },
];

// ─────────────────────────────────────────────────────────────────────────────
// FORM VALUES — the shape MasterDataForm edits, distinct from AdminSkill
// (which includes server-managed fields like id/createdAt/searchTokens).
// ─────────────────────────────────────────────────────────────────────────────

export interface SkillFormValues extends Record<string, unknown> {
  name: string;
  category: SkillCategory | '';
  aliases: string[];
  description: string;
  demandScore: number | undefined;
}

export const EMPTY_SKILL_FORM_VALUES: SkillFormValues = {
  name: '',
  category: '',
  aliases: [],
  description: '',
  demandScore: undefined,
};

export function skillToFormValues(skill: AdminSkill): SkillFormValues {
  return {
    name: skill.name,
    category: skill.category,
    aliases: skill.aliases ?? [],
    description: skill.description ?? '',
    demandScore: skill.demandScore ?? undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FIELD CONFIG — drives MasterDataForm
// ─────────────────────────────────────────────────────────────────────────────

export const SKILL_FIELDS: MasterDataFieldConfig<SkillFormValues>[] = [
  {
    name: 'name',
    label: 'Name',
    type: 'text',
    placeholder: 'e.g. TypeScript',
    required: true,
    maxLength: 150,
  },
  {
    name: 'category',
    label: 'Category',
    type: 'select',
    required: false,
    options: SKILL_CATEGORY_OPTIONS,
    helpText: 'Defaults to "Technical" if left unset.',
  },
  {
    name: 'aliases',
    label: 'Aliases',
    type: 'tags',
    placeholder: 'e.g. TS, TypeScript.js',
    maxLength: 20,
    helpText: 'Comma-separated. Up to 20 alternate names, used in search matching.',
  },
  {
    name: 'description',
    label: 'Description',
    type: 'textarea',
    placeholder: 'Short description shown to end users',
    maxLength: 500,
  },
  {
    name: 'demandScore',
    label: 'Demand score',
    type: 'number',
    min: 0,
    max: 100,
    helpText: '0–100. Leave blank if unknown.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// COLUMN CONFIG — drives MasterDataTable
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<SkillCategory, string> = {
  technical: 'Technical',
  soft: 'Soft skill',
  domain: 'Domain',
  tool: 'Tool',
  language: 'Language',
  framework: 'Framework',
};

export const SKILL_COLUMNS: MasterDataColumn<AdminSkill>[] = [
  {
    key: 'name',
    header: 'Name',
    render: (skill) => <span className="font-medium">{skill.name}</span>,
  },
  {
    key: 'category',
    header: 'Category',
    render: (skill) => (
      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        {CATEGORY_LABELS[skill.category] ?? skill.category}
      </span>
    ),
    widthClassName: 'w-32',
  },
  {
    key: 'aliases',
    header: 'Aliases',
    render: (skill) =>
      skill.aliases.length > 0 ? (
        <span className="text-muted-foreground">{skill.aliases.slice(0, 3).join(', ')}{skill.aliases.length > 3 ? `, +${skill.aliases.length - 3}` : ''}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    key: 'demandScore',
    header: 'Demand',
    render: (skill) => (skill.demandScore != null ? String(skill.demandScore) : '—'),
    align: 'right',
    widthClassName: 'w-20',
  },
  {
    key: 'updatedAt',
    header: 'Updated',
    render: (skill) => (skill.updatedAt ? new Date(skill.updatedAt).toLocaleDateString() : '—'),
    widthClassName: 'w-28',
  },
];
