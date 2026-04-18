'use client';

/**
 * hooks/useSalaryCompare.ts
 *
 * Calls GET /api/v1/salary/compare?roleIds=A,B,C&experienceYears=N
 *
 * Returns ranked salary comparison across 2–5 roles.
 * Uses the existing salary bands from Firestore (no AI call — deterministic).
 *
 * Response shape:
 *   comparison[]: { role: { id, title }, salaryRange: { min, median, max }, ... }
 *   meta:         { highestPayingRole, lowestPayingRole, salarySpread }
 *   unavailableRoles: string[]
 *   experienceYearsUsed: number
 */

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/services/apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SalaryComparisonEntry {
  roleId:        string;
  role: {
    id:        string;
    title:     string;
    jobFamily: string;
    track:     string;
  };
  recommendedLevel:  string;
  levelLabel:        string;
  experienceYears:   number;
  salaryRange: {
    min:    number;
    max:    number;
    median: number;
  };
  monthlyEstimate: {
    min:    number;
    max:    number;
    median: number;
  } | null;
  percentileRanges?: Record<string, number>;
  marketPosition?:   string;
  currency:          string;
}

export interface SalaryCompareResult {
  comparison:          SalaryComparisonEntry[];
  unavailableRoles:    string[];
  experienceYearsUsed: number;
  meta: {
    highestPayingRole: string | null;
    lowestPayingRole:  string | null;
    salarySpread:      number;
  };
}

// ─── Query key ────────────────────────────────────────────────────────────────

export const SALARY_COMPARE_KEY = (roleIds: string[], expYears: number) =>
  ['salary', 'compare', roleIds.slice().sort().join(','), expYears] as const;

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseSalaryCompareOptions {
  roleIds:          string[];
  experienceYears?: number;
  enabled?:         boolean;
}

export function useSalaryCompare(opts: UseSalaryCompareOptions) {
  const { roleIds, experienceYears = 3, enabled = true } = opts;

  const params = new URLSearchParams({
    roleIds:         roleIds.join(','),
    experienceYears: String(experienceYears),
  });

  return useQuery<SalaryCompareResult>({
    queryKey: SALARY_COMPARE_KEY(roleIds, experienceYears),
    queryFn:  async () => {
      const envelope = await apiFetch<{ data: SalaryCompareResult }>(
        `/salary/compare?${params.toString()}`
      );
      return (envelope as unknown as SalaryCompareResult);
    },
    enabled:   enabled && roleIds.length >= 2,
    staleTime: 60 * 60 * 1000,  // 1 hour — salary bands change infrequently
    retry:     1,
  });
}
