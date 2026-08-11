/**
 * pages/admin/users.config.tsx
 *
 * User-directory-specific configuration for the Master Data table framework.
 * Following the pattern established in skills.config.tsx (WP-ADMIN-02A §18):
 * this is the ONLY place user-directory column knowledge should live —
 * UsersPage.tsx and the MasterData* components stay generic.
 *
 * WP-ADMIN-04 Phase 1B — read-only, so there is no form/field config here,
 * only table columns.
 */

import type { AdminUserListItem } from '@/lib/api/adminUsers';
import type { MasterDataColumn } from '@/components/master-data';

const ROLE_LABELS: Record<string, string> = {
  user: 'User',
  admin: 'Admin',
  super_admin: 'Super Admin',
  MASTER_ADMIN: 'Master Admin',
  contributor: 'Contributor',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export const USER_COLUMNS: MasterDataColumn<AdminUserListItem>[] = [
  {
    key: 'email',
    header: 'Email',
    render: (user) => <span className="font-medium">{user.email}</span>,
  },
  {
    key: 'displayName',
    header: 'Display Name',
    render: (user) => (
      <span className="text-muted-foreground">{user.displayName || '—'}</span>
    ),
  },
  {
    key: 'role',
    header: 'Role',
    render: (user) => (
      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        {ROLE_LABELS[user.role] ?? user.role}
      </span>
    ),
    widthClassName: 'w-32',
  },
  {
    key: 'createdAt',
    header: 'Created',
    render: (user) => <span className="text-muted-foreground">{formatDate(user.createdAt)}</span>,
    widthClassName: 'w-32',
  },
];
