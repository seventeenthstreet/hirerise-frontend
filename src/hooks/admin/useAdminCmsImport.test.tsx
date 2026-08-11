/**
 * @file hooks/admin/useAdminCmsImport.test.tsx
 * @description WP-ADMIN-COMP-03 — hook tests for the bulk Import mutation,
 * including the contract fix that surfaces duplicates/errors on failure.
 */

import { describe, it, expect } from 'vitest';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderHookWithProviders } from '@/test/renderWithProviders';
import { server } from '@/test/msw/server';
import { useRunAdminCmsImport } from './useAdminCmsImport';
import { extractImportResultFromError } from '@/lib/api/adminCmsImport';

describe('useRunAdminCmsImport', () => {
  it('imports rows and reports counts on full success', async () => {
    const { result } = renderHookWithProviders(() => useRunAdminCmsImport());
    result.current.mutate({ datasetType: 'skills', rows: [{ name: 'Python' }, { name: 'Go' }] });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.inserted).toBe(2);
    expect(result.current.data?.total).toBe(2);
  });

  it('surfaces duplicates/errors via error.details when the backend reports success:false (contract fix)', async () => {
    server.use(
      http.post('/api/v1/admin/cms/import', () =>
        HttpResponse.json(
          {
            success: false,
            data: { total: 1, inserted: 0, skipped: 1, insertedIds: [], duplicates: [{ name: 'Python' }], errors: [] },
            duplicates: [{ name: 'Python' }],
            errors: [],
            error: {
              code: 'CONFLICT',
              message: 'All rows were duplicates — nothing was imported.',
              details: { duplicates: [{ name: 'Python' }], errors: [] },
            },
            meta: {},
          },
          { status: 409 },
        ),
      ),
    );

    const { result } = renderHookWithProviders(() => useRunAdminCmsImport());
    result.current.mutate({ datasetType: 'skills', rows: [{ name: 'Python' }] });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.category).toBe('conflict');

    const partial = extractImportResultFromError(result.current.error);
    expect(partial?.duplicates).toEqual([{ name: 'Python' }]);
  });
});
