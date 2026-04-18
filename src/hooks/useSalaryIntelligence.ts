'use client';

// hooks/useSalaryIntelligence.ts
//
// Calls POST /api/v1/salary/intelligence
// Wired to the Salary Intelligence Engine.
//
// Body:    { roleId, experienceYears, location?, industry?, currentSalary? }
// Returns: full salary intelligence payload
//
// Falls back to POST /api/v1/salary/benchmark if /intelligence errors.

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/services/apiClient';

export interface SalaryIntelligenceResult {
  roleId:          string;
  currency:        string;
  marketP10?:      number;
  marketP25:       number;
  marketMedian:    number;
  marketP75:       number;
  marketP90?:      number;
  percentile?:     number | null;
  userSalary?:     number | null;
  currentSalary?:  number | null;
  salaryGap?:      number | null;
  insights?:       string[];
  growthPotential?: string | null;
  // Alias fields the CHI salaryBenchmark also uses
  yourEstimate?:   number | null;
}

interface FetchInput {
  roleId:          string;
  experienceYears: number;
  location?:       'metro' | 'tier1' | 'tier2' | 'tier3';
  industry?:       string | null;
  currentSalary?:  number | null;
}

export const SALARY_INTELLIGENCE_KEY = (roleId: string, exp: number) =>
  ['salary-intelligence', roleId, exp] as const;

export function useSalaryIntelligence(input: FetchInput | null) {
  return useQuery<SalaryIntelligenceResult>({
    queryKey: SALARY_INTELLIGENCE_KEY(input?.roleId ?? '', input?.experienceYears ?? 0),
    queryFn:  async () => {
      try {
        // Primary: full intelligence endpoint
        const result = await apiFetch<SalaryIntelligenceResult>(
          '/salary/intelligence',
          {
            method: 'POST',
            body:   JSON.stringify({
              roleId:          input!.roleId,
              experienceYears: input!.experienceYears,
              location:        input!.location   ?? 'metro',
              industry:        input!.industry   ?? null,
              currentSalary:   input!.currentSalary ?? null,
            }),
          },
        );
        return result as unknown as SalaryIntelligenceResult;
      } catch {
        // Fallback: benchmark endpoint (returns subset of fields)
        const bench = await apiFetch<SalaryIntelligenceResult>(
          '/salary/benchmark',
          {
            method: 'POST',
            body:   JSON.stringify({
              roleId:          input!.roleId,
              experienceYears: input!.experienceYears,
              location:        input!.location ?? 'metro',
            }),
          },
        );
        return bench as unknown as SalaryIntelligenceResult;
      }
    },
    enabled:   !!input?.roleId,
    staleTime: 30 * 60 * 1000,
    retry:     false, // already has internal fallback
  });
}