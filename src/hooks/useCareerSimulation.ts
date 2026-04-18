/**
 * hooks/useCareerSimulation.ts
 *
 * React hook that wraps the Career Digital Twin service layer.
 *
 * Uses TanStack Query (useMutation + useQuery) instead of plain useState so
 * that:
 *   - Simulation results are cached per role+experience_years — re-renders and
 *     remounts don't fire a new POST if the same profile was already simulated.
 *   - The 20 req/min server-side rate limit is not exhausted by repeated
 *     mounts of the TwinPanel.
 *   - History is cached separately and invalidated after a new simulation.
 *
 * The public API is backwards-compatible with the previous useState version:
 *   const { simulation, loading, error, run } = useCareerSimulation();
 */

'use client';

import { useCallback }                           from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  runSimulation,
  getSimulations,
  getFuturePaths,
  type SimulationResult,
  type SimulationRecord,
  type RunSimulationOptions,
  type CareerPath,
} from '@/services/careerSimulationService';

// ─── Query keys ───────────────────────────────────────────────────────────────

export const simulationKeys = {
  result:  (role: string, expYears: number) =>
    ['career-simulation', 'result', role, expYears] as const,
  history: (limit: number) =>
    ['career-simulation', 'history', limit] as const,
};

// ─── Hook return type ─────────────────────────────────────────────────────────

interface UseCareerSimulationReturn {
  /** Latest simulation result (null until first successful run) */
  simulation:  SimulationResult | null;
  /** Simulation history records */
  history:     SimulationRecord[];
  /** True while a simulation or history fetch is in-flight */
  loading:     boolean;
  /** Error message from the most recent failed operation */
  error:       string | null;
  /** Run a new simulation — result is cached by role + experience_years */
  run:         (opts: RunSimulationOptions) => Promise<void>;
  /** Load simulation history for the current user */
  loadHistory: (limit?: number) => Promise<void>;
  /** Clear mutation error state */
  clearError:  () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCareerSimulation(): UseCareerSimulationReturn {
  const queryClient = useQueryClient();

  // ── Simulation mutation ────────────────────────────────────────────────────
  // useMutation handles the POST. On success we write the result directly into
  // the query cache keyed by role + experience_years so subsequent renders
  // with the same profile get an instant cache hit instead of another POST.
  const mutation = useMutation<SimulationResult, Error, RunSimulationOptions>({
    mutationFn: runSimulation,
    onSuccess: (data, opts) => {
      const role   = opts.userProfile.role;
      const expYrs = opts.userProfile.experience_years ?? 0;
      // Populate the query cache so a subsequent run() call is a no-op
      queryClient.setQueryData(simulationKeys.result(role, expYrs), data);
      // Invalidate history so it refreshes after a new simulation
      queryClient.invalidateQueries({ queryKey: ['career-simulation', 'history'] });
    },
  });

  // ── History query ──────────────────────────────────────────────────────────
  // Only fetches when explicitly triggered via loadHistory() — not on mount.
  const historyQuery = useQuery<SimulationRecord[]>({
    queryKey: simulationKeys.history(10),
    queryFn:  () => getSimulations(10),
    enabled:  false,
    staleTime: 5 * 60 * 1000,
  });

  // ── run() — public trigger ─────────────────────────────────────────────────
  const run = useCallback(async (opts: RunSimulationOptions) => {
    const role   = opts.userProfile.role;
    const expYrs = opts.userProfile.experience_years ?? 0;

    // Skip the POST if we already have a fresh cached result for this profile
    const cached = queryClient.getQueryData<SimulationResult>(
      simulationKeys.result(role, expYrs)
    );
    if (cached) return;

    await mutation.mutateAsync(opts);
  }, [mutation, queryClient]);

  // ── loadHistory() — public trigger ────────────────────────────────────────
  const loadHistory = useCallback(async (limit = 10) => {
    await queryClient.fetchQuery({
      queryKey: simulationKeys.history(limit),
      queryFn:  () => getSimulations(limit),
      staleTime: 5 * 60 * 1000,
    });
  }, [queryClient]);

  const clearError = useCallback(() => mutation.reset(), [mutation]);

  return {
    simulation:  mutation.data ?? null,
    history:     historyQuery.data ?? [],
    loading:     mutation.isPending || historyQuery.isFetching,
    error:       mutation.error?.message ?? null,
    run,
    loadHistory,
    clearError,
  };
}

// ─── useFuturePaths ───────────────────────────────────────────────────────────
//
// Lightweight hook for GET /api/v1/career/future-paths
//
// Key differences from useCareerSimulation:
//   - Uses GET query params — no AI call, no credits consumed
//   - Fires automatically on mount when `role` is available
//   - Returns a flat CareerPath[] without roles_detail or narrative
//   - Cached 30 min (same role + experience_years combination)
//   - Rate-limited to 20 req/min on the server — identical limit applies
//
// Use this for: instant path previews, quick comparisons, no-wait UX

export const futurePathsKeys = {
  paths: (role: string, expYears: number) =>
    ['career-twin', 'future-paths', role, expYears] as const,
};

interface UseFuturePathsOptions {
  role:              string | null | undefined;
  skills?:           string[];
  experience_years?: number;
  industry?:         string;
  /** Only fetch when true — default true when role is set */
  enabled?:          boolean;
}

export function useFuturePaths(opts: UseFuturePathsOptions) {
  const {
    role,
    skills           = [],
    experience_years = 0,
    industry         = '',
    enabled          = true,
  } = opts;

  return useQuery<CareerPath[]>({
    queryKey: futurePathsKeys.paths(role ?? '', experience_years),
    queryFn:  () => getFuturePaths(role!, skills, experience_years, industry),
    enabled:  enabled && !!role,
    staleTime: 30 * 60 * 1000, // 30 min — GET is cheap, cache generously
    retry:     1,
  });
}