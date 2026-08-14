/**
 * @file hooks/admin/useAdminGraph.test.tsx
 * @description WP-ADMIN-COMP-08 — hook tests for the Admin Graph module.
 *
 * NOTE on the import/preview mutation tests below: a File-bearing FormData
 * body hangs indefinitely in this project's jsdom test environment (the
 * same limitation documented in lib/api/adminJobs.uploadCsv.test.ts and
 * pages/admin/JobSyncPanel.test.tsx — a jsdom/axios body-pipeline issue,
 * not a defect in this code). Every other query here goes through real
 * MSW handlers; the two mutations instead mock '@/lib/api/adminGraph' at
 * the module boundary (same approach JobSyncPanel.test.tsx uses) so the
 * hooks' plumbing — call arguments, success/error state, cache
 * invalidation, retry behavior — is still exercised without the hang. The
 * actual FormData/File request SHAPE (field names, headers) is covered
 * separately in lib/api/adminGraph.import.test.ts, which spies on
 * axiosInstance.request() directly, exactly like adminJobs.uploadCsv.test.ts
 * does for uploadAdminJobsCsv.
 */

import { describe, it, expect, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderHookWithProviders } from '@/test/renderWithProviders';
import { server } from '@/test/msw/server';
import {
  useAdminGraphMetrics,
  useAdminGraphValidation,
  useAdminGraphDatasetStatuses,
  useAdminGraphHealth,
  useAdminGraphAlerts,
  useAdminGraphStats,
  useAdminGraphImportLogs,
} from './useAdminGraph';

const SAMPLE_METRICS = {
  total_roles: 120,
  total_skills: 340,
  total_role_transitions: 58,
  total_skill_relationships: 90,
  total_role_skills: 610,
};

describe('useAdminGraph', () => {
  describe('useAdminGraphMetrics', () => {
    it('returns metrics from GET /api/v1/admin/graph/metrics', async () => {
      server.use(
        http.get('/api/v1/admin/graph/metrics', () =>
          HttpResponse.json({ success: true, data: SAMPLE_METRICS }),
        ),
      );

      const { result } = renderHookWithProviders(() => useAdminGraphMetrics());

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(SAMPLE_METRICS);
    });

    it('surfaces an error without fabricating data', async () => {
      server.use(
        http.get('/api/v1/admin/graph/metrics', () =>
          HttpResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'bad request' }, meta: { requestId: null, timestamp: new Date().toISOString() } },
            { status: 400 },
          ),
        ),
      );

      const { result } = renderHookWithProviders(() => useAdminGraphMetrics());

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.data).toBeUndefined();
    });
  });

  describe('useAdminGraphValidation', () => {
    it('returns a clean integrity report', async () => {
      server.use(
        http.get('/api/v1/admin/graph/validate', () =>
          HttpResponse.json({
            success: true,
            data: { checkedAt: '2026-08-01T00:00:00.000Z', rowsChecked: 500, orphanCount: 0, valid: true, issues: [] },
          }),
        ),
      );

      const { result } = renderHookWithProviders(() => useAdminGraphValidation());
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.valid).toBe(true);
    });

    it('returns an integrity report with issues', async () => {
      server.use(
        http.get('/api/v1/admin/graph/validate', () =>
          HttpResponse.json({
            success: true,
            data: {
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
          }),
        ),
      );

      const { result } = renderHookWithProviders(() => useAdminGraphValidation());
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.valid).toBe(false);
      expect(result.current.data?.issues).toHaveLength(1);
    });
  });

  describe('useAdminGraphDatasetStatuses', () => {
    it('returns one entry per dataset type', async () => {
      server.use(
        http.get('/api/v1/admin/graph/dataset-statuses', () =>
          HttpResponse.json({
            success: true,
            data: [
              {
                datasetType: 'roles',
                collection: 'roles',
                rowCount: 120,
                lastImportedAt: '2026-08-01T00:00:00.000Z',
                lastImportMode: 'append',
                lastAdminUserId: 'admin-1',
                lastRowsImported: 10,
                lastRowsFailed: 0,
              },
            ],
          }),
        ),
      );

      const { result } = renderHookWithProviders(() => useAdminGraphDatasetStatuses());
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].datasetType).toBe('roles');
    });
  });

  describe('useAdminGraphHealth', () => {
    it('returns a healthy status', async () => {
      server.use(
        http.get('/api/v1/admin/graph/health', () =>
          HttpResponse.json({
            success: true,
            data: {
              status: 'healthy',
              checkedAt: '2026-08-01T00:00:00.000Z',
              metrics: SAMPLE_METRICS,
              integrity: { valid: true, orphanCount: 0, rowsChecked: 500 },
            },
          }),
        ),
      );

      const { result } = renderHookWithProviders(() => useAdminGraphHealth());
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.status).toBe('healthy');
    });
  });

  describe('useAdminGraphAlerts', () => {
    it('returns an empty array when there are no alerts', async () => {
      server.use(
        http.get('/api/v1/admin/graph/alerts', () => HttpResponse.json({ success: true, data: [] })),
      );

      const { result } = renderHookWithProviders(() => useAdminGraphAlerts());
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([]);
    });

    it('returns alerts when the backend reports them', async () => {
      server.use(
        http.get('/api/v1/admin/graph/alerts', () =>
          HttpResponse.json({
            success: true,
            data: [
              {
                severity: 'critical',
                type: 'orphaned_fk',
                dataset: 'role_transitions',
                message: '2 orphaned references found in role_transitions',
                detectedAt: '2026-08-01T00:00:00.000Z',
              },
            ],
          }),
        ),
      );

      const { result } = renderHookWithProviders(() => useAdminGraphAlerts());
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].severity).toBe('critical');
    });
  });

  describe('useAdminGraphStats', () => {
    it('returns career graph connectivity stats', async () => {
      server.use(
        http.get('/api/v1/admin/graph/stats', () =>
          HttpResponse.json({
            success: true,
            data: {
              totalRoles: 120,
              totalTransitions: 58,
              avgTransitionsPerRole: 0.48,
              isolatedRoleCount: 4,
              topConnectedRoles: [{ roleId: 'role-1', connections: 12 }],
            },
          }),
        ),
      );

      const { result } = renderHookWithProviders(() => useAdminGraphStats());
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.totalRoles).toBe(120);
    });
  });

  describe('useAdminGraphImportLogs', () => {
    it('returns recent import history', async () => {
      server.use(
        http.get('/api/v1/admin/graph/import-logs', () =>
          HttpResponse.json({
            success: true,
            data: {
              logs: [
                {
                  id: 'log-1',
                  dataset_name: 'roles',
                  entity_type: 'roles',
                  admin_user_id: 'admin-1',
                  imported_at: '2026-08-01T00:00:00.000Z',
                  rows_processed: 100,
                  rows_imported: 98,
                  rows_skipped: 2,
                  rows_failed: 0,
                  duplicate_errors: 1,
                  fk_errors: 1,
                  duration_ms: 850,
                  import_mode: 'append',
                },
              ],
              count: 1,
            },
          }),
        ),
      );

      const { result } = renderHookWithProviders(() => useAdminGraphImportLogs(20));
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.logs).toHaveLength(1);
    });

    it('returns an empty history without fabricating rows', async () => {
      server.use(
        http.get('/api/v1/admin/graph/import-logs', () =>
          HttpResponse.json({ success: true, data: { logs: [], count: 0 } }),
        ),
      );

      const { result } = renderHookWithProviders(() => useAdminGraphImportLogs(20));
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.logs).toHaveLength(0);
    });
  });

  describe('usePreviewAdminGraphDataset', () => {
    it('calls previewAdminGraphDataset with the selected dataset/file/options and returns its result', async () => {
      vi.resetModules();
      vi.doMock('@/lib/api/adminGraph', async () => {
        const actual = await vi.importActual<typeof import('@/lib/api/adminGraph')>('@/lib/api/adminGraph');
        return {
          ...actual,
          previewAdminGraphDataset: vi.fn().mockResolvedValue({
            datasetType: 'roles',
            processed: 5,
            importable: 4,
            fieldErrors: [],
            duplicateErrors: [],
            fkErrors: [{ row: 3, field: 'role_family', type: 'fk', message: 'not found' }],
            errorCount: 1,
            preview: [{ role_id: 'role-1', role_name: 'Engineer' }],
          }),
        };
      });
      const { usePreviewAdminGraphDataset: hook } = await import('./useAdminGraph');
      const { previewAdminGraphDataset: mockedFn } = await import('@/lib/api/adminGraph');

      const { result } = renderHookWithProviders(() => hook());
      const file = new File(['role_id,role_name\nrole-1,Engineer'], 'roles.csv', { type: 'text/csv' });
      result.current.mutate({ datasetType: 'roles', file, options: { mode: 'append' } });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.importable).toBe(4);
      expect(mockedFn).toHaveBeenCalledWith('roles', file, { mode: 'append' });
      vi.doUnmock('@/lib/api/adminGraph');
    });
  });

  describe('useImportAdminGraphDataset', () => {
    it('calls importAdminGraphDataset and returns its result', async () => {
      vi.resetModules();
      vi.doMock('@/lib/api/adminGraph', async () => {
        const actual = await vi.importActual<typeof import('@/lib/api/adminGraph')>('@/lib/api/adminGraph');
        return {
          ...actual,
          importAdminGraphDataset: vi.fn().mockResolvedValue({
            datasetType: 'roles',
            processed: 5,
            imported: 5,
            importable: 5,
            skipped: 0,
            fieldErrors: [],
            duplicateErrors: [],
            fkErrors: [],
            writeErrors: [],
            errorCount: 0,
            importedAt: '2026-08-01T00:00:00.000Z',
            mode: 'append',
            adminId: 'admin-1',
          }),
        };
      });
      const { useImportAdminGraphDataset: hook } = await import('./useAdminGraph');

      const { result } = renderHookWithProviders(() => hook());
      const file = new File(['role_id,role_name\nrole-1,Engineer'], 'roles.csv', { type: 'text/csv' });
      result.current.mutate({ datasetType: 'roles', file, options: { mode: 'append' } });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.imported).toBe(5);
      vi.doUnmock('@/lib/api/adminGraph');
    });

    it('never retries a failed import automatically (non-idempotent action)', async () => {
      vi.resetModules();
      const importSpy = vi.fn().mockRejectedValue(new Error('CSV is empty'));
      vi.doMock('@/lib/api/adminGraph', async () => {
        const actual = await vi.importActual<typeof import('@/lib/api/adminGraph')>('@/lib/api/adminGraph');
        return { ...actual, importAdminGraphDataset: importSpy };
      });
      const { useImportAdminGraphDataset: hook } = await import('./useAdminGraph');

      const { result } = renderHookWithProviders(() => hook());
      const file = new File([''], 'empty.csv', { type: 'text/csv' });
      result.current.mutate({ datasetType: 'roles', file });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(importSpy).toHaveBeenCalledTimes(1);
      vi.doUnmock('@/lib/api/adminGraph');
    });

    it('invalidates every admin-graph query on a successful import', async () => {
      let metricsHitCount = 0;
      server.use(
        http.get('/api/v1/admin/graph/metrics', () => {
          metricsHitCount += 1;
          return HttpResponse.json({ success: true, data: SAMPLE_METRICS });
        }),
      );

      vi.resetModules();
      vi.doMock('@/lib/api/adminGraph', async () => {
        const actual = await vi.importActual<typeof import('@/lib/api/adminGraph')>('@/lib/api/adminGraph');
        return {
          ...actual,
          importAdminGraphDataset: vi.fn().mockResolvedValue({
            datasetType: 'roles',
            processed: 1,
            imported: 1,
            importable: 1,
            skipped: 0,
            fieldErrors: [],
            duplicateErrors: [],
            fkErrors: [],
            writeErrors: [],
            errorCount: 0,
            importedAt: '2026-08-01T00:00:00.000Z',
            mode: 'append',
            adminId: 'admin-1',
          }),
        };
      });
      const { useImportAdminGraphDataset: importHook, useAdminGraphMetrics: metricsHook } = await import(
        './useAdminGraph'
      );
      const { renderHookWithProviders: render } = await import('@/test/renderWithProviders');

      const { result } = render(() => ({ metrics: metricsHook(), doImport: importHook() }));

      await waitFor(() => expect(result.current.metrics.isSuccess).toBe(true));
      expect(metricsHitCount).toBe(1);

      const file = new File(['role_id,role_name\nrole-1,Engineer'], 'roles.csv', { type: 'text/csv' });
      result.current.doImport.mutate({ datasetType: 'roles', file });

      await waitFor(() => expect(result.current.doImport.isSuccess).toBe(true));
      await waitFor(() => expect(metricsHitCount).toBe(2));
      vi.doUnmock('@/lib/api/adminGraph');
    });
  });
});
