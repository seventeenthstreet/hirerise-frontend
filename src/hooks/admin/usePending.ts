// hooks/admin/usePending.ts
//
// TanStack Query hooks for the contributor/approval workflow.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pendingService, type EntityType, type PendingStatus } from '@/services/pendingService';
import toast from 'react-hot-toast';

export const pendingKeys = {
  all:  () => ['admin', 'pending'] as const,
  list: (f: object) => [...pendingKeys.all(), 'list', f] as const,
  contributors: () => ['admin', 'contributors'] as const,
};

// ── Pending entries list ──────────────────────────────────────────────────────

export function usePendingEntries(filters: { status?: PendingStatus; entityType?: EntityType } = {}) {
  return useQuery({
    queryKey: pendingKeys.list(filters),
    queryFn:  () => pendingService.list(filters),
    staleTime: 30 * 1000,
  });
}

// ── Approve ───────────────────────────────────────────────────────────────────

export function useApproveEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pendingService.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pendingKeys.all() });
      toast.success('Entry approved and published.');
    },
    onError: (e: Error) => toast.error(e.message ?? 'Failed to approve entry.'),
  });
}

// ── Reject ────────────────────────────────────────────────────────────────────

export function useRejectEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => pendingService.reject(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pendingKeys.all() });
      toast.success('Entry rejected.');
    },
    onError: (e: Error) => toast.error(e.message ?? 'Failed to reject entry.'),
  });
}

// ── Withdraw (contributor) ────────────────────────────────────────────────────

export function useWithdrawEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pendingService.withdraw(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pendingKeys.all() });
      toast.success('Submission withdrawn.');
    },
    onError: (e: Error) => toast.error(e.message ?? 'Failed to withdraw submission.'),
  });
}

// ── Contributors list ─────────────────────────────────────────────────────────

export function useContributors() {
  return useQuery({
    queryKey: pendingKeys.contributors(),
    queryFn:  () => pendingService.listContributors(),
    staleTime: 60 * 1000,
  });
}

// ── Promote / Demote ──────────────────────────────────────────────────────────

export function usePromoteContributor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uid: string) => pendingService.promoteContributor(uid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pendingKeys.contributors() });
      toast.success('User promoted to contributor.');
    },
    onError: (e: Error) => toast.error(e.message ?? 'Failed to promote user.'),
  });
}

export function useDemoteContributor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uid: string) => pendingService.demoteContributor(uid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pendingKeys.contributors() });
      toast.success('Contributor access revoked.');
    },
    onError: (e: Error) => toast.error(e.message ?? 'Failed to demote contributor.'),
  });
}