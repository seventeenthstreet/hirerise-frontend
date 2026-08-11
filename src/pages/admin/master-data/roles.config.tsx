/**
 * pages/admin/master-data/roles.config.tsx
 *
 * Roles-specific configuration for the Master Data framework (WP-ADMIN-COMP-03).
 * Field/validator choices mirror adminCmsRoles.routes.js exactly.
 *
 * NOTE: jobFamilyId is a free-text field, not a live select. The backend does
 * not enforce a foreign-key constraint on it, and at the time this module
 * shipped the Job Families dataset was not yet exposed as its own Master Data
 * page in the same work package sequence. Once Job Families is live, this can
 * be upgraded to a domain-style live select the same way Skill Clusters
 * resolves domainId — tracked as a follow-up, not done speculatively here.
 */

import type { AdminCmsRole, RoleTrack } from '@/lib/api/adminCmsRoles';
import type { MasterDataColumn, MasterDataFieldConfig } from '@/components/master-data';

export const ROLE_TRACK_OPTIONS: { value: RoleTrack; label: string }[] = [
  { value: 'individual_contributor', label: 'Individual contributor' },
  { value: 'management', label: 'Management' },
  { value: 'specialist', label: 'Specialist' },
];

export interface RoleFormValues extends Record<string, unknown> {
  name: string;
  jobFamilyId: string;
  level: string;
  track: RoleTrack | '';
  description: string;
  alternativeTitles: string[];
}

export const EMPTY_ROLE_FORM_VALUES: RoleFormValues = {
  name: '',
  jobFamilyId: '',
  level: '',
  track: '',
  description: '',
  alternativeTitles: [],
};

export function roleToFormValues(role: AdminCmsRole): RoleFormValues {
  return {
    name: role.name,
    jobFamilyId: role.jobFamilyId,
    level: role.level ?? '',
    track: role.track ?? '',
    description: role.description ?? '',
    alternativeTitles: role.alternativeTitles ?? [],
  };
}

export const ROLE_FIELDS: MasterDataFieldConfig<RoleFormValues>[] = [
  {
    name: 'name',
    label: 'Name',
    type: 'text',
    placeholder: 'e.g. Senior Backend Engineer',
    required: true,
    maxLength: 150,
  },
  {
    name: 'jobFamilyId',
    label: 'Job family ID',
    type: 'text',
    placeholder: 'e.g. jf_engineering',
    required: true,
    maxLength: 100,
    helpText: 'The Job Families dataset ID this role belongs to.',
  },
  {
    name: 'level',
    label: 'Level',
    type: 'text',
    placeholder: 'e.g. Senior, L5',
  },
  {
    name: 'track',
    label: 'Track',
    type: 'select',
    options: ROLE_TRACK_OPTIONS,
  },
  {
    name: 'description',
    label: 'Description',
    type: 'textarea',
    placeholder: 'Short description shown to end users',
    maxLength: 500,
  },
  {
    name: 'alternativeTitles',
    label: 'Alternative titles',
    type: 'tags',
    placeholder: 'e.g. Staff Engineer, Tech Lead',
    maxLength: 20,
    helpText: 'Comma-separated. Up to 20 alternate titles.',
  },
];

export const ROLE_COLUMNS: MasterDataColumn<AdminCmsRole>[] = [
  {
    key: 'name',
    header: 'Name',
    render: (role) => <span className="font-medium">{role.name}</span>,
  },
  {
    key: 'jobFamilyId',
    header: 'Job Family',
    render: (role) => <span className="text-muted-foreground">{role.jobFamilyId}</span>,
    widthClassName: 'w-40',
  },
  {
    key: 'level',
    header: 'Level',
    render: (role) => role.level ?? '—',
    widthClassName: 'w-28',
  },
  {
    key: 'track',
    header: 'Track',
    render: (role) =>
      role.track ? (
        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {ROLE_TRACK_OPTIONS.find((o) => o.value === role.track)?.label ?? role.track}
        </span>
      ) : (
        '—'
      ),
    widthClassName: 'w-40',
  },
  {
    key: 'updatedAt',
    header: 'Updated',
    render: (role) => (role.updatedAt ? new Date(role.updatedAt).toLocaleDateString() : '—'),
    widthClassName: 'w-28',
  },
];
