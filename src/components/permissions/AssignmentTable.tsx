/**
 * components/permissions/AssignmentTable.tsx
 *
 * Thin composition of the certified MasterDataTable with
 * assignment-specific columns — same pattern as USER_COLUMNS/SKILL_COLUMNS
 * in pages/admin/*.config.tsx, just packaged as a component since
 * Assignment rows are reused across two pages (Assignment UI's principal
 * lookup and, optionally, a future Permission Detail assignment summary).
 *
 * MasterDataTable requires `T extends { id: string }`; AdminPermissionAssignment
 * has no `id` field (its natural key is `assignmentIdentity`), so rows are
 * adapted with `id: assignmentIdentity` at the boundary here — never by
 * changing the certified API type itself.
 */

import { MasterDataTable, type MasterDataColumn, type MasterDataRowAction } from '@/components/master-data';
import type { AdminPermissionAssignment } from '@/lib/api/adminPermissions';

type AssignmentRow = AdminPermissionAssignment & { id: string };

interface AssignmentTableProps {
  assignments: AdminPermissionAssignment[];
  isLoading?: boolean;
  onRevoke?: (assignment: AdminPermissionAssignment) => void;
  emptyState?: React.ReactNode;
}

export function AssignmentTable({ assignments, isLoading = false, onRevoke, emptyState }: AssignmentTableProps) {
  const rows: AssignmentRow[] = assignments.map((a) => ({ ...a, id: a.assignmentIdentity }));

  const columns: MasterDataColumn<AssignmentRow>[] = [
    { key: 'permissionIdentity', header: 'Permission', render: (row) => <span className="font-mono text-xs">{row.permissionIdentity}</span> },
    { key: 'resource', header: 'Resource', render: (row) => row.resource },
    { key: 'action', header: 'Action', render: (row) => row.action },
    {
      key: 'assignedAt',
      header: 'Assigned',
      render: (row) => new Date(row.assignedAt).toLocaleDateString(),
      widthClassName: 'w-36',
    },
  ];

  const rowActions: MasterDataRowAction<AssignmentRow>[] = onRevoke
    ? [{ key: 'revoke', label: 'Revoke', variant: 'destructive', onClick: onRevoke }]
    : [];

  return (
    <MasterDataTable
      columns={columns}
      rows={rows}
      rowActions={rowActions}
      isLoading={isLoading}
      emptyState={emptyState}
      getRowLabel={(row) => row.permissionIdentity}
    />
  );
}
