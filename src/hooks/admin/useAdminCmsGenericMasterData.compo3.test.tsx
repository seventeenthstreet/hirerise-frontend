/**
 * @file hooks/admin/useAdminCmsGenericMasterData.compo3.test.tsx
 * @description WP-ADMIN-COMP-03 — hook tests for Job Families, Education
 * Levels, and Salary Benchmarks (all backed by the generic CMS factory).
 */

import { describe, it, expect } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderHookWithProviders } from '@/test/renderWithProviders';
import { JOB_FAMILY_FIXTURES, EDUCATION_LEVEL_FIXTURES, SALARY_BENCHMARK_FIXTURES } from '@/test/msw/fixtures';
import { useAdminJobFamiliesList, useCreateAdminJobFamily, useDeleteAdminJobFamily } from './useAdminCmsJobFamilies';
import { useAdminEducationLevelsList, useCreateAdminEducationLevel } from './useAdminCmsEducationLevels';
import { useAdminSalaryBenchmarksList, useCreateAdminSalaryBenchmark } from './useAdminCmsSalaryBenchmarks';

describe('useAdminJobFamiliesList', () => {
  it('fetches job families', async () => {
    const { result } = renderHookWithProviders(() => useAdminJobFamiliesList({ limit: 100 }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(JOB_FAMILY_FIXTURES.length);
  });

  it('creates and deletes a job family', async () => {
    const create = renderHookWithProviders(() => useCreateAdminJobFamily());
    create.result.current.mutate({ name: 'Product' });
    await waitFor(() => expect(create.result.current.isSuccess).toBe(true));

    const del = renderHookWithProviders(() => useDeleteAdminJobFamily());
    del.result.current.mutate('jf-new');
    await waitFor(() => expect(del.result.current.isSuccess).toBe(true));
  });
});

describe('useAdminEducationLevelsList', () => {
  it('fetches education levels including sortOrder', async () => {
    const { result } = renderHookWithProviders(() => useAdminEducationLevelsList({ limit: 100 }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(EDUCATION_LEVEL_FIXTURES.length);
    expect(result.current.data?.items.every((i) => typeof i.sortOrder === 'number')).toBe(true);
  });

  it('creates an education level with a sortOrder', async () => {
    const { result } = renderHookWithProviders(() => useCreateAdminEducationLevel());
    result.current.mutate({ name: 'PhD', sortOrder: 0 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.sortOrder).toBe(0);
  });
});

describe('useAdminSalaryBenchmarksList', () => {
  it('fetches salary benchmarks', async () => {
    const { result } = renderHookWithProviders(() => useAdminSalaryBenchmarksList({ limit: 100 }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(SALARY_BENCHMARK_FIXTURES.length);
  });

  it('creates a salary benchmark without inventing business-rule validation', async () => {
    const { result } = renderHookWithProviders(() => useCreateAdminSalaryBenchmark());
    result.current.mutate({ name: 'QA Engineer — Kochi', minSalary: 500000, maxSalary: 900000, medianSalary: 700000, year: 2026 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.medianSalary).toBe(700000);
  });
});
