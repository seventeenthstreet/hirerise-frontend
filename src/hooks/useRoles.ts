/**
 * hooks/useRoles.ts
 *
 * Fetches roles catalogue via GET /api/v1/roles.
 *
 * v2 — Phase 2.5 Final Hardening:
 *  BEFORE: Manual useState + async functions (fetchRoles, fetchRoleDetails).
 *  No caching, no deduplication. Every consumer that called fetchRoles()
 *  fired a new network request. Local state meant sibling consumers were
 *  never in sync. selectedRole was purely local UI state mixed into the
 *  data layer — an architectural boundary violation.
 *
 *  AFTER: useQuery for the catalogue fetch. selectedRole is removed from
 *  this hook entirely — it is UI selection state and belongs in the
 *  component (or a UI context if shared). Callers that need role details
 *  should call a separate `useRoleDetails(roleId)` hook; that pattern
 *  is not introduced here to stay within scope (harden, do not add features).
 *
 *  MIGRATION NOTE: The `loading` field is renamed `isLoading` for consistency
 *  with all other hooks. The `fetchRoles`, `selectRole`, and `getRoleDetails`
 *  imperative methods are removed — they were only safe to call from
 *  useEffect bodies, which is the pattern useQuery replaces.
 *  Callers that need role details should be updated to use a dedicated hook.
 */

import { useQuery } from '@tanstack/react-query';
import { getRoles } from '@/lib/api/roles';
import type { Role, GetRolesParams } from '@/lib/api/roles';
import type { ApiClientError } from '@/lib/api/core';
import { queryKeys } from '@/lib/query';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RolesResponse {
  roles: Role[];
}

export interface UseRolesOptions {
  params?:  GetRolesParams;
  enabled?: boolean;
}

export interface UseRolesReturn {
  roles:     Role[];
  isLoading: boolean;
  isError:   boolean;
  error:     ApiClientError | null;
  refetch:   () => void;
}

// ── Selector ──────────────────────────────────────────────────────────────────

function selectRoles(raw: RolesResponse): Role[] {
  return raw.roles ?? [];
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useRoles(options: UseRolesOptions = {}): UseRolesReturn {
  const { params, enabled = true } = options;

  const query = useQuery<RolesResponse, ApiClientError, Role[]>({
    // Include params in the key so different filter combinations cache separately.
    queryKey: params
      ? [...queryKeys.roles.all(), params]
      : queryKeys.roles.all(),
    queryFn:  () => getRoles(params),
    enabled,
    select:   selectRoles,
    // Phase 3B: Roles catalogue is static admin data — it never changes during
    // a user session. staleTime:Infinity prevents repeated background refetches
    // every 2 minutes and eliminates unnecessary backend load from the autocomplete
    // component that mounts useRoles on every onboarding step render.
    // gcTime is left at the default (5 min) so the cache clears after extended
    // inactivity, and the next session fetches fresh admin-managed role data.
    staleTime: Infinity,
  });

  return {
    roles:     query.data  ?? [],
    isLoading: query.isLoading,
    isError:   query.isError,
    error:     query.error ?? null,
    refetch:   () => { void query.refetch(); },
  };
}