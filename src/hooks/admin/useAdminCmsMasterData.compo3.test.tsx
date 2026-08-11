/**
 * @file hooks/admin/useAdminCmsMasterData.compo3.test.tsx
 * @description WP-ADMIN-COMP-03 — hook tests for Roles, Career Domains, and
 * Skill Clusters. Every request is intercepted by MSW (src/test/msw) — no
 * live API is ever called.
 */

import { describe, it, expect } from 'vitest';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderHookWithProviders } from '@/test/renderWithProviders';
import { server } from '@/test/msw/server';
import { ROLE_FIXTURES, CAREER_DOMAIN_FIXTURES, SKILL_CLUSTER_FIXTURES } from '@/test/msw/fixtures';
import { useAdminCmsRolesList, useCreateAdminCmsRole, useUpdateAdminCmsRole } from './useAdminCmsRoles';
import {
  useAdminCareerDomainsList,
  useCreateAdminCareerDomain,
  useUpdateAdminCareerDomain,
  useDeleteAdminCareerDomain,
} from './useAdminCmsCareerDomains';
import {
  useAdminSkillClustersList,
  useCreateAdminSkillCluster,
  useDeleteAdminSkillCluster,
} from './useAdminCmsSkillClusters';

describe('useAdminCmsRolesList', () => {
  it('fetches the roles list', async () => {
    const { result } = renderHookWithProviders(() => useAdminCmsRolesList({ limit: 100 }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(ROLE_FIXTURES.length);
  });

  it('surfaces a validation-category error on create with a bad payload', async () => {
    server.use(
      http.post('/api/v1/admin/cms/roles', () =>
        HttpResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid role', details: { fields: [{ field: 'jobFamilyId', message: 'is required' }] } }, meta: {} },
          { status: 400 },
        ),
      ),
    );
    const { result } = renderHookWithProviders(() => useCreateAdminCmsRole());
    result.current.mutate({ name: 'X', jobFamilyId: '' });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.category).toBe('validation');
  });

  it('updates a role', async () => {
    const { result } = renderHookWithProviders(() => useUpdateAdminCmsRole());
    result.current.mutate({ roleId: 'role-1', input: { level: 'Staff' } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.level).toBe('Staff');
  });
});

describe('useAdminCareerDomainsList', () => {
  it('fetches every career domain (no pagination)', async () => {
    const { result } = renderHookWithProviders(() => useAdminCareerDomainsList());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(CAREER_DOMAIN_FIXTURES.length);
  });

  it('creates a career domain', async () => {
    const { result } = renderHookWithProviders(() => useCreateAdminCareerDomain());
    result.current.mutate({ name: 'Product Management' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.name).toBe('Product Management');
  });

  it('surfaces a conflict-category error on duplicate create', async () => {
    server.use(
      http.post('/api/v1/admin/cms/career-domains', () =>
        HttpResponse.json({ success: false, error: { code: 'CONFLICT', message: 'Already exists' }, meta: {} }, { status: 409 }),
      ),
    );
    const { result } = renderHookWithProviders(() => useCreateAdminCareerDomain());
    result.current.mutate({ name: 'Software Engineering' });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.category).toBe('conflict');
  });

  it('archives (soft-deletes) a career domain and parses the fixed data:null contract', async () => {
    const { result } = renderHookWithProviders(() => useDeleteAdminCareerDomain());
    result.current.mutate('cd-1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('updates a career domain', async () => {
    const { result } = renderHookWithProviders(() => useUpdateAdminCareerDomain());
    result.current.mutate({ id: 'cd-1', input: { status: 'inactive' } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.status).toBe('inactive');
  });
});

describe('useAdminSkillClustersList', () => {
  it('fetches skill clusters', async () => {
    const { result } = renderHookWithProviders(() => useAdminSkillClustersList({ limit: 100 }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(SKILL_CLUSTER_FIXTURES.length);
  });

  it('creates a skill cluster with a resolved domainId (not hard-coded)', async () => {
    const { result } = renderHookWithProviders(() => useCreateAdminSkillCluster());
    result.current.mutate({ name: 'Backend Development', domainId: 'cd-1' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.domainId).toBe('cd-1');
  });

  it('deletes a skill cluster', async () => {
    const { result } = renderHookWithProviders(() => useDeleteAdminSkillCluster());
    result.current.mutate('sc-1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
