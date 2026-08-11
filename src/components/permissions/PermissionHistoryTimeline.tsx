/**
 * components/permissions/PermissionHistoryTimeline.tsx
 *
 * WP-ADMIN-05D — Enterprise Permission Audit & Governance History.
 *
 * Thin composition of the certified MasterDataTable + MasterDataPagination
 * — same pattern as AssignmentTable — rendering one Permission's unified
 * Assignment + Governance audit timeline. No history-assembly, filtering,
 * or sorting logic lives here: every row is rendered exactly as returned
 * by `GET /permissions/:id/history` (via useAdminPermissionHistory),
 * already unified and ordered server-side. This component only maps
 * response fields to table columns.
 */

import { MasterDataTable, MasterDataPagination, type MasterDataColumn } from '@/components/master-data';
import { PermissionHistoryActionBadge } from './PermissionHistoryActionBadge';
import type { PermissionHistoryEvent } from '@/lib/api/adminPermissions';

type HistoryRow = PermissionHistoryEvent; // already has `id` — no adaptation needed, unlike AssignmentTable's assignmentIdentity->id mapping

interface PermissionHistoryTimelineProps {
  events: PermissionHistoryEvent[];
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  /** Pagination footer — omitted entirely (no footer rendered) if not provided, e.g. for a small inline preview. */
  pagination?: {
    offset: number;
    limit: number;
    total: number;
    onOffsetChange: (nextOffset: number) => void;
  };
}

/** Compact, order-stable "key: value, key: value" rendering of an event's metadata — no assumption about which keys a given action's metadata carries (Assignment and Governance events shape it differently). */
function formatMetadata(metadata: Record<string, unknown>): string {
  const entries = Object.entries(metadata);
  if (entries.length === 0) return '—';
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(', ');
}

export function PermissionHistoryTimeline({ events, isLoading = false, emptyState, pagination }: PermissionHistoryTimelineProps) {
  const columns: MasterDataColumn<HistoryRow>[] = [
    { key: 'action', header: 'Action', render: (row) => <PermissionHistoryActionBadge action={row.action} />, widthClassName: 'w-40' },
    { key: 'adminId', header: 'Administrator', render: (row) => row.adminId ?? 'Unknown' },
    { key: 'metadata', header: 'Details', render: (row) => <span className="text-xs text-muted-foreground">{formatMetadata(row.metadata)}</span> },
    {
      key: 'occurredAt',
      header: 'When',
      render: (row) => new Date(row.occurredAt).toLocaleString(),
      widthClassName: 'w-48',
    },
  ];

  return (
    <div className="flex flex-col">
      <MasterDataTable
        columns={columns}
        rows={events}
        isLoading={isLoading}
        emptyState={emptyState}
        getRowLabel={(row) => `${row.action} at ${row.occurredAt}`}
      />
      {pagination && (
        <MasterDataPagination
          offset={pagination.offset}
          limit={pagination.limit}
          total={pagination.total}
          currentPageCount={events.length}
          onOffsetChange={pagination.onOffsetChange}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
