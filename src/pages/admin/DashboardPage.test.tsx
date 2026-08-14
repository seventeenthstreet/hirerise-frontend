/**
 * @file src/pages/admin/DashboardPage.test.tsx
 * @description WP-ADMIN-COMP-05 — Dashboard capability-state reconciliation
 * tests. Verifies:
 *  - Registered Users renders the real backend total, not a fabricated value.
 *  - Master Data (Roles, Career Domains, Skill Clusters, Job Families,
 *    Education Levels, Salary Benchmarks, Import) render as operational
 *    links, not disabled "Not yet available" tiles.
 *  - Administration (Users, Administrators, Permissions) render as
 *    operational links.
 *  - Operations: Jobs (WP-ADMIN-COMP-06) and Graph (WP-ADMIN-COMP-08)
 *    render as operational links; Intelligence/Weights still render with
 *    an explicit "Coming Soon" badge.
 */

import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/renderWithProviders';
import { server } from '@/test/msw/server';
import { ADMIN_USER_FIXTURES } from '@/test/msw/fixtures';
import DashboardPage from './DashboardPage';

function mockDashboardDependencies() {
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

/** Finds the QuickActionCard tile by its title, scoped to its enclosing link/group.
 * Some titles (Roles, Job Families, Education Levels, Salary Benchmarks) also
 * appear as Executive Overview MetricCard labels, so this picks the occurrence
 * that sits inside a QuickActionCard's <a> or disabled [role="group"] wrapper.
 */
function getCardContainer(title: string) {
  const matches = screen.getAllByText(title);
  const container = matches
    .map((el) => el.closest('a, [role="group"]'))
    .find((el): el is HTMLElement => el !== null);
  if (!container) throw new Error(`Could not find card container for "${title}"`);
  return container;
}

describe('DashboardPage — capability-state reconciliation', () => {
  it('renders the real Registered Users total, not a fabricated value', async () => {
    mockDashboardDependencies();
    renderWithProviders(<DashboardPage />);

    await waitFor(() =>
      expect(screen.getByText(String(ADMIN_USER_FIXTURES.length))).toBeInTheDocument(),
    );
  });

  it('shows Registered Users as Unavailable (not a fabricated zero) on API failure', async () => {
    mockDashboardDependencies();
    server.use(
      http.get('/api/v1/admin/users', () =>
        HttpResponse.json(
          { success: false, error: { code: 'INTERNAL', message: 'boom' }, meta: { requestId: null, timestamp: new Date().toISOString() } },
          { status: 500 },
        ),
      ),
    );
    renderWithProviders(<DashboardPage />);

    const registeredUsersLabel = await screen.findByText('Registered Users');
    const card = registeredUsersLabel.closest('div')?.parentElement as HTMLElement;
    await waitFor(() => expect(within(card).getByText('Unavailable')).toBeInTheDocument());
  });

  it.each([
    'Roles',
    'Career Domains',
    'Skill Clusters',
    'Job Families',
    'Education Levels',
    'Salary Benchmarks',
    'Import',
  ])('renders Master Data "%s" as an operational link, not "Not yet available"', async (title) => {
    mockDashboardDependencies();
    renderWithProviders(<DashboardPage />);

    const card = getCardContainer(title);
    expect(card.tagName.toLowerCase()).toBe('a');
    expect(within(card).queryByText('Not yet available')).not.toBeInTheDocument();
  });

  it.each(['Users', 'Administrators', 'Permissions'])(
    'renders Administration "%s" as an operational Dashboard link',
    async (title) => {
      mockDashboardDependencies();
      renderWithProviders(<DashboardPage />);

      const card = getCardContainer(title);
      expect(card.tagName.toLowerCase()).toBe('a');
    },
  );

  it.each(['Jobs', 'Graph'])(
    'renders Operations "%s" as an operational link (WP-ADMIN-COMP-06 / WP-ADMIN-COMP-08)',
    async (title) => {
      mockDashboardDependencies();
      renderWithProviders(<DashboardPage />);

      const card = getCardContainer(title);
      expect(card.tagName.toLowerCase()).toBe('a');
      expect(within(card).queryByText('Coming Soon')).not.toBeInTheDocument();
    },
  );

  it.each(['Intelligence', 'Weights'])(
    'renders Operations "%s" with a Coming Soon badge',
    async (title) => {
      mockDashboardDependencies();
      renderWithProviders(<DashboardPage />);

      const card = getCardContainer(title);
      expect(within(card).getByText('Coming Soon')).toBeInTheDocument();
    },
  );

  it('keeps Content Management under CMS marked Coming Soon', async () => {
    mockDashboardDependencies();
    renderWithProviders(<DashboardPage />);

    const card = getCardContainer('Content Management');
    expect(within(card).getByText('Coming Soon')).toBeInTheDocument();
  });

  it('never fabricates values for Job Families, Education Levels, Salary Benchmarks, or Last Import', async () => {
    mockDashboardDependencies();
    renderWithProviders(<DashboardPage />);

    await waitFor(() => expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0));
    // Active Users, Job Families, Education Levels, Salary Benchmarks, Last Import
    // — five Executive Overview metrics with no backing API today.
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThanOrEqual(5);
  });
});
