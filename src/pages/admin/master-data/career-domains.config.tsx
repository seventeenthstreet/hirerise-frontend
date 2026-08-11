/**
 * pages/admin/master-data/career-domains.config.tsx
 *
 * Career-Domains-specific configuration for the Master Data framework
 * (WP-ADMIN-COMP-03). Field/validator choices mirror
 * adminCmsCareerDomains.module.js's `validators` array exactly.
 */

import type { AdminCareerDomain, CareerDomainStatus } from '@/lib/api/adminCmsCareerDomains';
import type { MasterDataColumn, MasterDataFieldConfig } from '@/components/master-data';

export const CAREER_DOMAIN_STATUS_OPTIONS: { value: CareerDomainStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export interface CareerDomainFormValues extends Record<string, unknown> {
  name: string;
  description: string;
  status: CareerDomainStatus | '';
}

export const EMPTY_CAREER_DOMAIN_FORM_VALUES: CareerDomainFormValues = {
  name: '',
  description: '',
  status: '',
};

export function careerDomainToFormValues(domain: AdminCareerDomain): CareerDomainFormValues {
  return {
    name: domain.name,
    description: domain.description ?? '',
    status: domain.status,
  };
}

export const CAREER_DOMAIN_FIELDS: MasterDataFieldConfig<CareerDomainFormValues>[] = [
  {
    name: 'name',
    label: 'Name',
    type: 'text',
    placeholder: 'e.g. Software Engineering',
    required: true,
    maxLength: 100,
  },
  {
    name: 'description',
    label: 'Description',
    type: 'textarea',
    placeholder: 'Short description shown to end users',
    maxLength: 500,
  },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    options: CAREER_DOMAIN_STATUS_OPTIONS,
    helpText: 'Defaults to "Active" for new domains.',
  },
];

export const CAREER_DOMAIN_COLUMNS: MasterDataColumn<AdminCareerDomain>[] = [
  {
    key: 'name',
    header: 'Name',
    render: (domain) => <span className="font-medium">{domain.name}</span>,
  },
  {
    key: 'description',
    header: 'Description',
    render: (domain) => <span className="text-muted-foreground">{domain.description || '—'}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    render: (domain) => (
      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        {CAREER_DOMAIN_STATUS_OPTIONS.find((o) => o.value === domain.status)?.label ?? domain.status}
      </span>
    ),
    widthClassName: 'w-28',
  },
  {
    key: 'updated_at',
    header: 'Updated',
    render: (domain) => (domain.updated_at ? new Date(domain.updated_at).toLocaleDateString() : '—'),
    widthClassName: 'w-28',
  },
];
