/**
 * @file src/pages/admin/GraphImportPanel.test.tsx
 * @description WP-ADMIN-COMP-08 — CSV Import / Import History panel tests.
 *
 * Follows the same module-mocking pattern as JobSyncPanel.test.tsx: a
 * File-bearing FormData body hangs indefinitely through axios+MSW in this
 * project's jsdom test environment, so submission is exercised by mocking
 * '@/lib/api/adminGraph' at the module boundary rather than a real
 * multipart round trip. The actual request shape is covered separately in
 * lib/api/adminGraph.import.test.ts.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/renderWithProviders';
import { server } from '@/test/msw/server';
import { useAdminGraphImportLogs } from '@/hooks/admin/useAdminGraph';
import { GraphImportPanel } from './GraphImportPanel';

vi.mock('@/lib/api/adminGraph', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/adminGraph')>('@/lib/api/adminGraph');
  return { ...actual, importAdminGraphDataset: vi.fn(), previewAdminGraphDataset: vi.fn() };
});
import { importAdminGraphDataset, previewAdminGraphDataset } from '@/lib/api/adminGraph';

function mockImportLogs(logs: unknown[] = []) {
  server.use(
    http.get('/api/v1/admin/graph/import-logs', () =>
      HttpResponse.json({ success: true, data: { logs, count: logs.length } }),
    ),
  );
}

/** Thin wrapper so GraphImportPanel gets a real query result, same shape GraphPage passes it. */
function PanelHarness() {
  const importLogs = useAdminGraphImportLogs(20);
  return <GraphImportPanel importLogs={importLogs} />;
}

function makeCsvFile(name = 'roles.csv', content = 'role_id,role_name\nrole-1,Engineer') {
  return new File([content], name, { type: 'text/csv' });
}

describe('GraphImportPanel', () => {
  it('renders a dataset selector covering all real GRAPH_DATASET_TYPES', async () => {
    mockImportLogs();
    renderWithProviders(<PanelHarness />);

    const select = screen.getByLabelText('Dataset') as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toEqual([
      'roles', 'skills', 'role_skills', 'role_transitions',
      'skill_relationships', 'role_education', 'role_salary_market', 'role_market_demand',
    ]);
  });

  it('shows no file selected and disabled actions before a file is chosen', () => {
    mockImportLogs();
    renderWithProviders(<PanelHarness />);

    expect(screen.getByText('No file selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('rejects a non-.csv file client-side and keeps actions disabled', async () => {
    mockImportLogs();
    renderWithProviders(<PanelHarness />);

    const fileInput = document.getElementById('graph-csv-file') as HTMLInputElement;
    const badFile = new File(['not a csv'], 'roles.txt', { type: 'text/plain' });
    Object.defineProperty(fileInput, 'files', { value: [badFile], configurable: true });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    expect(await screen.findByText('Only .csv files are accepted.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
    expect(importAdminGraphDataset).not.toHaveBeenCalled();
  });

  it('enables Preview and Import once a valid .csv file is chosen', async () => {
    const user = userEvent.setup();
    mockImportLogs();
    renderWithProviders(<PanelHarness />);

    await user.upload(document.getElementById('graph-csv-file') as HTMLInputElement, makeCsvFile());

    expect(await screen.findByText(/Selected file: roles\.csv/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preview' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled();
  });

  it('runs a preview and shows the field/duplicate/FK error summary without writing anything', async () => {
    const user = userEvent.setup();
    mockImportLogs();
    vi.mocked(previewAdminGraphDataset).mockResolvedValue({
      datasetType: 'roles',
      processed: 5,
      importable: 3,
      fieldErrors: [{ row: 2, field: 'role_name', type: 'field', message: 'is required' }],
      duplicateErrors: [],
      fkErrors: [{ row: 4, field: 'role_family', type: 'fk', message: 'not found' }],
      errorCount: 2,
      preview: [],
    });

    renderWithProviders(<PanelHarness />);
    await user.upload(document.getElementById('graph-csv-file') as HTMLInputElement, makeCsvFile());
    await user.click(screen.getByRole('button', { name: 'Preview' }));

    await waitFor(() =>
      expect(screen.getByText(/5 row\(s\) processed — 3 importable, 2 error\(s\)\./)).toBeInTheDocument(),
    );
    expect(screen.getByText(/Row 2 \(role_name\): is required/)).toBeInTheDocument();
    expect(screen.getByText(/Row 4 \(role_family\): not found/)).toBeInTheDocument();
    expect(importAdminGraphDataset).not.toHaveBeenCalled();
  });

  it('submits a full import and shows the processed/imported/skipped result', async () => {
    const user = userEvent.setup();
    mockImportLogs();
    vi.mocked(importAdminGraphDataset).mockResolvedValue({
      datasetType: 'roles',
      processed: 10,
      imported: 9,
      importable: 9,
      skipped: 1,
      fieldErrors: [],
      duplicateErrors: [],
      fkErrors: [],
      writeErrors: [],
      errorCount: 0,
      importedAt: '2026-08-01T00:00:00.000Z',
      mode: 'append',
      adminId: 'admin-1',
    });

    renderWithProviders(<PanelHarness />);
    await user.upload(document.getElementById('graph-csv-file') as HTMLInputElement, makeCsvFile());
    await user.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(() =>
      expect(screen.getByText(/10 row\(s\) processed — 9 imported, 1 skipped\./)).toBeInTheDocument(),
    );
    const [, calledFile] = vi.mocked(importAdminGraphDataset).mock.calls[0];
    expect(calledFile.name).toBe('roles.csv');
  });

  it('shows a partial-success result with error details for a partially-failed import', async () => {
    const user = userEvent.setup();
    mockImportLogs();
    vi.mocked(importAdminGraphDataset).mockResolvedValue({
      datasetType: 'role_transitions',
      processed: 4,
      imported: 2,
      importable: 2,
      skipped: 2,
      fieldErrors: [],
      duplicateErrors: [{ row: 3, field: 'from_role_id', type: 'duplicate', message: 'duplicate in file' }],
      fkErrors: [{ row: 4, field: 'to_role_id', type: 'fk', message: 'role not found' }],
      writeErrors: [],
      errorCount: 2,
      importedAt: '2026-08-01T00:00:00.000Z',
      mode: 'append',
      adminId: 'admin-1',
    });

    renderWithProviders(<PanelHarness />);
    await user.upload(document.getElementById('graph-csv-file') as HTMLInputElement, makeCsvFile());
    await user.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(() =>
      expect(screen.getByText(/4 row\(s\) processed — 2 imported, 2 skipped, 2 error\(s\)\./)).toBeInTheDocument(),
    );
    expect(screen.getByText(/Row 3 \(from_role_id\): duplicate in file/)).toBeInTheDocument();
    expect(screen.getByText(/Row 4 \(to_role_id\): role not found/)).toBeInTheDocument();
  });

  it('shows an error state when the import call fails, without fabricating a success result', async () => {
    const user = userEvent.setup();
    mockImportLogs();
    vi.mocked(importAdminGraphDataset).mockRejectedValue(new Error('Import failed. Please try again.'));

    renderWithProviders(<PanelHarness />);
    await user.upload(document.getElementById('graph-csv-file') as HTMLInputElement, makeCsvFile());
    await user.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(() => expect(screen.getByText('Import failed. Please try again.')).toBeInTheDocument());
    expect(screen.queryByText(/imported\./)).not.toBeInTheDocument();
  });

  it('resets file selection and results when Reset is clicked', async () => {
    const user = userEvent.setup();
    mockImportLogs();
    vi.mocked(previewAdminGraphDataset).mockResolvedValue({
      datasetType: 'roles', processed: 1, importable: 1, fieldErrors: [], duplicateErrors: [], fkErrors: [], errorCount: 0, preview: [],
    });

    renderWithProviders(<PanelHarness />);
    await user.upload(document.getElementById('graph-csv-file') as HTMLInputElement, makeCsvFile());
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() => expect(screen.getByText(/1 row\(s\) processed/)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Reset' }));

    expect(screen.getByText('No file selected')).toBeInTheDocument();
    expect(screen.queryByText(/1 row\(s\) processed/)).not.toBeInTheDocument();
  });

  describe('Import History', () => {
    it('shows a loading state before history arrives', () => {
      mockImportLogs();
      renderWithProviders(<PanelHarness />);
      expect(screen.getByText('Loading import history…')).toBeInTheDocument();
    });

    it('shows an empty state when no imports have been run', async () => {
      mockImportLogs([]);
      renderWithProviders(<PanelHarness />);
      await waitFor(() => expect(screen.getByText('No imports have been run yet.')).toBeInTheDocument());
    });

    it('renders populated import history from the real backend', async () => {
      mockImportLogs([
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
          fk_errors: 0,
          duration_ms: 850,
          import_mode: 'append',
        },
      ]);
      renderWithProviders(<PanelHarness />);
      await waitFor(() => expect(screen.getByText(/98\/100 imported, 2 skipped/)).toBeInTheDocument());
      expect(screen.getAllByText('Roles').length).toBeGreaterThan(0);
    });

    it('shows an error state when history fails to load', async () => {
      server.use(
        http.get('/api/v1/admin/graph/import-logs', () =>
          HttpResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'unavailable' }, meta: { requestId: null, timestamp: new Date().toISOString() } },
            { status: 400 },
          ),
        ),
      );
      renderWithProviders(<PanelHarness />);
      await waitFor(() => expect(screen.getByText('Unable to load import history.')).toBeInTheDocument());
    });
  });
});
