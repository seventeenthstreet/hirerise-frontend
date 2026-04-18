// hooks/useApplications.ts
// TanStack Query hooks for the job applications tracker.
// Wraps the existing backend /api/v1/applications endpoints.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/services/apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ApplicationStatus =
  | 'applied'
  | 'rejected'
  | 'interview_scheduled'
  | 'interview_completed'
  | 'offer_received'
  | 'offer_accepted'
  | 'offer_rejected'
  | 'no_response'
  | 'withdrawn';

export interface Application {
  id:           string;
  companyName:  string;
  jobTitle:     string;
  emailSentTo:  string;
  appliedDate:  string;
  status:       ApplicationStatus;
  notes:        string | null;
  followUpDate: string | null;
  source:       string | null;
  createdAt:    string;
  updatedAt:    string;
}

export interface ApplicationsResponse {
  applications: Application[];
  total:        number;
  hasMore:      boolean;
  nextCursor:   string | null;
}

// ─── Query keys ───────────────────────────────────────────────────────────────
const APPS_KEY = ['applications'] as const;

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useApplications(limit = 20, status?: ApplicationStatus) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (status) params.set('status', status);

  return useQuery<ApplicationsResponse>({
    queryKey: [...APPS_KEY, limit, status],
    queryFn:  () => apiFetch<ApplicationsResponse>(`/applications?${params}`),
    staleTime: 60_000,
    gcTime:    5 * 60_000,
    retry: 1,
  });
}

export function useUpdateApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Pick<Application, 'status' | 'notes' | 'followUpDate'>> }) =>
      apiFetch<Application>(`/applications/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: APPS_KEY }),
  });
}

export function useDeleteApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<null>(`/applications/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: APPS_KEY }),
  });
}