// features/admin/secrets/hooks/useSecrets.ts
//
// TanStack Query hooks for the Secrets Manager admin feature.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { secretsService } from '@/services/secretsService';
import type { CreateSecretDto, SecretMeta } from '@/types/secrets';

// ─── Query key factory ────────────────────────────────────────────────────────

export const secretKeys = {
  all:    () => ['admin', 'secrets']          as const,
  list:   () => ['admin', 'secrets', 'list']  as const,
  status: (name: string) => ['admin', 'secrets', 'status', name] as const,
};

// ─── List ─────────────────────────────────────────────────────────────────────

export function useSecrets() {
  return useQuery<SecretMeta[]>({
    queryKey: secretKeys.list(),
    queryFn:  () => secretsService.list(),
    staleTime: 0,        // always fetch fresh on mount
    // gcTime must NOT be 0 — see comment in secretsService.ts
    gcTime:    30_000,
  });
}

// ─── Status (masked preview) ──────────────────────────────────────────────────

export function useSecretStatus(name: string, enabled = true) {
  return useQuery({
    queryKey: secretKeys.status(name),
    queryFn:  () => secretsService.getStatus(name),
    enabled:  enabled && !!name,
    staleTime: 0,
    gcTime:    30_000,
  });
}

// ─── Upsert ───────────────────────────────────────────────────────────────────

export function useUpsertSecret() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSecretDto) => secretsService.upsert(data),
    onSuccess: (result) => {
      // Invalidate list so the table and coverage panel refresh immediately
      queryClient.invalidateQueries({ queryKey: secretKeys.list() });
      queryClient.invalidateQueries({ queryKey: secretKeys.status(result.name) });
    },
  });
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export function useDeleteSecret() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => secretsService.delete(name),
    onSuccess: (_result, name) => {
      queryClient.invalidateQueries({ queryKey: secretKeys.list() });
      queryClient.removeQueries({ queryKey: secretKeys.status(name) });
    },
  });
}