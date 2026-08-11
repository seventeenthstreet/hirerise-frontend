/**
 * pages/admin/administrators.config.tsx
 *
 * Administrator-directory-specific configuration for the Master Data table
 * framework — WP-ADMIN-05A. Following the pattern established in
 * users.config.tsx: this is the ONLY place directory column knowledge
 * should live; AdministratorsPage.tsx and the MasterData* components stay
 * generic.
 */

import type { AdministratorListItem } from '@/lib/api/administrators';
import type { MasterDataColumn } from '@/components/master-data';
import { StatusBadge, type StatusBadgeVariant } from '@/components/admin-dashboard';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  super_admin: 'Super Admin',
  MASTER_ADMIN: 'Master Admin',
};

// Reuses the existing StatusBadge variant palette (admin-dashboard) rather
// than introducing a new badge component or new design tokens — the
// lifecycle semantics map cleanly onto the existing healthy/degraded/down
// vocabulary.
const STATUS_VARIANTS: Record<string, StatusBadgeVariant> = {
  active: 'healthy',
  suspended: 'degraded',
  revoked: 'down',
  expired: 'unavailable',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  suspended: 'Suspended',
  revoked: 'Revoked',
  expired: 'Expired',
};

export function AdministratorStatusBadge({ status }: { status: string }) {
  return (
    <StatusBadge
      variant={STATUS_VARIANTS[status] ?? 'neutral'}
      label={STATUS_LABELS[status] ?? status}
    />
  );
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export const ADMINISTRATOR_COLUMNS: MasterDataColumn<AdministratorListItem>[] = [
  {
    key: 'email',
    header: 'Email',
    render: (row) => <span className="font-medium">{row.email ?? row.uid}</span>,
  },
  {
    key: 'displayName',
    header: 'Name',
    render: (row) => <span className="text-muted-foreground">{row.displayName || '—'}</span>,
  },
  {
    key: 'role',
    header: 'Role',
    render: (row) => (
      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        {ROLE_LABELS[row.role] ?? row.role}
      </span>
    ),
    widthClassName: 'w-32',
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <AdministratorStatusBadge status={row.status} />,
    widthClassName: 'w-28',
  },
  {
    key: 'verifiedAt',
    header: 'Verified',
    render: (row) => <span className="text-muted-foreground">{formatDateTime(row.verifiedAt)}</span>,
    widthClassName: 'w-40',
  },
  {
    key: 'lastActionAt',
    header: 'Last Activity',
    render: (row) => <span className="text-muted-foreground">{formatDateTime(row.lastActionAt)}</span>,
    widthClassName: 'w-40',
  },
];
