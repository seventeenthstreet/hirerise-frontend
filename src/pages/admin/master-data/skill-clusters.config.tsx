/**
 * pages/admin/master-data/skill-clusters.config.tsx
 *
 * Skill-Clusters-specific configuration for the Master Data framework
 * (WP-ADMIN-COMP-03).
 *
 * domainId has no static option list — it must be resolved from the live
 * Career Domains API. getSkillClusterFields() takes the fetched domain
 * options and builds the field config at render time; it is NOT a static
 * export like the other MASTER_DATA field configs.
 */

import type { AdminSkillCluster } from '@/lib/api/adminCmsSkillClusters';
import type { AdminCareerDomain } from '@/lib/api/adminCmsCareerDomains';
import type { MasterDataColumn, MasterDataFieldConfig } from '@/components/master-data';

export interface SkillClusterFormValues extends Record<string, unknown> {
  name: string;
  domainId: string;
  description: string;
}

export const EMPTY_SKILL_CLUSTER_FORM_VALUES: SkillClusterFormValues = {
  name: '',
  domainId: '',
  description: '',
};

export function skillClusterToFormValues(cluster: AdminSkillCluster): SkillClusterFormValues {
  return {
    name: cluster.name,
    domainId: cluster.domainId ?? '',
    description: cluster.description ?? '',
  };
}

/** Builds the field config from live Career Domain options — never hard-coded. */
export function getSkillClusterFields(domainOptions: { value: string; label: string }[]): MasterDataFieldConfig<SkillClusterFormValues>[] {
  return [
    {
      name: 'name',
      label: 'Name',
      type: 'text',
      placeholder: 'e.g. Frontend Development',
      required: true,
      maxLength: 200,
    },
    {
      name: 'domainId',
      label: 'Career domain',
      type: 'select',
      required: true,
      options: domainOptions,
      helpText: domainOptions.length === 0 ? 'Create a career domain first.' : undefined,
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      placeholder: 'Short description shown to end users',
      maxLength: 500,
    },
  ];
}

export function getSkillClusterColumns(domainNameById: Map<string, string>): MasterDataColumn<AdminSkillCluster>[] {
  return [
    {
      key: 'name',
      header: 'Name',
      render: (cluster) => <span className="font-medium">{cluster.name}</span>,
    },
    {
      key: 'domainId',
      header: 'Career Domain',
      render: (cluster) => (
        <span className="text-muted-foreground">
          {cluster.domainId ? (domainNameById.get(cluster.domainId) ?? cluster.domainId) : '—'}
        </span>
      ),
      widthClassName: 'w-48',
    },
    {
      key: 'description',
      header: 'Description',
      render: (cluster) => <span className="text-muted-foreground">{cluster.description || '—'}</span>,
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      render: (cluster) => (cluster.updatedAt ? new Date(cluster.updatedAt).toLocaleDateString() : '—'),
      widthClassName: 'w-28',
    },
  ];
}
