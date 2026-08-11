/**
 * @file src/lib/api/adminJobs.uploadCsv.test.ts
 * @description WP-ADMIN-COMP-06-R2 — unit-level coverage for
 * uploadAdminJobsCsv()'s request shape.
 *
 * Full integration through axios + MSW works for every other admin
 * endpoint in this codebase (see adminJobs's JSON-based calls, and
 * JobsPage.test.tsx / JobSyncPanel.test.tsx), but a File-bearing
 * FormData body hangs indefinitely in this project's jsdom test
 * environment specifically — a jsdom/axios body-pipeline limitation,
 * not a defect in this function (a JSON POST through the identical
 * axios+MSW path resolves normally). This test instead asserts the
 * exact request axios is asked to make — method, URL, FormData 'file'
 * field, and headers — by spying on axiosInstance.request(), which
 * exercises uploadAdminJobsCsv()'s actual logic without going through
 * the hanging network layer.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { axiosInstance } from './core/api-client';
import { uploadAdminJobsCsv } from './adminJobs';

afterEach(() => {
  vi.restoreAllMocks();
});

function makeCsvFile(name = 'jobs.csv') {
  return new File(['jobCode,title\nENG-1,Engineer'], name, { type: 'text/csv' });
}

describe('uploadAdminJobsCsv', () => {
  it('POSTs to /admin/jobs/sync/upload with the file under a "file" FormData field', async () => {
    const requestSpy = vi.spyOn(axiosInstance, 'request').mockResolvedValue({
      status: 200,
      data: { success: true, message: 'ok', data: { total: 1, success: 1, failed: 0, errors: [] } },
      headers: {},
    } as never);

    const file = makeCsvFile();
    await uploadAdminJobsCsv(file);

    expect(requestSpy).toHaveBeenCalledTimes(1);
    const call = requestSpy.mock.calls[0][0] as { method: string; url: string; data: FormData; headers?: Record<string, string> };

    expect(call.method).toBe('POST');
    expect(call.url).toBe('/api/v1/admin/jobs/sync/upload');
    expect(call.data).toBeInstanceOf(FormData);
    expect(call.data.get('file')).toBe(file);
    // Content-Type must be `undefined`, NOT a manually-set 'multipart/form-data'
    // string — the browser needs to generate the header itself (with the
    // required boundary= parameter) when given a FormData body. apiRequest()
    // clears the axios instance's default 'application/json' for exactly
    // this reason. See api-client.ts (apiRequest) for the full explanation.
    expect(call.headers?.['Content-Type']).toBeUndefined();
  });

  it('includes delimiter/skipHeader as extra form fields when options are given', async () => {
    const requestSpy = vi.spyOn(axiosInstance, 'request').mockResolvedValue({
      status: 200,
      data: { success: true, message: 'ok', data: { total: 0, success: 0, failed: 0, errors: [] } },
      headers: {},
    } as never);

    await uploadAdminJobsCsv(makeCsvFile(), { delimiter: ';', skipHeader: false });

    const call = requestSpy.mock.calls[0][0] as { data: FormData };
    expect(call.data.get('delimiter')).toBe(';');
    expect(call.data.get('skipHeader')).toBe('false');
  });

  it('omits delimiter/skipHeader form fields when no options are given', async () => {
    const requestSpy = vi.spyOn(axiosInstance, 'request').mockResolvedValue({
      status: 200,
      data: { success: true, message: 'ok', data: { total: 0, success: 0, failed: 0, errors: [] } },
      headers: {},
    } as never);

    await uploadAdminJobsCsv(makeCsvFile());

    const call = requestSpy.mock.calls[0][0] as { data: FormData };
    expect(call.data.get('delimiter')).toBeNull();
    expect(call.data.get('skipHeader')).toBeNull();
  });
});
