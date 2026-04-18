'use client';

// app/(admin)/admin/my-entries/page.tsx
// Contributor view of their own submissions — with ability to withdraw pending ones.

import { useState } from 'react';
import { AdminTopbar } from '@/components/layout/AdminTopbar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { usePendingEntries, useWithdrawEntry } from '@/hooks/admin/usePending';
import type { PendingEntry, PendingStatus } from '@/services/pendingService';
import Link from 'next/link';
import { cn } from '@/utils/cn';

const ENTITY_LABELS: Record<string, string> = {
  skill: 'Skill', role: 'Role', jobFamily: 'Job Family',
  educationLevel: 'Education Level', salaryBenchmark: 'Salary Benchmark',
};

const STATUS_TABS: { label: string; value: PendingStatus | 'all' }[] = [
  { label: 'All',      value: 'all'      },
  { label: 'Pending',  value: 'pending'  },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, 'warning' | 'success' | 'danger' | 'neutral'> = {
    pending: 'warning', approved: 'success', rejected: 'danger',
  };
  return <Badge variant={map[status] ?? 'neutral'}>{status}</Badge>;
}

export default function MyEntriesPage() {
  const [statusFilter,    setStatusFilter]    = useState<PendingStatus | 'all'>('all');
  const [withdrawTarget,  setWithdrawTarget]  = useState<PendingEntry | null>(null);

  const { data, isLoading } = usePendingEntries(
    statusFilter === 'all' ? {} : { status: statusFilter }
  );
  const withdrawMutation = useWithdrawEntry();

  const entries = data?.items ?? [];

  const handleWithdraw = async () => {
    if (!withdrawTarget) return;
    await withdrawMutation.mutateAsync(withdrawTarget.id);
    setWithdrawTarget(null);
  };

  return (
    <div className="flex h-full flex-col">
      <AdminTopbar title="My Entries" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5 animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-surface-900">My Submissions</h2>
            <p className="text-sm text-surface-500">Track the status of everything you've submitted for review.</p>
          </div>
          <Link href="/admin/submit">
            <Button leftIcon={
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            }>
              New entry
            </Button>
          </Link>
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 rounded-xl border border-surface-100 bg-surface-50 p-1 w-fit">
          {STATUS_TABS.map(tab => (
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

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-100" />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-200 bg-surface-50 py-16 text-center">
            <p className="text-sm text-surface-500">No submissions yet.</p>
            <Link href="/admin/submit">
              <button className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-hr-600 px-4 py-2 text-sm font-semibold text-white hover:bg-hr-700">
                + Submit your first entry
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map(entry => (
              <div key={entry.id} className="rounded-xl border border-surface-100 bg-white px-5 py-4 shadow-card">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-surface-900 truncate">
                        {String(entry.payload.name ?? '—')}
                      </p>
                      <StatusBadge status={entry.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-surface-400">
                      {ENTITY_LABELS[entry.entityType] ?? entry.entityType}
                      {' · '}Submitted {new Date(entry.submittedAt).toLocaleDateString()}
                    </p>

                    {/* Rejection reason */}
                    {entry.status === 'rejected' && entry.rejectionReason && (
                      <div className="mt-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                        <p className="text-xs font-semibold text-red-700">Rejection reason</p>
                        <p className="text-xs text-red-600 mt-0.5">{entry.rejectionReason}</p>
                      </div>
                    )}

                    {/* Approval confirmation */}
                    {entry.status === 'approved' && (
                      <div className="mt-2 rounded-lg border border-green-100 bg-green-50 px-3 py-2">
                        <p className="text-xs text-green-700">
                          ✓ Approved and published on {entry.reviewedAt ? new Date(entry.reviewedAt).toLocaleDateString() : '—'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {entry.status === 'pending' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setWithdrawTarget(entry)}
                    >
                      Withdraw
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Withdraw confirm */}
      {withdrawTarget && (
        <Modal open onClose={() => setWithdrawTarget(null)} title="Withdraw submission">
          <div className="space-y-4">
            <p className="text-sm text-surface-600">
              Withdraw <strong>{String(withdrawTarget.payload.name ?? '—')}</strong>? This will permanently delete the submission.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setWithdrawTarget(null)}>Cancel</Button>
              <Button
                variant="danger"
                loading={withdrawMutation.isPending}
                onClick={handleWithdraw}
              >
                Withdraw
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}