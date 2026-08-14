/**
 * @file src/pages/admin/GraphPage.test.tsx
 * @description WP-ADMIN-COMP-08 — Admin Graph page tests.
 */

import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/renderWithProviders';
import { server } from '@/test/msw/server';
import GraphPage from './GraphPage';

const SAMPLE_METRICS = {
  total_roles: 120,
  total_skills: 340,
  total_role_transitions: 58,
  total_skill_relationships: 90,
  total_role_skills: 610,
};

const SAMPLE_HEALTH = {
  status: 'healthy' as const,
  checkedAt: '2026-08-01T00:00:00.000Z',
  metrics: SAMPLE_METRICS,
  integrity: { valid: true, orphanCount: 0, rowsChecked: 500 },
};

const SAMPLE_DATASET_STATUS = [
  {
    datasetType: 'roles' as const,
    collection: 'roles',
    rowCount: 120,
    lastImportedAt: '2026-08-01T00:00:00.000Z',
    lastImportMode: 'append' as const,
    lastAdminUserId: 'admin-1',
    lastRowsImported: 10,
    lastRowsFailed: 0,
  },
];

const SAMPLE_VALIDATION = {
  checkedAt: '2026-08-01T00:00:00.000Z',
  rowsChecked: 500,
  orphanCount: 0,
  valid: true,
  issues: [] as unknown[],
};

const SAMPLE_STATS = {
  totalRoles: 120,
  totalTransitions: 58,
  avgTransitionsPerRole: 0.48,
  isolatedRoleCount: 4,
  topConnectedRoles: [{ roleId: 'role-1', connections: 12 }],
};

interface MockOverrides {
  health?: unknown;
  healthStatus?: number;
  metrics?: unknown;
  metricsStatus?: number;
  alerts?: unknown[];
  datasetStatuses?: unknown[];
  validation?: unknown;
  stats?: unknown;
  importLogs?: unknown[];
}

function mockGraphDependencies(overrides: MockOverrides = {}) {
  server.use(
    http.get('/api/v1/admin/graph/health', () =>
      overrides.healthStatus
        ? HttpResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'unavailable' }, meta: { requestId: null, timestamp: new Date().toISOString() } },
            { status: overrides.healthStatus },
          )
        : HttpResponse.json({ success: true, data: overrides.health ?? SAMPLE_HEALTH }),
    ),
    http.get('/api/v1/admin/graph/metrics', () =>
      overrides.metricsStatus
        ? HttpResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'unavailable' }, meta: { requestId: null, timestamp: new Date().toISOString() } },
            { status: overrides.metricsStatus },
          )
        : HttpResponse.json({ success: true, data: overrides.metrics ?? SAMPLE_METRICS }),
    ),
    http.get('/api/v1/admin/graph/alerts', () =>
      HttpResponse.json({ success: true, data: overrides.alerts ?? [] }),
    ),
    http.get('/api/v1/admin/graph/dataset-statuses', () =>
      HttpResponse.json({ success: true, data: overrides.datasetStatuses ?? SAMPLE_DATASET_STATUS }),
    ),
    http.get('/api/v1/admin/graph/validate', () =>
      HttpResponse.json({ success: true, data: overrides.validation ?? SAMPLE_VALIDATION }),
    ),
    http.get('/api/v1/admin/graph/stats', () =>
      HttpResponse.json({ success: true, data: overrides.stats ?? SAMPLE_STATS }),
    ),
    http.get('/api/v1/admin/graph/import-logs', () =>
      HttpResponse.json({ success: true, data: { logs: overrides.importLogs ?? [], count: (overrides.importLogs ?? []).length } }),
    ),
  );
}

describe('GraphPage', () => {
  it('renders health, metrics, and dataset status from the real backend', async () => {
    mockGraphDependencies();
    renderWithProviders(<GraphPage />);

    await waitFor(() => expect(screen.getByText('Healthy')).toBeInTheDocument());
    expect(screen.getAllByText('120').length).toBeGreaterThan(0); // Roles metric + dataset row count
    expect(screen.getAllByText('Roles').length).toBeGreaterThan(0);
  });

  it('shows a loading state before data arrives', () => {
    mockGraphDependencies();
    renderWithProviders(<GraphPage />);
    expect(screen.getByText('Loading metrics…')).toBeInTheDocument();
  });

  it('shows an empty state when there are no alerts', async () => {
    mockGraphDependencies({ alerts: [] });
    renderWithProviders(<GraphPage />);
    await waitFor(() => expect(screen.getByText('No active alerts.')).toBeInTheDocument());
  });

  it('renders alerts when the backend reports them', async () => {
    mockGraphDependencies({
      alerts: [
        {
          severity: 'critical',
          type: 'orphaned_fk',
          dataset: 'role_transitions',
          message: '2 orphaned references found in role_transitions',
          detectedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
    });
    renderWithProviders(<GraphPage />);
    await waitFor(() =>
      expect(screen.getByText('2 orphaned references found in role_transitions')).toBeInTheDocument(),
    );
  });

  it('shows an error state when metrics fail to load, without fabricating values', async () => {
    mockGraphDependencies({ metricsStatus: 400 });
    renderWithProviders(<GraphPage />);
    await waitFor(() => expect(screen.getByText('Unable to load graph metrics.')).toBeInTheDocument());
    // 610 (Role Skills) only ever comes from the metrics payload — it must
    // not appear anywhere on the page when that query has errored.
    expect(screen.queryByText('610')).not.toBeInTheDocument();
  });

  it('renders empty dataset administration state when no datasets are returned', async () => {
    mockGraphDependencies({ datasetStatuses: [] });
    renderWithProviders(<GraphPage />);
    await waitFor(() => expect(screen.getByText('No datasets found.')).toBeInTheDocument());
  });

  it('renders validation findings when the integrity report reports issues', async () => {
    mockGraphDependencies({
      validation: {
        checkedAt: '2026-08-01T00:00:00.000Z',
        rowsChecked: 500,
        orphanCount: 2,
        valid: false,
        issues: [
          {
            dataset: 'role_transitions',
            collection: 'roles',
            orphan_count: 2,
            sample: [{ id: null, field: 'to_role_id', value: 'role-999', missingFrom: 'roles' }],
          },
        ],
      },
    });
    renderWithProviders(<GraphPage />);
    await waitFor(() => expect(screen.getByText(/2 FK issue\(s\) found/)).toBeInTheDocument());
  });

  it('renders statistics from the real backend', async () => {
    mockGraphDependencies();
    renderWithProviders(<GraphPage />);
    await waitFor(() => expect(screen.getByText('Most Connected Roles')).toBeInTheDocument());
    expect(screen.getByText('role-1')).toBeInTheDocument();
  });

  it('renders the CSV Import panel', async () => {
    mockGraphDependencies();
    renderWithProviders(<GraphPage />);
    expect(await screen.findByRole('heading', { name: 'CSV Import' })).toBeInTheDocument();
  });

  it('never implies single-row create/edit/delete is supported', async () => {
    mockGraphDependencies();
    renderWithProviders(<GraphPage />);
    await waitFor(() => expect(screen.getByText('Graph')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /^create$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument();
  });
});
