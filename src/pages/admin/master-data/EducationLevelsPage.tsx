/**
 * pages/admin/master-data/EducationLevelsPage.tsx
 * WP-ADMIN-COMP-03 — CMS Education Levels Management.
 * Rows are sorted client-side by sortOrder for display — this is presentation
 * ordering of an already-fetched, already-bounded page, not a fabricated
 * server-side sort capability (the backend has none).
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
import type { AdminEducationLevel } from '@/lib/api/adminCmsEducationLevels';
import {
  useAdminEducationLevelsList,
  useCreateAdminEducationLevel,
  useUpdateAdminEducationLevel,
  useDeleteAdminEducationLevel,
} from '@/hooks/admin/useAdminCmsEducationLevels';
import {
  EDUCATION_LEVEL_COLUMNS,
  EDUCATION_LEVEL_FIELDS,
  EMPTY_EDUCATION_LEVEL_FORM_VALUES,
  educationLevelToFormValues,
  type EducationLevelFormValues,
} from './education-levels.config';

const LIST_LIMIT = 100;

type DrawerMode = { kind: 'create' } | { kind: 'edit'; level: AdminEducationLevel } | null;

export default function EducationLevelsPage() {
  const [filterText, setFilterText] = useState('');
  const [drawer, setDrawer] = useState<DrawerMode>(null);
  const [pendingArchive, setPendingArchive] = useState<AdminEducationLevel | null>(null);
  const [status, setStatus] = useState<MasterDataStatus | null>(null);
  const [fieldErrors, setFieldErrors] = useState<MasterDataFieldErrors>({});

  const { data, isLoading, isFetching, isError, error, refetch } = useAdminEducationLevelsList({ limit: LIST_LIMIT });
  const createMutation = useCreateAdminEducationLevel();
  const updateMutation = useUpdateAdminEducationLevel();
  const deleteMutation = useDeleteAdminEducationLevel();

  const allItems = data?.items ?? [];
  const items = useMemo(() => {
    const filtered = filterText.trim()
      ? allItems.filter((i) => i.name.toLowerCase().includes(filterText.trim().toLowerCase()))
      : allItems;
    return [...filtered].sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER));
  }, [allItems, filterText]);

  function openCreate() { setFieldErrors({}); setDrawer({ kind: 'create' }); }
  function openEdit(level: AdminEducationLevel) { setFieldErrors({}); setDrawer({ kind: 'edit', level }); }
  function closeDrawer() { setDrawer(null); setFieldErrors({}); }

  function extractFieldErrors(err: unknown): MasterDataFieldErrors {
    if (!isApiClientError(err) || err.category !== 'validation') return {};
    const fields = (err.details?.fields as { field: string; message: string }[] | undefined) ?? [];
    return Object.fromEntries(fields.map((f) => [f.field, f.message]));
  }

  function handleSubmit(values: EducationLevelFormValues) {
    const payload = { name: values.name.trim(), description: values.description || undefined, sortOrder: values.sortOrder };

    if (drawer?.kind === 'create') {
      createMutation.mutate(payload, {
        onSuccess: () => { setStatus({ kind: 'success', message: `"${payload.name}" was created.` }); closeDrawer(); },
        onError: (err) => {
          setFieldErrors(extractFieldErrors(err));
          const message = isApiClientError(err) && err.category === 'conflict'
            ? `An education level named "${payload.name}" already exists.`
            : isApiClientError(err) && err.category === 'validation'
              ? 'Please fix the highlighted fields.'
              : 'Could not create the education level. Please try again.';
          setStatus({ kind: 'error', message });
        },
      });
    } else if (drawer?.kind === 'edit') {
      updateMutation.mutate({ id: drawer.level.id, input: payload }, {
        onSuccess: () => { setStatus({ kind: 'success', message: `"${payload.name}" was updated.` }); closeDrawer(); },
        onError: (err) => {
          setFieldErrors(extractFieldErrors(err));
          const message = isApiClientError(err) && err.category === 'validation'
            ? 'Please fix the highlighted fields.'
            : 'Could not update the education level. Please try again.';
          setStatus({ kind: 'error', message });
        },
      });
    }
  }

  function confirmArchive() {
    if (!pendingArchive) return;
    const level = pendingArchive;
    deleteMutation.mutate(level.id, {
      onSuccess: () => { setStatus({ kind: 'success', message: `"${level.name}" was archived.` }); setPendingArchive(null); },
      onError: () => { setStatus({ kind: 'error', message: `Could not archive "${level.name}". Please try again.` }); setPendingArchive(null); },
    });
  }

  const rowActions: MasterDataRowAction<AdminEducationLevel>[] = [
    { key: 'edit', label: 'Edit', onClick: openEdit },
    { key: 'archive', label: 'Archive', variant: 'destructive', onClick: (level) => setPendingArchive(level) },
  ];

  const emptyState = items.length === 0 && !isLoading ? (
    <MasterDataEmptyState
      reason={filterText ? 'no-search-results' : 'no-records'}
      entityLabelPlural="education levels"
      searchTerm={filterText}
      onClearSearch={() => setFilterText('')}
      onCreate={openCreate}
      createLabel="Create education level"
    />
  ) : undefined;

  return (
    <PageShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Education Levels</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage the CMS education levels catalog.</p>
        </div>

        <MasterDataStatusBanner status={status} onDismiss={() => setStatus(null)} />

        <MasterDataToolbar
          searchValue={filterText}
          onSearchChange={setFilterText}
          searchPlaceholder="Filter education levels…"
          onRefresh={() => refetch()}
          isRefreshing={isFetching && !isLoading}
          createLabel="Create education level"
          onCreate={openCreate}
        />

        {isError ? (
          <div className="rounded-xl border border-border">
            <MasterDataErrorState error={error} onRetry={() => refetch()} entityLabelPlural="education levels" />
          </div>
        ) : (
          <MasterDataTable
            columns={EDUCATION_LEVEL_COLUMNS}
            rows={items}
            rowActions={rowActions}
            isLoading={isLoading}
            emptyState={emptyState}
            getRowLabel={(level) => level.name}
          />
        )}
      </div>

      <MasterDataDrawer isOpen={drawer !== null} title={drawer?.kind === 'edit' ? 'Edit education level' : 'Create education level'} onClose={closeDrawer}>
        {drawer && (
          <MasterDataForm<EducationLevelFormValues>
            fields={EDUCATION_LEVEL_FIELDS}
            initialValues={drawer.kind === 'edit' ? educationLevelToFormValues(drawer.level) : EMPTY_EDUCATION_LEVEL_FORM_VALUES}
            fieldErrors={fieldErrors}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
            submitLabel={drawer.kind === 'edit' ? 'Save changes' : 'Create education level'}
            onSubmit={handleSubmit}
            onCancel={closeDrawer}
          />
        )}
      </MasterDataDrawer>

      <MasterDataDeleteDialog
        isOpen={pendingArchive !== null}
        recordLabel={pendingArchive?.name ?? ''}
        entityLabel="education level"
        isSubmitting={deleteMutation.isPending}
        onConfirm={confirmArchive}
        onCancel={() => setPendingArchive(null)}
      />
    </PageShell>
  );
}
