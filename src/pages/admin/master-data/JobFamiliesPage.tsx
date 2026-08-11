/**
 * pages/admin/master-data/JobFamiliesPage.tsx
 * WP-ADMIN-COMP-03 — CMS Job Families Management. Same generic-factory shape
 * as Skill Clusters, minus the domainId relationship.
 */

import { useMemo, useState } from 'react';
import {
  MasterDataTable,
  MasterDataToolbar,
  MasterDataDrawer,
  MasterDataForm,
  MasterDataDeleteDialog,
  MasterDataEmptyState,
  MasterDataErrorState,
  MasterDataStatusBanner,
  type MasterDataRowAction,
  type MasterDataStatus,
  type MasterDataFieldErrors,
} from '@/components/master-data';
import { PageShell } from '@/components/ui';
import { isApiClientError } from '@/lib/api/core';
import type { AdminJobFamily } from '@/lib/api/adminCmsJobFamilies';
import {
  useAdminJobFamiliesList,
  useCreateAdminJobFamily,
  useUpdateAdminJobFamily,
  useDeleteAdminJobFamily,
} from '@/hooks/admin/useAdminCmsJobFamilies';
import {
  JOB_FAMILY_COLUMNS,
  JOB_FAMILY_FIELDS,
  EMPTY_JOB_FAMILY_FORM_VALUES,
  jobFamilyToFormValues,
  type JobFamilyFormValues,
} from './job-families.config';

const LIST_LIMIT = 100;

type DrawerMode = { kind: 'create' } | { kind: 'edit'; jobFamily: AdminJobFamily } | null;

export default function JobFamiliesPage() {
  const [filterText, setFilterText] = useState('');
  const [drawer, setDrawer] = useState<DrawerMode>(null);
  const [pendingArchive, setPendingArchive] = useState<AdminJobFamily | null>(null);
  const [status, setStatus] = useState<MasterDataStatus | null>(null);
  const [fieldErrors, setFieldErrors] = useState<MasterDataFieldErrors>({});

  const { data, isLoading, isFetching, isError, error, refetch } = useAdminJobFamiliesList({ limit: LIST_LIMIT });
  const createMutation = useCreateAdminJobFamily();
  const updateMutation = useUpdateAdminJobFamily();
  const deleteMutation = useDeleteAdminJobFamily();

  const allItems = data?.items ?? [];
  const items = useMemo(() => {
    if (!filterText.trim()) return allItems;
    const needle = filterText.trim().toLowerCase();
    return allItems.filter((i) => i.name.toLowerCase().includes(needle));
  }, [allItems, filterText]);

  function openCreate() { setFieldErrors({}); setDrawer({ kind: 'create' }); }
  function openEdit(jf: AdminJobFamily) { setFieldErrors({}); setDrawer({ kind: 'edit', jobFamily: jf }); }
  function closeDrawer() { setDrawer(null); setFieldErrors({}); }

  function extractFieldErrors(err: unknown): MasterDataFieldErrors {
    if (!isApiClientError(err) || err.category !== 'validation') return {};
    const fields = (err.details?.fields as { field: string; message: string }[] | undefined) ?? [];
    return Object.fromEntries(fields.map((f) => [f.field, f.message]));
  }

  function handleSubmit(values: JobFamilyFormValues) {
    const payload = { name: values.name.trim(), description: values.description || undefined };

    if (drawer?.kind === 'create') {
      createMutation.mutate(payload, {
        onSuccess: () => { setStatus({ kind: 'success', message: `"${payload.name}" was created.` }); closeDrawer(); },
        onError: (err) => {
          setFieldErrors(extractFieldErrors(err));
          const message = isApiClientError(err) && err.category === 'conflict'
            ? `A job family named "${payload.name}" already exists.`
            : isApiClientError(err) && err.category === 'validation'
              ? 'Please fix the highlighted fields.'
              : 'Could not create the job family. Please try again.';
          setStatus({ kind: 'error', message });
        },
      });
    } else if (drawer?.kind === 'edit') {
      updateMutation.mutate({ id: drawer.jobFamily.id, input: payload }, {
        onSuccess: () => { setStatus({ kind: 'success', message: `"${payload.name}" was updated.` }); closeDrawer(); },
        onError: (err) => {
          setFieldErrors(extractFieldErrors(err));
          const message = isApiClientError(err) && err.category === 'validation'
            ? 'Please fix the highlighted fields.'
            : 'Could not update the job family. Please try again.';
          setStatus({ kind: 'error', message });
        },
      });
    }
  }

  function confirmArchive() {
    if (!pendingArchive) return;
    const jf = pendingArchive;
    deleteMutation.mutate(jf.id, {
      onSuccess: () => { setStatus({ kind: 'success', message: `"${jf.name}" was archived.` }); setPendingArchive(null); },
      onError: () => { setStatus({ kind: 'error', message: `Could not archive "${jf.name}". Please try again.` }); setPendingArchive(null); },
    });
  }

  const rowActions: MasterDataRowAction<AdminJobFamily>[] = [
    { key: 'edit', label: 'Edit', onClick: openEdit },
    { key: 'archive', label: 'Archive', variant: 'destructive', onClick: (jf) => setPendingArchive(jf) },
  ];

  const emptyState = items.length === 0 && !isLoading ? (
    <MasterDataEmptyState
      reason={filterText ? 'no-search-results' : 'no-records'}
      entityLabelPlural="job families"
      searchTerm={filterText}
      onClearSearch={() => setFilterText('')}
      onCreate={openCreate}
      createLabel="Create job family"
    />
  ) : undefined;

  return (
    <PageShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Job Families</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage the CMS job families catalog used to group roles.</p>
        </div>

        <MasterDataStatusBanner status={status} onDismiss={() => setStatus(null)} />

        <MasterDataToolbar
          searchValue={filterText}
          onSearchChange={setFilterText}
          searchPlaceholder="Filter job families…"
          onRefresh={() => refetch()}
          isRefreshing={isFetching && !isLoading}
          createLabel="Create job family"
          onCreate={openCreate}
        />

        {isError ? (
          <div className="rounded-xl border border-border">
            <MasterDataErrorState error={error} onRetry={() => refetch()} entityLabelPlural="job families" />
          </div>
        ) : (
          <MasterDataTable
            columns={JOB_FAMILY_COLUMNS}
            rows={items}
            rowActions={rowActions}
            isLoading={isLoading}
            emptyState={emptyState}
            getRowLabel={(jf) => jf.name}
          />
        )}
      </div>

      <MasterDataDrawer isOpen={drawer !== null} title={drawer?.kind === 'edit' ? 'Edit job family' : 'Create job family'} onClose={closeDrawer}>
        {drawer && (
          <MasterDataForm<JobFamilyFormValues>
            fields={JOB_FAMILY_FIELDS}
            initialValues={drawer.kind === 'edit' ? jobFamilyToFormValues(drawer.jobFamily) : EMPTY_JOB_FAMILY_FORM_VALUES}
            fieldErrors={fieldErrors}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
            submitLabel={drawer.kind === 'edit' ? 'Save changes' : 'Create job family'}
            onSubmit={handleSubmit}
            onCancel={closeDrawer}
          />
        )}
      </MasterDataDrawer>

      <MasterDataDeleteDialog
        isOpen={pendingArchive !== null}
        recordLabel={pendingArchive?.name ?? ''}
        entityLabel="job family"
        isSubmitting={deleteMutation.isPending}
        onConfirm={confirmArchive}
        onCancel={() => setPendingArchive(null)}
      />
    </PageShell>
  );
}
