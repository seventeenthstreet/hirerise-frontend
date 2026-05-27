/**
 * hooks/useSkillsPriority.ts
 *
 * Fetches GET /api/v1/skills-priority/priority — skills priority engine.
 * Server-side cached for 30 minutes.
 *
 * Edge cases (from blueprint):
 *   - No targetRole set    → prioritySkills = [] with reason 'NO_TARGET_ROLE'
 *   - No skills in profile → prioritySkills = [] with reason 'NO_SKILLS'
 *   - Cache hit            → cached = true (no spinner needed on re-mount)
 *
 * v2 — React Query migration (Phase 2)
 * v2.1 — Hardening (Phase 2.5):
 *  - `select` added to flatten the raw response into the return shape.
 *    Components re-render only when prioritySkills / emptyReason / cached
 *    actually change, not on any response key change.
 *  - onError forwarded via useEffect (React Query v5 pattern).
 */

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiClientError } from '@/lib/api/core';
import { queryKeys } from '@/lib/query';
import { useAppContext } from '@/context/AppContext';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PrioritySkill {
  id:            string;
  name:          string;
  priority:      'critical' | 'high' | 'medium' | 'low';
  gap?:          number;
  currentLevel?: number;
  targetLevel?:  number;
  reason?:       string;
}

export type SkillsPriorityEmptyReason = 'NO_TARGET_ROLE' | 'NO_SKILLS' | null;

/** Raw shape returned by GET /api/v1/skills-priority/priority */
interface SkillsPriorityResponse {
  skills:      PrioritySkill[];
  emptyReason: SkillsPriorityEmptyReason;
  cached:      boolean;
}

/** Projected shape exposed to callers */
interface SkillsPrioritySelected {
  prioritySkills: PrioritySkill[];
  emptyReason:    SkillsPriorityEmptyReason;
  cached:         boolean;
}

export interface UseSkillsPriorityOptions {
  enabled?: boolean;
  onError?: (err: unknown) => void;
}

export interface UseSkillsPriorityReturn {
  prioritySkills: PrioritySkill[];
  emptyReason:    SkillsPriorityEmptyReason;
  cached:         boolean;
  isLoading:      boolean;
  isError:        boolean;
  error:          ApiClientError | null;
}

// ── Selector ──────────────────────────────────────────────────────────────────

function selectSkillsPriority(raw: SkillsPriorityResponse): SkillsPrioritySelected {
  return {
    prioritySkills: raw.skills      ?? [],
    emptyReason:    raw.emptyReason ?? null,
    cached:         raw.cached      ?? false,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSkillsPriority(options: UseSkillsPriorityOptions = {}): UseSkillsPriorityReturn {
  const { enabled = true, onError } = options;

  // Q-01 (Phase 3A Step 5): Gate on AppContext hydration — same guard as useDashboard.
  // Prevents GET /api/v1/skills-priority/priority from firing before the auth
  // sequence completes. Closes the pre-hydration query risk for all dashboard hooks.
  const { isHydrated } = useAppContext();

  const query = useQuery<SkillsPriorityResponse, ApiClientError, SkillsPrioritySelected>({
    queryKey: queryKeys.skillsPriority.all(),
    queryFn:  () =>
      apiClient<SkillsPriorityResponse>({ url: '/api/v1/skills-priority/priority' }),
    // Q-01: Both flags must be true — hydration gate + caller opt-out.
    enabled:  enabled && isHydrated,
    select:   selectSkillsPriority,
    // Phase 3B: The skills-priority endpoint is server-cached for 30 minutes.
    // Matching client staleTime to the server cache lifetime prevents redundant
    // refetches (e.g. on dashboard re-focus) that return identical data within
    // that window. The 2-min global default would cause 15 stale background
    // fetches within one server cache window — all returning the same result.
    staleTime: 30 * 60 * 1_000, // 30 min — aligns with server cache TTL
  });

  useEffect(() => {
    if (query.error && onError) {
      onError(query.error);
    }
  }, [query.error, onError]);

  return {
    prioritySkills: query.data?.prioritySkills ?? [],
    emptyReason:    query.data?.emptyReason    ?? null,
    cached:         query.data?.cached         ?? false,
    isLoading:      query.isLoading,
    isError:        query.isError,
    error:          query.error ?? null,
  };
}