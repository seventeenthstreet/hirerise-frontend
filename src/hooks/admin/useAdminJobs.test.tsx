/**
 * @file hooks/admin/useAdminJobs.test.tsx
 * @description WP-ADMIN-COMP-06 — hook tests for the Admin Jobs module.
 */

import { describe, it, expect } from 'vitest';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderHookWithProviders } from '@/test/renderWithProviders';
import { server } from '@/test/msw/server';
import {
  useAdminJobsList,
  useAdminJobDetail,
  useAdminJobSyncStatus,
  useAdminJobSyncLogs,
  useTriggerAdminJobSync,
} from './useAdminJobs';

const SAMPLE_JOB = {
  id: 'job-1',
  external_id: 'ENG-1',
  title: 'Backend Engineer',
  company: 'Acme Corp',
  location: 'Bangalore',
  description: 'Build things',
  skills: ['node', 'postgres'],
  experience_level: 'mid',
  salary_min: 800000,
  salary_max: 1200000,
  salary_currency: 'INR',
  contract_type: 'full_time',
  redirect_url: 'https://example.com/jobs/1',
  source: 'json',
  country: 'IN',
  posted_at: '2026-08-01T00:00:00.000Z',
  fetched_at: '2026-08-05T00:00:00.000Z',
  created_at: '2026-08-05T00:00:00.000Z',
};

describe('useAdminJobs', () => {
  describe('useAdminJobsList', () => {
    it('returns items and total from GET /api/v1/admin/jobs', async () => {
      server.use(
        http.get('/api/v1/admin/jobs', () =>
          HttpResponse.json({ success: true, data: { items: [SAMPLE_JOB], total: 1 } }),
        ),
      );

      const { result } = renderHookWithProviders(() => useAdminJobsList({ limit: 20, offset: 0 }));

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ items: [SAMPLE_JOB], total: 1 });
    });

    it('surfaces an error without fabricating data', async () => {
      server.use(
        http.get('/api/v1/admin/jobs', () =>
          HttpResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'bad request' }, meta: { requestId: null, timestamp: new Date().toISOString() } },
            { status: 400 },
          ),
        ),
      );

      const { result } = renderHookWithProviders(() => useAdminJobsList({ limit: 20, offset: 0 }));

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.data).toBeUndefined();
    });
  });

  describe('useAdminJobDetail', () => {
    it('is disabled until a jobId is provided', () => {
      const { result } = renderHookWithProviders(() => useAdminJobDetail(null));
      expect(result.current.fetchStatus).toBe('idle');
    });

    it('fetches a single job by id', async () => {
      server.use(
        http.get('/api/v1/admin/jobs/job-1', () =>
          HttpResponse.json({ success: true, data: SAMPLE_JOB }),
        ),
      );

      const { result } = renderHookWithProviders(() => useAdminJobDetail('job-1'));
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(SAMPLE_JOB);
    });
  });

  describe('useAdminJobSyncStatus', () => {
    it('returns the current lock state', async () => {
      server.use(
        http.get('/api/v1/admin/jobs/sync/status', () =>
          HttpResponse.json({
            success: true,
            data: { lock_id: 'jobSync', status: 'idle', locked_by: null, locked_at: null, released_at: null },
          }),
        ),
      );

      const { result } = renderHookWithProviders(() => useAdminJobSyncStatus());
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.status).toBe('idle');
    });
  });

  describe('useAdminJobSyncLogs', () => {
    it('returns recent sync history', async () => {
      server.use(
        http.get('/api/v1/admin/jobs/sync/logs', () =>
          HttpResponse.json({
            success: true,
            data: { items: [{ id: 'log-1', type: 'job_sync', source_type: 'json', source_origin: null, total_records: 10, success_count: 9, fail_count: 1, success_rate: 0.9, duration_ms: 1200, initiated_by: 'admin-1', created_at: '2026-08-05T00:00:00.000Z' }] },
          }),
        ),
      );

      const { result } = renderHookWithProviders(() => useAdminJobSyncLogs(5));
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.items).toHaveLength(1);
    });
  });

  describe('useTriggerAdminJobSync', () => {
    it('posts to /sync and returns the sync result', async () => {
      server.use(
        http.post('/api/v1/admin/jobs/sync', () =>
          HttpResponse.json({ success: true, data: { total: 3, success: 3, failed: 0, errors: [] } }),
        ),
      );

      const { result } = renderHookWithProviders(() => useTriggerAdminJobSync());
      result.current.mutate({ sourceType: 'json', sourceUrl: 'https://example.com/jobs.json' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ total: 3, success: 3, failed: 0, errors: [] });
    });

    it('never retries a failed sync automatically (non-idempotent action)', async () => {
      let hitCount = 0;
      server.use(
        http.post('/api/v1/admin/jobs/sync', () => {
          hitCount += 1;
          return HttpResponse.json(
            { success: false, error: { code: 'CONFLICT', message: 'Sync already running' }, meta: { requestId: null, timestamp: new Date().toISOString() } },
            { status: 409 },
          );
        }),
      );

      const { result } = renderHookWithProviders(() => useTriggerAdminJobSync());
      result.current.mutate({ sourceType: 'json', sourceUrl: 'https://example.com/jobs.json' });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(hitCount).toBe(1);
    });
  });
});
