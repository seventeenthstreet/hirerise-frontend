/**
 * @file src/lib/api/adminGraph.import.test.ts
 * @description WP-ADMIN-COMP-08 — unit-level coverage for
 * importAdminGraphDataset()/previewAdminGraphDataset()'s request shape.
 *
 * Same rationale as adminJobs.uploadCsv.test.ts: a File-bearing FormData
 * body hangs indefinitely through axios+MSW in this project's jsdom test
 * environment. This spies on axiosInstance.request() directly instead,
 * which exercises the functions' actual logic without the hanging network
 * layer.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { axiosInstance } from './core/api-client';
import { importAdminGraphDataset, previewAdminGraphDataset } from './adminGraph';

afterEach(() => {
  vi.restoreAllMocks();
});

function makeCsvFile(name = 'roles.csv') {
  return new File(['role_id,role_name\nrole-1,Engineer'], name, { type: 'text/csv' });
}

describe('importAdminGraphDataset', () => {
  it('POSTs to /admin/graph/import/:datasetType with the file under a "file" FormData field', async () => {
    const requestSpy = vi.spyOn(axiosInstance, 'request').mockResolvedValue({
      status: 200,
      data: {
        success: true,
        data: {
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
        },
      },
      headers: {},
    } as never);

    const file = makeCsvFile();
    await importAdminGraphDataset('roles', file);

    expect(requestSpy).toHaveBeenCalledTimes(1);
    const call = requestSpy.mock.calls[0][0] as { method: string; url: string; data: FormData; headers?: Record<string, string> };

    expect(call.method).toBe('POST');
    expect(call.url).toBe('/api/v1/admin/graph/import/roles');
    expect(call.data).toBeInstanceOf(FormData);
    expect(call.data.get('file')).toBe(file);
    // Content-Type must be `undefined` so the browser sets its own
    // multipart boundary — see api-client.ts (apiRequest) for why, and the
    // identical assertion in adminJobs.uploadCsv.test.ts.
    expect(call.headers?.['Content-Type']).toBeUndefined();
  });

  it('includes mode as an extra form field when provided', async () => {
    const requestSpy = vi.spyOn(axiosInstance, 'request').mockResolvedValue({
      status: 200,
      data: { success: true, data: { datasetType: 'roles', processed: 0, imported: 0, importable: 0, skipped: 0, fieldErrors: [], duplicateErrors: [], fkErrors: [], writeErrors: [], errorCount: 0, importedAt: '2026-08-01T00:00:00.000Z', mode: 'replace', adminId: 'admin-1' } },
      headers: {},
    } as never);

    await importAdminGraphDataset('roles', makeCsvFile(), { mode: 'replace' });

    const call = requestSpy.mock.calls[0][0] as { data: FormData };
    expect(call.data.get('mode')).toBe('replace');
  });

  it('omits the mode form field when no options are given', async () => {
    const requestSpy = vi.spyOn(axiosInstance, 'request').mockResolvedValue({
      status: 200,
      data: { success: true, data: { datasetType: 'roles', processed: 0, imported: 0, importable: 0, skipped: 0, fieldErrors: [], duplicateErrors: [], fkErrors: [], writeErrors: [], errorCount: 0, importedAt: '2026-08-01T00:00:00.000Z', mode: 'append', adminId: 'admin-1' } },
      headers: {},
    } as never);

    await importAdminGraphDataset('roles', makeCsvFile());

    const call = requestSpy.mock.calls[0][0] as { data: FormData };
    expect(call.data.get('mode')).toBeNull();
  });
});

describe('previewAdminGraphDataset', () => {
  it('POSTs to /admin/graph/preview/:datasetType with the file under a "file" FormData field', async () => {
    const requestSpy = vi.spyOn(axiosInstance, 'request').mockResolvedValue({
      status: 200,
      data: {
        success: true,
        data: {
          datasetType: 'roles',
          processed: 1,
          importable: 1,
          fieldErrors: [],
          duplicateErrors: [],
          fkErrors: [],
          errorCount: 0,
          preview: [],
        },
      },
      headers: {},
    } as never);

    const file = makeCsvFile();
    await previewAdminGraphDataset('roles', file);

    expect(requestSpy).toHaveBeenCalledTimes(1);
    const call = requestSpy.mock.calls[0][0] as { method: string; url: string; data: FormData };
    expect(call.method).toBe('POST');
    expect(call.url).toBe('/api/v1/admin/graph/preview/roles');
    expect(call.data.get('file')).toBe(file);
  });
});
