/**
 * pages/admin/master-data/SalaryBenchmarksPage.tsx
 * WP-ADMIN-COMP-03 — CMS Salary Benchmarks Management.
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
import type { AdminSalaryBenchmark } from '@/lib/api/adminCmsSalaryBenchmarks';
import {
  useAdminSalaryBenchmarksList,
  useCreateAdminSalaryBenchmark,
  useUpdateAdminSalaryBenchmark,
  useDeleteAdminSalaryBenchmark,
} from '@/hooks/admin/useAdminCmsSalaryBenchmarks';
import {
  SALARY_BENCHMARK_COLUMNS,
  SALARY_BENCHMARK_FIELDS,
  EMPTY_SALARY_BENCHMARK_FORM_VALUES,
  salaryBenchmarkToFormValues,
  type SalaryBenchmarkFormValues,
} from './salary-benchmarks.config';

const LIST_LIMIT = 100;

type DrawerMode = { kind: 'create' } | { kind: 'edit'; benchmark: AdminSalaryBenchmark } | null;

export default function SalaryBenchmarksPage() {
  const [filterText, setFilterText] = useState('');
  const [drawer, setDrawer] = useState<DrawerMode>(null);
  const [pendingArchive, setPendingArchive] = useState<AdminSalaryBenchmark | null>(null);
  const [status, setStatus] = useState<MasterDataStatus | null>(null);
  const [fieldErrors, setFieldErrors] = useState<MasterDataFieldErrors>({});

  const { data, isLoading, isFetching, isError, error, refetch } = useAdminSalaryBenchmarksList({ limit: LIST_LIMIT });
  const createMutation = useCreateAdminSalaryBenchmark();
  const updateMutation = useUpdateAdminSalaryBenchmark();
  const deleteMutation = useDeleteAdminSalaryBenchmark();

  const allItems = data?.items ?? [];
  const items = useMemo(() => {
    if (!filterText.trim()) return allItems;
    const needle = filterText.trim().toLowerCase();
    return allItems.filter((i) => i.name.toLowerCase().includes(needle));
  }, [allItems, filterText]);

  function openCreate() { setFieldErrors({}); setDrawer({ kind: 'create' }); }
  function openEdit(benchmark: AdminSalaryBenchmark) { setFieldErrors({}); setDrawer({ kind: 'edit', benchmark }); }
  function closeDrawer() { setDrawer(null); setFieldErrors({}); }

  function extractFieldErrors(err: unknown): MasterDataFieldErrors {
    if (!isApiClientError(err) || err.category !== 'validation') return {};
    const fields = (err.details?.fields as { field: string; message: string }[] | undefined) ?? [];
    return Object.fromEntries(fields.map((f) => [f.field, f.message]));
  }

  function handleSubmit(values: SalaryBenchmarkFormValues) {
    const payload = {
      name: values.name.trim(),
      description: values.description || undefined,
      minSalary: values.minSalary,
      maxSalary: values.maxSalary,
      medianSalary: values.medianSalary,
      year: values.year,
    };

    if (drawer?.kind === 'create') {
      createMutation.mutate(payload, {
        onSuccess: () => { setStatus({ kind: 'success', message: `"${payload.name}" was created.` }); closeDrawer(); },
        onError: (err) => {
          setFieldErrors(extractFieldErrors(err));
          const message = isApiClientError(err) && err.category === 'conflict'
            ? `A salary benchmark named "${payload.name}" already exists.`
            : isApiClientError(err) && err.category === 'validation'
              ? 'Please fix the highlighted fields.'
              : 'Could not create the salary benchmark. Please try again.';
          setStatus({ kind: 'error', message });
        },
      });
    } else if (drawer?.kind === 'edit') {
      updateMutation.mutate({ id: drawer.benchmark.id, input: payload }, {
        onSuccess: () => { setStatus({ kind: 'success', message: `"${payload.name}" was updated.` }); closeDrawer(); },
        onError: (err) => {
          setFieldErrors(extractFieldErrors(err));
          const message = isApiClientError(err) && err.category === 'validation'
            ? 'Please fix the highlighted fields.'
            : 'Could not update the salary benchmark. Please try again.';
          setStatus({ kind: 'error', message });
        },
      });
    }
  }

  function confirmArchive() {
    if (!pendingArchive) return;
    const benchmark = pendingArchive;
    deleteMutation.mutate(benchmark.id, {
      onSuccess: () => { setStatus({ kind: 'success', message: `"${benchmark.name}" was archived.` }); setPendingArchive(null); },
      onError: () => { setStatus({ kind: 'error', message: `Could not archive "${benchmark.name}". Please try again.` }); setPendingArchive(null); },
    });
  }

  const rowActions: MasterDataRowAction<AdminSalaryBenchmark>[] = [
    { key: 'edit', label: 'Edit', onClick: openEdit },
    { key: 'archive', label: 'Archive', variant: 'destructive', onClick: (b) => setPendingArchive(b) },
  ];

  const emptyState = items.length === 0 && !isLoading ? (
    <MasterDataEmptyState
      reason={filterText ? 'no-search-results' : 'no-records'}
      entityLabelPlural="salary benchmarks"
      searchTerm={filterText}
      onClearSearch={() => setFilterText('')}
      onCreate={openCreate}
      createLabel="Create salary benchmark"
    />
  ) : undefined;

  return (
    <PageShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Salary Benchmarks</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage the CMS salary benchmarks catalog.</p>
        </div>

        <MasterDataStatusBanner status={status} onDismiss={() => setStatus(null)} />

        <MasterDataToolbar
          searchValue={filterText}
          onSearchChange={setFilterText}
          searchPlaceholder="Filter salary benchmarks…"
          onRefresh={() => refetch()}
          isRefreshing={isFetching && !isLoading}
          createLabel="Create salary benchmark"
          onCreate={openCreate}
        />

        {isError ? (
          <div className="rounded-xl border border-border">
            <MasterDataErrorState error={error} onRetry={() => refetch()} entityLabelPlural="salary benchmarks" />
          </div>
        ) : (
          <MasterDataTable
            columns={SALARY_BENCHMARK_COLUMNS}
            rows={items}
            rowActions={rowActions}
            isLoading={isLoading}
            emptyState={emptyState}
            getRowLabel={(b) => b.name}
          />
        )}
      </div>

      <MasterDataDrawer isOpen={drawer !== null} title={drawer?.kind === 'edit' ? 'Edit salary benchmark' : 'Create salary benchmark'} onClose={closeDrawer}>
        {drawer && (
          <MasterDataForm<SalaryBenchmarkFormValues>
            fields={SALARY_BENCHMARK_FIELDS}
            initialValues={drawer.kind === 'edit' ? salaryBenchmarkToFormValues(drawer.benchmark) : EMPTY_SALARY_BENCHMARK_FORM_VALUES}
            fieldErrors={fieldErrors}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
            submitLabel={drawer.kind === 'edit' ? 'Save changes' : 'Create salary benchmark'}
            onSubmit={handleSubmit}
            onCancel={closeDrawer}
          />
        )}
      </MasterDataDrawer>

      <MasterDataDeleteDialog
        isOpen={pendingArchive !== null}
        recordLabel={pendingArchive?.name ?? ''}
        entityLabel="salary benchmark"
        isSubmitting={deleteMutation.isPending}
        onConfirm={confirmArchive}
        onCancel={() => setPendingArchive(null)}
      />
    </PageShell>
  );
}
