// services/pendingService.ts
//
// API calls for the contributor submission + master admin approval workflow.
// Add these methods to adminService or import this service separately.

import { apiFetch } from './apiClient';

export type EntityType = 'skill' | 'role' | 'jobFamily' | 'educationLevel' | 'salaryBenchmark';
export type PendingStatus = 'pending' | 'approved' | 'rejected';

export interface PendingEntry {
  id: string;
  entityType: EntityType;
  payload: Record<string, unknown>;
  status: PendingStatus;
  submittedByUid: string;
  submittedByEmail: string;
  submittedAt: string;
  reviewedByUid: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  liveDocId?: string;
}

export interface Contributor {
  id: string;
  uid?: string; // @deprecated — use id (Supabase migration)
  email: string;
  displayName: string | null;
  role: string;
  createdAt: string;
  promotedAt: string | null;
  promotedBy: string | null;
}

export const pendingService = {

  // ── Contributor: submit entry for review ──────────────────────────────────
  submit(entityType: EntityType, payload: Record<string, unknown>): Promise<PendingEntry> {
    return apiFetch<PendingEntry>('/admin/pending', {
      method: 'POST',
      body: JSON.stringify({ entityType, payload }),
    });
  },

  // ── List pending entries (admin sees all, contributor sees own) ────────────
  list(params: { status?: PendingStatus; entityType?: EntityType } = {}): Promise<{ items: PendingEntry[]; total: number }> {
    const qs = new URLSearchParams();
    if (params.status)     qs.set('status', params.status);
    if (params.entityType) qs.set('entityType', params.entityType);
    return apiFetch<{ items: PendingEntry[]; total: number }>(`/admin/pending?${qs}`);
  },

  // ── Approve entry (admin only) ────────────────────────────────────────────
  approve(id: string): Promise<{ pendingId: string; liveId: string; collection: string }> {
    return apiFetch(`/admin/pending/${id}/approve`, { method: 'POST' });
  },

  // ── Reject entry (admin only) ─────────────────────────────────────────────
  reject(id: string, reason: string): Promise<{ id: string; status: string }> {
    return apiFetch(`/admin/pending/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // ── Withdraw submission (contributor: own only) ───────────────────────────
  withdraw(id: string): Promise<{ id: string; deleted: boolean }> {
    return apiFetch(`/admin/pending/${id}`, { method: 'DELETE' });
  },

  // ── Contributors management (admin only) ──────────────────────────────────
  listContributors(): Promise<{ contributors: Contributor[]; total: number }> {
    return apiFetch<{ contributors: Contributor[]; total: number }>('/admin/contributors');
  },

  promoteContributor(id: string): Promise<{ id: string; role: string }> {
    return apiFetch('/admin/contributors/promote', {
      method: 'POST',
      body: JSON.stringify({ id }),
    });
  },

  demoteContributor(id: string): Promise<{ id: string; role: string }> {
    return apiFetch('/admin/contributors/demote', {
      method: 'POST',
      body: JSON.stringify({ id }),
    });
  },
};