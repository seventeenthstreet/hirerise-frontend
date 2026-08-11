/**
 * pages/admin/master-data/education-levels.config.tsx
 * WP-ADMIN-COMP-03. Backend allowedFields: ['description', 'sortOrder'].
 */

import type { AdminEducationLevel } from '@/lib/api/adminCmsEducationLevels';
import type { MasterDataColumn, MasterDataFieldConfig } from '@/components/master-data';

export interface EducationLevelFormValues extends Record<string, unknown> {
  name: string;
  description: string;
  sortOrder: number | undefined;
}

export const EMPTY_EDUCATION_LEVEL_FORM_VALUES: EducationLevelFormValues = {
  name: '',
  description: '',
  sortOrder: undefined,
};

export function educationLevelToFormValues(el: AdminEducationLevel): EducationLevelFormValues {
  return { name: el.name, description: el.description ?? '', sortOrder: el.sortOrder ?? undefined };
}

export const EDUCATION_LEVEL_FIELDS: MasterDataFieldConfig<EducationLevelFormValues>[] = [
  { name: 'name', label: 'Name', type: 'text', placeholder: 'e.g. Bachelor’s Degree', required: true, maxLength: 150 },
  { name: 'sortOrder', label: 'Sort order', type: 'number', min: 0, max: 1000, helpText: 'Controls display order — lower shows first.' },
  { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Short description shown to end users', maxLength: 500 },
];

export const EDUCATION_LEVEL_COLUMNS: MasterDataColumn<AdminEducationLevel>[] = [
  { key: 'name', header: 'Name', render: (el) => <span className="font-medium">{el.name}</span> },
  { key: 'sortOrder', header: 'Sort Order', render: (el) => el.sortOrder ?? '—', widthClassName: 'w-28' },
  { key: 'description', header: 'Description', render: (el) => <span className="text-muted-foreground">{el.description || '—'}</span> },
  { key: 'updatedAt', header: 'Updated', render: (el) => (el.updatedAt ? new Date(el.updatedAt).toLocaleDateString() : '—'), widthClassName: 'w-28' },
];
