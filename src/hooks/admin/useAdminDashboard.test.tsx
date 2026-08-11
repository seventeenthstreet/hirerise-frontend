/**
 * @file hooks/admin/useAdminDashboard.test.tsx
 * @description WP-ADMIN-COMP-05 — hook tests for the Registered Users
 * metric wired into the Enterprise Dashboard. Skills/Roles/System Health
 * are mocked here purely so the hook can render end-to-end in isolation —
 * this file's assertions are about registeredUsers only.
 */

import { describe, it, expect } from 'vitest';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderHookWithProviders } from '@/test/renderWithProviders';
import { server } from '@/test/msw/server';
import { ADMIN_USER_FIXTURES } from '@/test/msw/fixtures';
import { useAdminDashboard } from './useAdminDashboard';

// The global MSW handlers cover /api/v1/admin/users (Registered Users'
// backing endpoint) but not /api/v1/system/health, /api/v1/roles, or
// /api/v1/admin/cms/skills — useAdminDashboard also queries those, so they
// need local handlers here or every test would fail under the shared
// server's onUnhandledRequest: 'error' setting.
function mockHealthRolesSkills() {
  server.use(
    http.get('/api/v1/system/health', () =>
      HttpResponse.json({
        success: true,
        data: {
          status: 'healthy',
          environment: 'development',
          build_version: 'test',
          error_rate_24h: 0,
          checked_at: new Date().toISOString(),
        },
      }),
    ),
    http.get('/api/v1/roles', () => HttpResponse.json({ success: true, data: { items: [], total: 12 } })),
    http.get('/api/v1/admin/cms/skills', () => HttpResponse.json({ success: true, data: { items: [], total: 40 } })),
  );
}

describe('useAdminDashboard — registeredUsers', () => {
  it('starts loading, then resolves to the real backend total (no fabricated zero)', async () => {
    mockHealthRolesSkills();

    const { result } = renderHookWithProviders(() => useAdminDashboard());

    expect(result.current.registeredUsers.isLoading).toBe(true);
    expect(result.current.registeredUsers.isUnavailable).toBe(false);

    await waitFor(() => expect(result.current.registeredUsers.isLoading).toBe(false));

    expect(result.current.registeredUsers.value).toBe(ADMIN_USER_FIXTURES.length);
    expect(result.current.registeredUsers.isUnavailable).toBe(false);
  });

  it('marks registeredUsers unavailable on API failure, never falling back to a fabricated zero', async () => {
    mockHealthRolesSkills();
    server.use(
      http.get('/api/v1/admin/users', () =>
        HttpResponse.json(
          { success: false, error: { code: 'INTERNAL', message: 'boom' }, meta: { requestId: null, timestamp: new Date().toISOString() } },
          { status: 500 },
        ),
      ),
    );

    const { result } = renderHookWithProviders(() => useAdminDashboard());

    await waitFor(() => expect(result.current.registeredUsers.isLoading).toBe(false));

    expect(result.current.registeredUsers.isUnavailable).toBe(true);
    expect(result.current.registeredUsers.value).toBeNull();
  });

  it('uses the existing GET /api/v1/admin/users endpoint — no duplicate user-count API', async () => {
    mockHealthRolesSkills();
    let hitCount = 0;
    server.use(
      http.get('/api/v1/admin/users', () => {
        hitCount += 1;
        return HttpResponse.json({ success: true, data: { items: ADMIN_USER_FIXTURES, total: ADMIN_USER_FIXTURES.length } });
      }),
    );

    const { result } = renderHookWithProviders(() => useAdminDashboard());
    await waitFor(() => expect(result.current.registeredUsers.isLoading).toBe(false));

    expect(hitCount).toBeGreaterThan(0);
    expect(result.current.registeredUsers.value).toBe(ADMIN_USER_FIXTURES.length);
  });
});
