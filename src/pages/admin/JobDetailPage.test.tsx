/**
 * @file src/pages/admin/JobDetailPage.test.tsx
 * @description WP-ADMIN-COMP-06 — Admin Job detail page tests.
 */

import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/renderWithProviders';
import { server } from '@/test/msw/server';
import JobDetailPage from './JobDetailPage';

const FULL_JOB = {
  id: 'job-1',
  external_id: 'ENG-1',
  title: 'Backend Engineer',
  company: 'Acme Corp',
  location: 'Bangalore',
  description: 'Build reliable systems.',
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

function renderDetail(jobId: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/jobs/:jobId" element={<JobDetailPage />} />
    </Routes>,
    { route: `/admin/jobs/${jobId}` },
  );
}

describe('JobDetailPage', () => {
  it('renders every real field from the backend', async () => {
    server.use(
      http.get('/api/v1/admin/jobs/job-1', () =>
        HttpResponse.json({ success: true, data: FULL_JOB }),
      ),
    );

    renderDetail('job-1');

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Backend Engineer' })).toBeInTheDocument());
    expect(screen.getAllByText('Acme Corp', { exact: false }).length).toBeGreaterThan(0);
    expect(screen.getByText('node')).toBeInTheDocument();
    expect(screen.getByText('postgres')).toBeInTheDocument();
    expect(screen.getByText('Build reliable systems.')).toBeInTheDocument();
  });

  it('renders "Unavailable" for null fields, never a fabricated value', async () => {
    server.use(
      http.get('/api/v1/admin/jobs/job-2', () =>
        HttpResponse.json({
          success: true,
          data: { ...FULL_JOB, id: 'job-2', experience_level: null, country: null, posted_at: null },
        }),
      ),
    );

    renderDetail('job-2');

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Backend Engineer' })).toBeInTheDocument());
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThanOrEqual(3);
  });

  it('shows an error state on API failure', async () => {
    server.use(
      http.get('/api/v1/admin/jobs/missing', () =>
        HttpResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Job not found' }, meta: { requestId: null, timestamp: new Date().toISOString() } },
          { status: 404 },
        ),
      ),
    );

    renderDetail('missing');

    await waitFor(() => expect(screen.getByText(/not found/i)).toBeInTheDocument());
  });
});
