/**
 * pages/admin/master-data/RolesPage.tsx
 *
 * WP-ADMIN-COMP-03 — CMS Roles Management.
 *
 * Backend does NOT support: search, offset pagination, or delete. So:
 *  - the toolbar's search box filters the already-fetched page client-side
 *    (dataset capped at 100 rows server-side, so this is cheap — not a
 *    simulation of server-side search over a large table)
 *  - no MasterDataPagination is rendered
 *  - no Archive/Delete row action is rendered
 */

import { useMemo, useState } from 'react';
import {
  MasterDataTable,
  MasterDataToolbar,
  MasterDataDrawer,
  MasterDataForm,
  MasterDataEmptyState,
  MasterDataErrorState,
  MasterDataStatusBanner,
  type MasterDataRowAction,
  type MasterDataStatus,
  type MasterDataFieldErrors,
} from '@/components/master-data';
import { PageShell } from '@/components/ui';
import { isApiClientError } from '@/lib/api/core';
import type { AdminCmsRole } from '@/lib/api/adminCmsRoles';
import {
  useAdminCmsRolesList,
  useCreateAdminCmsRole,
  useUpdateAdminCmsRole,
} from '@/hooks/admin/useAdminCmsRoles';
import {
  ROLE_COLUMNS,
  ROLE_FIELDS,
  EMPTY_ROLE_FORM_VALUES,
  roleToFormValues,
  type RoleFormValues,
} from './roles.config';

const LIST_LIMIT = 100; // backend MAX_LIMIT

type DrawerMode = { kind: 'create' } | { kind: 'edit'; role: AdminCmsRole } | null;

export default function RolesPage() {
  const [filterText, setFilterText] = useState('');
  const [drawer, setDrawer] = useState<DrawerMode>(null);
  const [status, setStatus] = useState<MasterDataStatus | null>(null);
  const [fieldErrors, setFieldErrors] = useState<MasterDataFieldErrors>({});

  const { data, isLoading, isFetching, isError, error, refetch } = useAdminCmsRolesList({ limit: LIST_LIMIT });

  const createMutation = useCreateAdminCmsRole();
  const updateMutation = useUpdateAdminCmsRole();

  const allRoles = data?.items ?? [];
  const roles = useMemo(() => {
    if (!filterText.trim()) return allRoles;
    const needle = filterText.trim().toLowerCase();
    return allRoles.filter(
      (r) => r.name.toLowerCase().includes(needle) || r.jobFamilyId.toLowerCase().includes(needle),
    );
  }, [allRoles, filterText]);

  function openCreate() {
    setFieldErrors({});
    setDrawer({ kind: 'create' });
  }

  function openEdit(role: AdminCmsRole) {
    setFieldErrors({});
    setDrawer({ kind: 'edit', role });
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

  function handleSubmit(values: RoleFormValues) {
    const payload = {
      name: values.name.trim(),
      jobFamilyId: values.jobFamilyId.trim(),
      level: values.level || undefined,
      track: values.track || undefined,
      description: values.description || undefined,
      alternativeTitles: values.alternativeTitles,
    };

    if (drawer?.kind === 'create') {
      createMutation.mutate(payload, {
        onSuccess: () => {
          setStatus({ kind: 'success', message: `"${payload.name}" was created.` });
          closeDrawer();
        },
        onError: (err) => {
          setFieldErrors(extractFieldErrors(err));
          const message =
            isApiClientError(err) && err.category === 'conflict'
              ? `A role named "${payload.name}" already exists for this job family.`
              : isApiClientError(err) && err.category === 'validation'
                ? 'Please fix the highlighted fields.'
                : 'Could not create the role. Please try again.';
          setStatus({ kind: 'error', message });
        },
      });
    } else if (drawer?.kind === 'edit') {
      updateMutation.mutate(
        { roleId: drawer.role.id, input: payload },
        {
          onSuccess: () => {
            setStatus({ kind: 'success', message: `"${payload.name}" was updated.` });
            closeDrawer();
          },
          onError: (err) => {
            setFieldErrors(extractFieldErrors(err));
            const message =
              isApiClientError(err) && err.category === 'conflict'
                ? `A role named "${payload.name}" already exists for this job family.`
                : isApiClientError(err) && err.category === 'validation'
                  ? 'Please fix the highlighted fields.'
                  : 'Could not update the role. Please try again.';
            setStatus({ kind: 'error', message });
          },
        },
      );
    }
  }

  // No delete/archive row action — the backend has no DELETE route for CMS Roles.
  const rowActions: MasterDataRowAction<AdminCmsRole>[] = [
    { key: 'edit', label: 'Edit', onClick: openEdit },
  ];

  const emptyState =
    roles.length === 0 && !isLoading ? (
      <MasterDataEmptyState
        reason={filterText ? 'no-search-results' : 'no-records'}
        entityLabelPlural="roles"
        searchTerm={filterText}
        onClearSearch={() => setFilterText('')}
        onCreate={openCreate}
        createLabel="Create role"
      />
    ) : undefined;

  return (
    <PageShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Roles</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the CMS career roles catalog. Roles cannot be deleted from this screen.
          </p>
        </div>

        <MasterDataStatusBanner status={status} onDismiss={() => setStatus(null)} />

        <MasterDataToolbar
          searchValue={filterText}
          onSearchChange={setFilterText}
          searchPlaceholder="Filter roles…"
          onRefresh={() => refetch()}
          isRefreshing={isFetching && !isLoading}
          createLabel="Create role"
          onCreate={openCreate}
        />

        {isError ? (
          <div className="rounded-xl border border-border">
            <MasterDataErrorState error={error} onRetry={() => refetch()} entityLabelPlural="roles" />
          </div>
        ) : (
          <MasterDataTable
            columns={ROLE_COLUMNS}
            rows={roles}
            rowActions={rowActions}
            isLoading={isLoading}
            emptyState={emptyState}
            getRowLabel={(role) => role.name}
          />
        )}
      </div>

      <MasterDataDrawer
        isOpen={drawer !== null}
        title={drawer?.kind === 'edit' ? 'Edit role' : 'Create role'}
        onClose={closeDrawer}
      >
        {drawer && (
          <MasterDataForm<RoleFormValues>
            fields={ROLE_FIELDS}
            initialValues={drawer.kind === 'edit' ? roleToFormValues(drawer.role) : EMPTY_ROLE_FORM_VALUES}
            fieldErrors={fieldErrors}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
            submitLabel={drawer.kind === 'edit' ? 'Save changes' : 'Create role'}
            onSubmit={handleSubmit}
            onCancel={closeDrawer}
          />
        )}
      </MasterDataDrawer>
    </PageShell>
  );
}
