/**
 * @file hooks/admin/usePermissionsAdmin.test.tsx
 * @description WP-ADMIN-04F-09 — hook tests. Every request is intercepted
 * by MSW (src/test/msw) — no live API is ever called.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderHookWithProviders } from '@/test/renderWithProviders';
import { server } from '@/test/msw/server';
import { PERMISSION_FIXTURES, ASSIGNMENT_FIXTURES, EVALUATION_ALLOW_RESULT } from '@/test/msw/fixtures';
import {
  useAdminPermissionsList,
  useAdminPermissionDetail,
  useAdminAssignmentsForPrincipal,
  useAssignAdminPermission,
  useRevokeAdminPermission,
  useEvaluateAdminPermission,
  useAdminPermissionVocabulary,
} from './usePermissionsAdmin';

describe('useAdminPermissionsList', () => {
  it('fetches the unfiltered catalog page', async () => {
    const { result } = renderHookWithProviders(() => useAdminPermissionsList({ limit: 20, offset: 0 }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(PERMISSION_FIXTURES.length);
    expect(result.current.data?.total).toBe(PERMISSION_FIXTURES.length);
  });

  it('calls the resource-filtered endpoint when `resource` is set', async () => {
    const { result } = renderHookWithProviders(() =>
      useAdminPermissionsList({ limit: 20, offset: 0, resource: 'cms_entry' }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items.every((p) => p.resource === 'cms_entry')).toBe(true);
  });

  it('surfaces a system-category error when the registry endpoint fails without a known code', async () => {
    server.use(
      http.get('/api/v1/admin/permissions/registry', () =>
        HttpResponse.json(
          { success: false, error: { code: 'INTERNAL_ERROR', message: 'boom' }, meta: { requestId: null, timestamp: new Date().toISOString() } },
          { status: 500 },
        ),
      ),
    );

    const { result } = renderHookWithProviders(() => useAdminPermissionsList({ limit: 20, offset: 0 }));

    // 'server' is a retrying category (shouldRetry/retryDelay) — this
    // exercises the app's real exponential backoff (~1s + ~2s), not a
    // stub, so it needs more than the default 1s waitFor window.
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 8000 });
    expect(result.current.error?.category).toBe('server');
  }, 10000);
});

describe('useAdminPermissionDetail', () => {
  it('stays disabled when identity is null', () => {
    const { result } = renderHookWithProviders(() => useAdminPermissionDetail(null));
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches a permission by identity', async () => {
    const { result } = renderHookWithProviders(() => useAdminPermissionDetail('user:view'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.identity).toBe('user:view');
  });

  it('categorizes a 404 as not_found via the new PERMISSION_NOT_FOUND mapping', async () => {
    const { result } = renderHookWithProviders(() => useAdminPermissionDetail('does:not-exist'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.category).toBe('not_found');
  });
});

describe('useAdminAssignmentsForPrincipal', () => {
  it('fetches assignments for a principal', async () => {
    const { result } = renderHookWithProviders(() => useAdminAssignmentsForPrincipal('user-123'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.assignments).toEqual(ASSIGNMENT_FIXTURES);
  });
});

describe('useAssignAdminPermission', () => {
  it('categorizes a duplicate-assignment conflict via the new ASSIGNMENT_DUPLICATE mapping', async () => {
    server.use(
      http.post('/api/v1/admin/permissions/assignments', () =>
        HttpResponse.json(
          { success: false, error: { code: 'ASSIGNMENT_DUPLICATE', message: 'already assigned' }, meta: { requestId: null, timestamp: new Date().toISOString() } },
          { status: 409 },
        ),
      ),
    );

    const { result } = renderHookWithProviders(() => useAssignAdminPermission());
    result.current.mutate({ principalId: 'user-123', resource: 'user', action: 'view' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.category).toBe('conflict');
  });

  it('succeeds against the default handler', async () => {
    const { result } = renderHookWithProviders(() => useAssignAdminPermission());
    result.current.mutate({ principalId: 'user-123', resource: 'user', action: 'view' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useRevokeAdminPermission', () => {
  it('succeeds against the default handler', async () => {
    const { result } = renderHookWithProviders(() => useRevokeAdminPermission());
    result.current.mutate({ principalId: 'user-123', resource: 'user', action: 'view' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.revoked).toBe(true);
  });
});

describe('useEvaluateAdminPermission', () => {
  beforeEach(() => {
    // Sanity check the fixture shape hasn't drifted from what tests assert below.
    expect(EVALUATION_ALLOW_RESULT.decision.outcome).toBe('allow');
  });

  it('returns the evaluation result verbatim', async () => {
    const { result } = renderHookWithProviders(() => useEvaluateAdminPermission());
    result.current.mutate({ principalId: 'user-123', resource: 'user', action: 'view' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.decision.outcome).toBe('allow');
    expect(result.current.data?.explanation.permission).toBe('user:view');
  });
});

// WP-ADMIN-04F-13B — the Registry-driven replacement for the removed
// PERMISSION_RESOURCES/PERMISSION_ACTIONS/PERMISSION_CATEGORIES constants.
describe('useAdminPermissionVocabulary', () => {
  it('derives the full, unfiltered vocabulary from the Registry by default', async () => {
    const { result } = renderHookWithProviders(() => useAdminPermissionVocabulary());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.vocabulary.resources).toEqual(expect.arrayContaining(['user', 'cms_entry', 'skill']));
    expect(result.current.vocabulary.actions).toEqual(expect.arrayContaining(['view', 'create', 'delete', 'publish']));
    expect(result.current.vocabulary.categories).toEqual(expect.arrayContaining(['administration', 'cms', 'skills']));
  });

  it('filters an Action list down to the ones registered under one Resource', async () => {
    const { result } = renderHookWithProviders(() => useAdminPermissionVocabulary());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // Fixtures: user:view, user:create, user:delete.
    expect(result.current.vocabulary.actionsForResource('user')).toEqual(['create', 'delete', 'view']);
    expect(result.current.vocabulary.actionsForResource('cms_entry')).toEqual(['publish']);
    expect(result.current.vocabulary.actionsForResource('nonexistent-resource')).toEqual([]);
  });

  it('narrows to only assignable (PUBLISHED/ADOPTED) Permissions when assignableOnly is set', async () => {
    const { result } = renderHookWithProviders(() => useAdminPermissionVocabulary({ assignableOnly: true }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // 'skill' only has a deprecated entry in the fixtures — must be excluded.
    expect(result.current.vocabulary.resources).not.toContain('skill');
    // 'user' has view (published) and create (adopted) but not delete (proposed).
    expect(result.current.vocabulary.actionsForResource('user')).toEqual(['create', 'view']);
  });

  it('surfaces a loading state before the Registry fetch resolves', () => {
    const { result } = renderHookWithProviders(() => useAdminPermissionVocabulary());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.vocabulary.resources).toEqual([]);
  });

  it('surfaces an error state (with retry) when the Registry fetch fails', async () => {
    server.use(
      http.get('/api/v1/admin/permissions/registry', () =>
        HttpResponse.json(
          { success: false, error: { code: 'INTERNAL_ERROR', message: 'boom' }, meta: { requestId: null, timestamp: new Date().toISOString() } },
          { status: 500 },
        ),
      ),
    );

    const { result } = renderHookWithProviders(() => useAdminPermissionVocabulary());
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 8000 });
    expect(result.current.vocabulary.resources).toEqual([]);
    expect(typeof result.current.refetch).toBe('function');
  }, 10000);

  it('returns an empty vocabulary (not an error) when the Registry has no matching entries', async () => {
    server.use(
      http.get('/api/v1/admin/permissions/registry', () =>
        HttpResponse.json({ success: true, data: { items: [], total: 0 } }),
      ),
    );

    const { result } = renderHookWithProviders(() => useAdminPermissionVocabulary());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(false);
    expect(result.current.vocabulary.resources).toEqual([]);
    expect(result.current.vocabulary.actionsForResource('user')).toEqual([]);
  });
});
