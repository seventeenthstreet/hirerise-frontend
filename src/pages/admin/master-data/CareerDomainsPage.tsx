/**
 * pages/admin/master-data/CareerDomainsPage.tsx
 *
 * WP-ADMIN-COMP-03 — CMS Career Domains Management.
 *
 * Backend returns the full non-deleted table on every list call with no
 * search/pagination, so the toolbar's search box filters client-side and no
 * MasterDataPagination is rendered.
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
import type { AdminCareerDomain } from '@/lib/api/adminCmsCareerDomains';
import {
  useAdminCareerDomainsList,
  useCreateAdminCareerDomain,
  useUpdateAdminCareerDomain,
  useDeleteAdminCareerDomain,
} from '@/hooks/admin/useAdminCmsCareerDomains';
import {
  CAREER_DOMAIN_COLUMNS,
  CAREER_DOMAIN_FIELDS,
  EMPTY_CAREER_DOMAIN_FORM_VALUES,
  careerDomainToFormValues,
  type CareerDomainFormValues,
} from './career-domains.config';

type DrawerMode = { kind: 'create' } | { kind: 'edit'; domain: AdminCareerDomain } | null;

export default function CareerDomainsPage() {
  const [filterText, setFilterText] = useState('');
  const [drawer, setDrawer] = useState<DrawerMode>(null);
  const [pendingArchive, setPendingArchive] = useState<AdminCareerDomain | null>(null);
  const [status, setStatus] = useState<MasterDataStatus | null>(null);
  const [fieldErrors, setFieldErrors] = useState<MasterDataFieldErrors>({});

  const { data, isLoading, isFetching, isError, error, refetch } = useAdminCareerDomainsList();

  const createMutation = useCreateAdminCareerDomain();
  const updateMutation = useUpdateAdminCareerDomain();
  const deleteMutation = useDeleteAdminCareerDomain();

  const allDomains = data ?? [];
  const domains = useMemo(() => {
    if (!filterText.trim()) return allDomains;
    const needle = filterText.trim().toLowerCase();
    return allDomains.filter((d) => d.name.toLowerCase().includes(needle));
  }, [allDomains, filterText]);

  function openCreate() {
    setFieldErrors({});
    setDrawer({ kind: 'create' });
  }

  function openEdit(domain: AdminCareerDomain) {
    setFieldErrors({});
    setDrawer({ kind: 'edit', domain });
  }

  function closeDrawer() {
    setDrawer(null);
    setFieldErrors({});
  }

  function extractFieldErrors(err: unknown): MasterDataFieldErrors {
    if (!isApiClientError(err) || err.category !== 'validation') return {};
    const fields = (err.details?.fields as { field: string; message: string }[] | undefined) ?? [];
    return Object.fromEntries(fields.map((f) => [f.field, f.message]));
  }

  function handleSubmit(values: CareerDomainFormValues) {
    const payload = {
      name: values.name.trim(),
      description: values.description || undefined,
      status: values.status || undefined,
    };

    if (drawer?.kind === 'create') {
      createMutation.mutate(
        { name: payload.name, description: payload.description },
        {
          onSuccess: () => {
            setStatus({ kind: 'success', message: `"${payload.name}" was created.` });
            closeDrawer();
          },
          onError: (err) => {
            setFieldErrors(extractFieldErrors(err));
            const message =
              isApiClientError(err) && err.category === 'conflict'
                ? `A career domain named "${payload.name}" already exists.`
                : isApiClientError(err) && err.category === 'validation'
                  ? 'Please fix the highlighted fields.'
                  : 'Could not create the career domain. Please try again.';
            setStatus({ kind: 'error', message });
          },
        },
      );
    } else if (drawer?.kind === 'edit') {
      updateMutation.mutate(
        { id: drawer.domain.id, input: payload },
        {
          onSuccess: () => {
            setStatus({ kind: 'success', message: `"${payload.name}" was updated.` });
            closeDrawer();
          },
          onError: (err) => {
            setFieldErrors(extractFieldErrors(err));
            const message =
              isApiClientError(err) && err.category === 'validation'
                ? 'Please fix the highlighted fields.'
                : 'Could not update the career domain. Please try again.';
            setStatus({ kind: 'error', message });
          },
        },
      );
    }
  }

  function confirmArchive() {
    if (!pendingArchive) return;
    const domain = pendingArchive;
    deleteMutation.mutate(domain.id, {
      onSuccess: () => {
        setStatus({ kind: 'success', message: `"${domain.name}" was archived.` });
        setPendingArchive(null);
      },
      onError: () => {
        setStatus({ kind: 'error', message: `Could not archive "${domain.name}". Please try again.` });
        setPendingArchive(null);
      },
    });
  }

  const rowActions: MasterDataRowAction<AdminCareerDomain>[] = [
    { key: 'edit', label: 'Edit', onClick: openEdit },
    { key: 'archive', label: 'Archive', variant: 'destructive', onClick: (d) => setPendingArchive(d) },
  ];

  const emptyState =
    domains.length === 0 && !isLoading ? (
      <MasterDataEmptyState
        reason={filterText ? 'no-search-results' : 'no-records'}
        entityLabelPlural="career domains"
        searchTerm={filterText}
        onClearSearch={() => setFilterText('')}
        onCreate={openCreate}
        createLabel="Create career domain"
      />
    ) : undefined;

  return (
    <PageShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Career Domains</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the CMS career domains catalog used to group skill clusters.
          </p>
        </div>

        <MasterDataStatusBanner status={status} onDismiss={() => setStatus(null)} />

        <MasterDataToolbar
          searchValue={filterText}
          onSearchChange={setFilterText}
          searchPlaceholder="Filter career domains…"
          onRefresh={() => refetch()}
          isRefreshing={isFetching && !isLoading}
          createLabel="Create career domain"
          onCreate={openCreate}
        />

        {isError ? (
          <div className="rounded-xl border border-border">
            <MasterDataErrorState error={error} onRetry={() => refetch()} entityLabelPlural="career domains" />
          </div>
        ) : (
          <MasterDataTable
            columns={CAREER_DOMAIN_COLUMNS}
            rows={domains}
            rowActions={rowActions}
            isLoading={isLoading}
            emptyState={emptyState}
            getRowLabel={(domain) => domain.name}
          />
        )}
      </div>

      <MasterDataDrawer
        isOpen={drawer !== null}
        title={drawer?.kind === 'edit' ? 'Edit career domain' : 'Create career domain'}
        onClose={closeDrawer}
      >
        {drawer && (
          <MasterDataForm<CareerDomainFormValues>
            fields={CAREER_DOMAIN_FIELDS}
            initialValues={drawer.kind === 'edit' ? careerDomainToFormValues(drawer.domain) : EMPTY_CAREER_DOMAIN_FORM_VALUES}
            fieldErrors={fieldErrors}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
            submitLabel={drawer.kind === 'edit' ? 'Save changes' : 'Create career domain'}
            onSubmit={handleSubmit}
            onCancel={closeDrawer}
          />
        )}
      </MasterDataDrawer>

      <MasterDataDeleteDialog
        isOpen={pendingArchive !== null}
        recordLabel={pendingArchive?.name ?? ''}
        entityLabel="career domain"
        isSubmitting={deleteMutation.isPending}
        onConfirm={confirmArchive}
        onCancel={() => setPendingArchive(null)}
      />
    </PageShell>
  );
}
