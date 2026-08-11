/**
 * pages/admin/permissions/permissions.config.tsx
 *
 * Permission-catalog-specific configuration for the Master Data table
 * framework. Following the pattern established in users.config.tsx /
 * skills.config.tsx: the ONLY place Permission catalog column knowledge
 * lives — PermissionsCatalogPage.tsx and the MasterData* components stay
 * generic.
 */

import type { AdminPermission } from '@/lib/api/adminPermissions';
import type { MasterDataColumn } from '@/components/master-data';
import { PermissionStatusBadge } from '@/components/permissions';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export const PERMISSION_COLUMNS: MasterDataColumn<AdminPermission>[] = [
  {
    key: 'identity',
    header: 'Identity',
    render: (permission) => <span className="font-mono text-xs font-medium">{permission.identity}</span>,
  },
  {
    key: 'resource',
    header: 'Resource',
    render: (permission) => permission.resource,
    widthClassName: 'w-32',
  },
  {
    key: 'action',
    header: 'Action',
    render: (permission) => permission.action,
    widthClassName: 'w-28',
  },
  {
    key: 'category',
    header: 'Category',
    render: (permission) => <span className="text-muted-foreground">{permission.category ?? '—'}</span>,
    widthClassName: 'w-40',
  },
  {
    key: 'status',
    header: 'Status',
    render: (permission) => <PermissionStatusBadge status={permission.status} />,
    widthClassName: 'w-32',
  },
  {
    key: 'updatedAt',
    header: 'Updated',
    render: (permission) => <span className="text-muted-foreground">{formatDate(permission.updatedAt)}</span>,
    widthClassName: 'w-32',
  },
];
