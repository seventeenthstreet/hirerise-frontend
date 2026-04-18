// app/admin/approvals/page.tsx
'use client';

import { useMemo, useState } from 'react';
import { AdminTopbar } from '@/components/layout/AdminTopbar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  usePendingEntries,
  useApproveEntry,
  useRejectEntry,
} from '@/hooks/admin/usePending';
import type {
  PendingEntry,
  PendingStatus,
} from '@/services/pendingService';
import { cn } from '@/utils/cn';

const ENTITY_LABELS: Record<string, string> = {
  skill: 'Skill',
  role: 'Role',
  jobFamily: 'Job Family',
  educationLevel: 'Education Level',
  salaryBenchmark: 'Salary Benchmark',
};

const STATUS_TABS: { label: string; value: PendingStatus | 'all' }[] = [
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'All', value: 'all' },
];

function safePreviewValue(value: unknown) {
  if (value == null) return '—';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[unserializable]';
    }
  }
  return String(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return date.toLocaleDateString();
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<
    string,
    'warning' | 'success' | 'danger' | 'neutral'
  > = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger',
  };

  return <Badge variant={map[status] ?? 'neutral'}>{status}</Badge>;
}

function PayloadPreview({
  payload,
}: {
  payload: Record<string, unknown>;
}) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-lg bg-surface-50 p-3 text-xs sm:grid-cols-3">
      {Object.entries(payload).map(([key, value]) => (
        <div key={key}>
          <dt className="font-medium text-surface-400 capitalize">
            {key.replace(/([A-Z])/g, ' $1')}
          </dt>
          <dd className="truncate text-surface-800">
            {safePreviewValue(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function ApprovalsPage() {
  const [statusFilter, setStatusFilter] =
    useState<PendingStatus | 'all'>('pending');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] =
    useState<PendingEntry | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [activeMutationId, setActiveMutationId] =
    useState<string | null>(null);

  const queryParams = useMemo(
    () =>
      statusFilter === 'all'
        ? undefined
        : { status: statusFilter },
    [statusFilter]
  );

  const { data, isLoading } = usePendingEntries(queryParams);
  const approveMutation = useApproveEntry();
  const rejectMutation = useRejectEntry();

  const entries = data?.items ?? [];

  const handleApprove = async (id: string) => {
    try {
      setActiveMutationId(id);
      await approveMutation.mutateAsync(id);

      if (expanded === id) {
        setExpanded(null);
      }
    } finally {
      setActiveMutationId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;

    try {
      setActiveMutationId(rejectTarget.id);

      await rejectMutation.mutateAsync({
        id: rejectTarget.id,
        reason: rejectReason.trim(),
      });

      setRejectTarget(null);
      setRejectReason('');
    } finally {
      setActiveMutationId(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <AdminTopbar title="Approval Queue" />

      <div className="flex-1 space-y-5 overflow-y-auto p-6 animate-slide-up">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-surface-900">
              Contributor Submissions
            </h2>
            <p className="text-sm text-surface-500">
              Review and publish or reject entries submitted by contributors.
            </p>
          </div>

          {statusFilter === 'pending' && entries.length > 0 && (
            <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white">
              {entries.length} pending
            </span>
          )}
        </div>

        <div className="flex w-fit gap-1 rounded-xl border border-surface-100 bg-surface-50 p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
                statusFilter === tab.value
                  ? 'bg-white text-surface-900 shadow-card'
                  : 'text-surface-500 hover:text-surface-700'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-xl bg-surface-100"
              />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-200 bg-surface-50 py-16 text-center">
            <p className="text-sm text-surface-500">
              No {statusFilter === 'all' ? '' : statusFilter} entries.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const isOpen = expanded === entry.id;
              const isRowLoading =
                activeMutationId === entry.id;

              return (
                <div
                  key={entry.id}
                  className="rounded-xl border border-surface-100 bg-white shadow-card"
                >
                  <div className="flex items-center gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-surface-900">
                          {safePreviewValue(entry.payload.name)}
                        </p>
                        <StatusBadge status={entry.status} />
                      </div>

                      <p className="mt-0.5 text-xs text-surface-400">
                        {ENTITY_LABELS[entry.entityType] ??
                          entry.entityType}
                        {' · '}by {entry.submittedByEmail}
                        {' · '}
                        {formatDate(entry.submittedAt)}
                      </p>

                      {entry.rejectionReason && (
                        <p className="mt-1 text-xs text-red-600">
                          Reason: {entry.rejectionReason}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() =>
                          setExpanded(
                            isOpen ? null : entry.id
                          )
                        }
                        className="text-xs font-medium text-hr-600 hover:text-hr-700"
                      >
                        {isOpen ? 'Collapse' : 'Preview'}
                      </button>

                      {entry.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={isRowLoading}
                            onClick={() => {
                              setRejectTarget(entry);
                              setRejectReason('');
                            }}
                          >
                            Reject
                          </Button>

                          <Button
                            size="sm"
                            loading={isRowLoading}
                            disabled={isRowLoading}
                            onClick={() =>
                              handleApprove(entry.id)
                            }
                          >
                            Approve
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-surface-50 px-5 pb-4">
                      <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-surface-400">
                        Payload
                      </p>
                      <PayloadPreview payload={entry.payload} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {rejectTarget && (
        <Modal
          open
          onClose={() => setRejectTarget(null)}
          title="Reject submission"
        >
          <div className="space-y-4">
            <p className="text-sm text-surface-600">
              Rejecting{' '}
              <strong>
                {safePreviewValue(rejectTarget.payload.name)}
              </strong>
              . The contributor will see your reason.
            </p>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-800">
                Reason <span className="text-red-500">*</span>
              </label>

              <textarea
                value={rejectReason}
                onChange={(e) =>
                  setRejectReason(e.target.value)
                }
                rows={3}
                placeholder="e.g. Duplicate entry, missing description, incorrect category…"
                className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-900 placeholder:text-surface-300 focus:border-hr-500 focus:outline-none focus:ring-2 focus:ring-hr-500"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setRejectTarget(null)}
              >
                Cancel
              </Button>

              <Button
                variant="danger"
                disabled={!rejectReason.trim()}
                loading={
                  activeMutationId === rejectTarget.id
                }
                onClick={handleReject}
              >
                Reject entry
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}