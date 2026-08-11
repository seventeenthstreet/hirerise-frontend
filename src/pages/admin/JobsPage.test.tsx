/**
 * @file src/pages/admin/JobsPage.test.tsx
 * @description WP-ADMIN-COMP-06 — Admin Jobs list page tests.
 */

import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/renderWithProviders';
import { server } from '@/test/msw/server';
import type { AdminJob } from '@/lib/api/adminJobs';
import JobsPage from './JobsPage';

const SAMPLE_JOB: AdminJob = {
  id: 'job-1',
  external_id: 'ENG-1',
  title: 'Backend Engineer',
  company: 'Acme Corp',
  location: 'Bangalore',
  description: null,
  skills: [],
  experience_level: null,
  salary_min: 800000,
  salary_max: 1200000,
  salary_currency: 'INR',
  contract_type: 'full_time',
  redirect_url: null,
  source: 'json',
  country: 'IN',
  posted_at: null,
  fetched_at: '2026-08-05T00:00:00.000Z',
  created_at: '2026-08-05T00:00:00.000Z',
};

function mockJobsDependencies({
  jobs = [SAMPLE_JOB],
  total,
  syncStatus = 'idle',
}: { jobs?: AdminJob[]; total?: number; syncStatus?: 'idle' | 'running' } = {}) {
  const resolvedTotal = total ?? jobs.length;
  server.use(
    http.get('/api/v1/admin/jobs', () =>
      HttpResponse.json({ success: true, data: { items: jobs, total: resolvedTotal } }),
    ),
    http.get('/api/v1/admin/jobs/sync/status', () =>
      HttpResponse.json({
        success: true,
        data: { lock_id: 'jobSync', status: syncStatus, locked_by: null, locked_at: null, released_at: null },
      }),
    ),
    http.get('/api/v1/admin/jobs/sync/logs', () =>
      HttpResponse.json({ success: true, data: { items: [] } }),
    ),
  );
}

describe('JobsPage', () => {
  it('renders the job list from the real backend, not fabricated rows', async () => {
    mockJobsDependencies();
    renderWithProviders(<JobsPage />);

    await waitFor(() => expect(screen.getByText('Backend Engineer')).toBeInTheDocument());
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('shows an empty state when there are no jobs', async () => {
    mockJobsDependencies({ jobs: [], total: 0 });
    renderWithProviders(<JobsPage />);

    await waitFor(() => expect(screen.getByText(/no jobs/i)).toBeInTheDocument());
  });

  it('shows accurate ingestion-based empty-state copy, not a manual-creation prompt', async () => {
    mockJobsDependencies({ jobs: [], total: 0 });
    renderWithProviders(<JobsPage />);

    await waitFor(() =>
      expect(screen.getByText('No jobs have been ingested yet.')).toBeInTheDocument(),
    );
    expect(screen.getByText('Use Trigger Sync below to import job listings.')).toBeInTheDocument();

    // Regression guard: jobs are read-only, so the empty state must never
    // imply manual creation is possible.
    expect(screen.queryByText(/creating the first one/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create/i })).not.toBeInTheDocument();
  });

  it('renders the Trigger Sync panel', async () => {
    mockJobsDependencies();
    renderWithProviders(<JobsPage />);

    expect(await screen.findByRole('heading', { name: 'Trigger Sync' })).toBeInTheDocument();
    expect(screen.getByLabelText('Source URL')).toBeInTheDocument();
  });

  it('disables Trigger Sync while a sync is already running', async () => {
    mockJobsDependencies({ syncStatus: 'running' });
    renderWithProviders(<JobsPage />);

    const button = await screen.findByRole('button', { name: /sync already running/i });
    expect(button).toBeDisabled();
  });

  it('shows an error state on API failure, never falling back to fabricated rows', async () => {
    server.use(
      http.get('/api/v1/admin/jobs', () =>
        HttpResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'bad request' }, meta: { requestId: null, timestamp: new Date().toISOString() } },
          { status: 400 },
        ),
      ),
      http.get('/api/v1/admin/jobs/sync/status', () =>
        HttpResponse.json({
          success: true,
          data: { lock_id: 'jobSync', status: 'idle', locked_by: null, locked_at: null, released_at: null },
        }),
      ),
      http.get('/api/v1/admin/jobs/sync/logs', () =>
        HttpResponse.json({ success: true, data: { items: [] } }),
      ),
    );

    renderWithProviders(<JobsPage />);

    await waitFor(() => expect(screen.getByText(/invalid request/i)).toBeInTheDocument());
  });
});
