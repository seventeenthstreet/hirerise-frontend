/**
 * pages/admin/master-data/job-families.config.tsx
 * WP-ADMIN-COMP-03. Backend allowedFields: ['description'] only — name +
 * description is the entire editable surface.
 */

import type { AdminJobFamily } from '@/lib/api/adminCmsJobFamilies';
import type { MasterDataColumn, MasterDataFieldConfig } from '@/components/master-data';

export interface JobFamilyFormValues extends Record<string, unknown> {
  name: string;
  description: string;
}

export const EMPTY_JOB_FAMILY_FORM_VALUES: JobFamilyFormValues = {
  name: '',
  description: '',
};

export function jobFamilyToFormValues(jf: AdminJobFamily): JobFamilyFormValues {
  return { name: jf.name, description: jf.description ?? '' };
}

export const JOB_FAMILY_FIELDS: MasterDataFieldConfig<JobFamilyFormValues>[] = [
  { name: 'name', label: 'Name', type: 'text', placeholder: 'e.g. Engineering', required: true, maxLength: 200 },
  { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Short description shown to end users', maxLength: 500 },
];

export const JOB_FAMILY_COLUMNS: MasterDataColumn<AdminJobFamily>[] = [
  { key: 'name', header: 'Name', render: (jf) => <span className="font-medium">{jf.name}</span> },
  { key: 'description', header: 'Description', render: (jf) => <span className="text-muted-foreground">{jf.description || '—'}</span> },
  { key: 'updatedAt', header: 'Updated', render: (jf) => (jf.updatedAt ? new Date(jf.updatedAt).toLocaleDateString() : '—'), widthClassName: 'w-28' },
];
