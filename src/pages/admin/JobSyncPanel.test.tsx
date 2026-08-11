/**
 * @file src/pages/admin/JobSyncPanel.test.tsx
 * @description WP-ADMIN-COMP-06-R2 — CSV File Upload source-type tests.
 *
 * Covers the new "CSV File Upload" option added to the Trigger Sync
 * panel: switching into upload mode swaps the Source URL field for a
 * file picker, submits via POST /admin/jobs/sync/upload, and renders
 * the shared "N jobs processed / M imported / K failed" result — while
 * the pre-existing URL-based Google Sheets/CSV/JSON flow (POST
 * /admin/jobs/sync) keeps working exactly as before.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/renderWithProviders';
import { server } from '@/test/msw/server';
import type { JobSyncStatus, ListJobSyncLogsResponse } from '@/lib/api/adminJobs';
import { JobSyncPanel } from './JobSyncPanel';
import { useAdminJobSyncStatus, useAdminJobSyncLogs } from '@/hooks/admin/useAdminJobs';

// WP-ADMIN-COMP-06-R2: submission tests mock uploadAdminJobsCsv at the
// API-client boundary rather than exercising a real FormData/File body
// through axios + MSW. jsdom's XHR/fetch body pipeline hangs indefinitely
// on a File-bearing FormData body in this test environment (confirmed:
// the identical axios+MSW path resolves instantly for a JSON POST body —
// see triggerAdminJobSync tests below — so this is a jsdom body-pipeline
// limitation, not a defect in uploadAdminJobsCsv or JobSyncPanel). The
// panel's actual request wiring (FormData with a 'file' field,
// multipart/form-data header) is covered directly in
// lib/api/adminJobs.test.ts against a real fetch call outside axios/jsdom's
// XHR layer; these tests cover the *panel's* behavior: what it renders,
// what it calls, and with what arguments.
vi.mock('@/lib/api/adminJobs', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/adminJobs')>('@/lib/api/adminJobs');
  return { ...actual, uploadAdminJobsCsv: vi.fn() };
});
import { uploadAdminJobsCsv } from '@/lib/api/adminJobs';

const IDLE_STATUS: JobSyncStatus = {
  lock_id: 'jobSync',
  status: 'idle',
  locked_by: null,
  locked_at: null,
  released_at: null,
};

const EMPTY_LOGS: ListJobSyncLogsResponse = { items: [] };

function mockSyncDependencies() {
  server.use(
    http.get('/api/v1/admin/jobs/sync/status', () =>
      HttpResponse.json({ success: true, data: IDLE_STATUS }),
    ),
    http.get('/api/v1/admin/jobs/sync/logs', () =>
      HttpResponse.json({ success: true, data: EMPTY_LOGS }),
    ),
  );
}

/** Thin wrapper so JobSyncPanel gets real query results, same shape JobsPage passes it. */
function PanelHarness() {
  const syncStatus = useAdminJobSyncStatus();
  const syncLogs = useAdminJobSyncLogs();
  return <JobSyncPanel syncStatus={syncStatus} syncLogs={syncLogs} />;
}

function makeCsvFile(name = 'jobs.csv', content = 'jobCode,title\nENG-1,Engineer') {
  return new File([content], name, { type: 'text/csv' });
}

describe('JobSyncPanel — CSV File Upload (WP-ADMIN-COMP-06-R2)', () => {
  it('defaults to a URL source with the Source URL field visible, no file picker', async () => {
    mockSyncDependencies();
    renderWithProviders(<PanelHarness />);

    expect(await screen.findByLabelText('Source URL')).toBeInTheDocument();
    expect(screen.queryByText('Choose CSV File')).not.toBeInTheDocument();
  });

  it('swaps Source URL for a file picker when CSV File Upload is selected, and preserves the other URL options', async () => {
    const user = userEvent.setup();
    mockSyncDependencies();
    renderWithProviders(<PanelHarness />);

    const select = await screen.findByLabelText('Source type');
    // Existing URL-based options must still be present, untouched.
    expect(within(select).getByRole('option', { name: 'Google Sheets (published CSV link)' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: 'CSV URL' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: 'JSON URL' })).toBeInTheDocument();

    await user.selectOptions(select, 'CSV File Upload');

    expect(screen.queryByLabelText('Source URL')).not.toBeInTheDocument();
    expect(screen.getByText('Choose CSV File')).toBeInTheDocument();
    expect(screen.getByText('No file selected')).toBeInTheDocument();
  });

  it('shows the selected filename and enables Import CSV once a .csv file is chosen', async () => {
    const user = userEvent.setup();
    mockSyncDependencies();
    renderWithProviders(<PanelHarness />);

    await user.selectOptions(await screen.findByLabelText('Source type'), 'CSV File Upload');

    const fileInput = document.getElementById('sync-csv-file') as HTMLInputElement;
    await user.upload(fileInput, makeCsvFile('roles-export.csv'));

    expect(await screen.findByText(/Selected file: roles-export\.csv/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import CSV' })).toBeEnabled();
  });

  it('rejects a non-.csv file client-side and keeps Import CSV disabled', async () => {
    mockSyncDependencies();
    renderWithProviders(<PanelHarness />);

    const user = userEvent.setup();
    await user.selectOptions(await screen.findByLabelText('Source type'), 'CSV File Upload');

    const fileInput = document.getElementById('sync-csv-file') as HTMLInputElement;
    const badFile = new File(['not a csv'], 'roles.txt', { type: 'text/plain' });

    // Bypassing user-event's native accept-attribute filtering: a real OS
    // file dialog restricted by accept=".csv" wouldn't offer a .txt file
    // in the first place, but this exercises the client-side JS
    // validateCsvFile() defense-in-depth check directly (per the "Do not
    // rely exclusively on browser validation" requirement), covering the
    // path where accept-filtering is bypassed (e.g. drag-and-drop).
    Object.defineProperty(fileInput, 'files', { value: [badFile], configurable: true });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    expect(await screen.findByText('Only .csv files are accepted.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import CSV' })).toBeDisabled();
    expect(uploadAdminJobsCsv).not.toHaveBeenCalled();
  });

  it('submits the file via uploadAdminJobsCsv and shows the processed/imported/failed result', async () => {
    const user = userEvent.setup();
    mockSyncDependencies();
    vi.mocked(uploadAdminJobsCsv).mockResolvedValue({
      total: 10, success: 9, failed: 1, errors: [{ jobCode: 'ENG-2', message: 'title is required' }],
    });

    renderWithProviders(<PanelHarness />);

    await user.selectOptions(await screen.findByLabelText('Source type'), 'CSV File Upload');
    await user.upload(document.getElementById('sync-csv-file') as HTMLInputElement, makeCsvFile());
    await user.click(screen.getByRole('button', { name: 'Import CSV' }));

    await waitFor(() =>
      expect(screen.getByText(/10 jobs processed — 9 imported, 1 failed\./)).toBeInTheDocument(),
    );
    expect(screen.getByText(/ENG-2: title is required/)).toBeInTheDocument();
    const [uploadedFile] = vi.mocked(uploadAdminJobsCsv).mock.calls[0];
    expect(uploadedFile.name).toBe('jobs.csv');
  });

  it('does not call the URL-sync endpoint for CSV uploads — the two modes stay independent', async () => {
    const user = userEvent.setup();
    mockSyncDependencies();
    vi.mocked(uploadAdminJobsCsv).mockResolvedValue({ total: 1, success: 1, failed: 0, errors: [] });

    let urlSyncCalled = false;
    server.use(
      http.post('/api/v1/admin/jobs/sync', () => {
        urlSyncCalled = true;
        return HttpResponse.json({ success: true, message: 'ok', data: { total: 0, success: 0, failed: 0, errors: [] } });
      }),
    );

    renderWithProviders(<PanelHarness />);

    await user.selectOptions(await screen.findByLabelText('Source type'), 'CSV File Upload');
    await user.upload(document.getElementById('sync-csv-file') as HTMLInputElement, makeCsvFile());
    await user.click(screen.getByRole('button', { name: 'Import CSV' }));

    await waitFor(() => expect(screen.getByText(/1 jobs processed — 1 imported\./)).toBeInTheDocument());
    expect(urlSyncCalled).toBe(false);
  });

  it('still submits URL-based syncs via POST /admin/jobs/sync when a URL source type is selected', async () => {
    const user = userEvent.setup();
    mockSyncDependencies();

    server.use(
      http.post('/api/v1/admin/jobs/sync', () =>
        HttpResponse.json({ success: true, message: 'ok', data: { total: 2, success: 2, failed: 0, errors: [] } }),
      ),
    );

    renderWithProviders(<PanelHarness />);

    await user.type(await screen.findByLabelText('Source URL'), 'https://example.com/jobs.json');
    await user.click(screen.getByRole('button', { name: 'Trigger Sync' }));

    await waitFor(() => expect(screen.getByText(/2 jobs processed — 2 imported\./)).toBeInTheDocument());
    expect(uploadAdminJobsCsv).not.toHaveBeenCalled();
  });

  it('clears a previously selected file when switching back to a URL source', async () => {
    const user = userEvent.setup();
    mockSyncDependencies();
    renderWithProviders(<PanelHarness />);

    const select = await screen.findByLabelText('Source type');
    await user.selectOptions(select, 'CSV File Upload');
    await user.upload(document.getElementById('sync-csv-file') as HTMLInputElement, makeCsvFile());
    expect(await screen.findByText(/Selected file: jobs\.csv/)).toBeInTheDocument();

    await user.selectOptions(select, 'JSON URL');
    await user.selectOptions(select, 'CSV File Upload');

    expect(screen.getByText('No file selected')).toBeInTheDocument();
  });
});
