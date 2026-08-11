/**
 * pages/admin/master-data/SkillClustersPage.tsx
 *
 * WP-ADMIN-COMP-03 — CMS Skill Clusters Management.
 *
 * domainId is resolved live from the Career Domains API — never hard-coded.
 * The generic factory's list `total` is just `items.length` for the current
 * page (not a true count), so we fetch a single generous page and skip
 * MasterDataPagination rather than pretend it's real server pagination.
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
import type { AdminSkillCluster } from '@/lib/api/adminCmsSkillClusters';
import {
  useAdminSkillClustersList,
  useCreateAdminSkillCluster,
  useUpdateAdminSkillCluster,
  useDeleteAdminSkillCluster,
} from '@/hooks/admin/useAdminCmsSkillClusters';
import { useAdminCareerDomainsList } from '@/hooks/admin/useAdminCmsCareerDomains';
import {
  getSkillClusterFields,
  getSkillClusterColumns,
  EMPTY_SKILL_CLUSTER_FORM_VALUES,
  skillClusterToFormValues,
  type SkillClusterFormValues,
} from './skill-clusters.config';

const LIST_LIMIT = 100;

type DrawerMode = { kind: 'create' } | { kind: 'edit'; cluster: AdminSkillCluster } | null;

export default function SkillClustersPage() {
  const [filterText, setFilterText] = useState('');
  const [drawer, setDrawer] = useState<DrawerMode>(null);
  const [pendingArchive, setPendingArchive] = useState<AdminSkillCluster | null>(null);
  const [status, setStatus] = useState<MasterDataStatus | null>(null);
  const [fieldErrors, setFieldErrors] = useState<MasterDataFieldErrors>({});

  const { data, isLoading, isFetching, isError, error, refetch } = useAdminSkillClustersList({ limit: LIST_LIMIT });
  const { data: domains } = useAdminCareerDomainsList();

  const createMutation = useCreateAdminSkillCluster();
  const updateMutation = useUpdateAdminSkillCluster();
  const deleteMutation = useDeleteAdminSkillCluster();

  const domainOptions = useMemo(
    () => (domains ?? []).map((d) => ({ value: d.id, label: d.name })),
    [domains],
  );
  const domainNameById = useMemo(
    () => new Map((domains ?? []).map((d) => [d.id, d.name] as const)),
    [domains],
  );

  const allClusters = data?.items ?? [];
  const clusters = useMemo(() => {
    if (!filterText.trim()) return allClusters;
    const needle = filterText.trim().toLowerCase();
    return allClusters.filter((c) => c.name.toLowerCase().includes(needle));
  }, [allClusters, filterText]);

  function openCreate() {
    setFieldErrors({});
    setDrawer({ kind: 'create' });
  }

  function openEdit(cluster: AdminSkillCluster) {
    setFieldErrors({});
    setDrawer({ kind: 'edit', cluster });
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

  function handleSubmit(values: SkillClusterFormValues) {
    const payload = {
      name: values.name.trim(),
      domainId: values.domainId,
      description: values.description || undefined,
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
              ? `A skill cluster named "${payload.name}" already exists.`
              : isApiClientError(err) && err.category === 'validation'
                ? 'Please fix the highlighted fields.'
                : 'Could not create the skill cluster. Please try again.';
          setStatus({ kind: 'error', message });
        },
      });
    } else if (drawer?.kind === 'edit') {
      updateMutation.mutate(
        { id: drawer.cluster.id, input: payload },
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
                : 'Could not update the skill cluster. Please try again.';
            setStatus({ kind: 'error', message });
          },
        },
      );
    }
  }

  function confirmArchive() {
    if (!pendingArchive) return;
    const cluster = pendingArchive;
    deleteMutation.mutate(cluster.id, {
      onSuccess: () => {
        setStatus({ kind: 'success', message: `"${cluster.name}" was archived.` });
        setPendingArchive(null);
      },
      onError: () => {
        setStatus({ kind: 'error', message: `Could not archive "${cluster.name}". Please try again.` });
        setPendingArchive(null);
      },
    });
  }

  const rowActions: MasterDataRowAction<AdminSkillCluster>[] = [
    { key: 'edit', label: 'Edit', onClick: openEdit },
    { key: 'archive', label: 'Archive', variant: 'destructive', onClick: (c) => setPendingArchive(c) },
  ];

  const emptyState =
    clusters.length === 0 && !isLoading ? (
      <MasterDataEmptyState
        reason={filterText ? 'no-search-results' : 'no-records'}
        entityLabelPlural="skill clusters"
        searchTerm={filterText}
        onClearSearch={() => setFilterText('')}
        onCreate={openCreate}
        createLabel="Create skill cluster"
      />
    ) : undefined;

  return (
    <PageShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Skill Clusters</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the CMS skill clusters catalog, grouped under career domains.
          </p>
        </div>

        <MasterDataStatusBanner status={status} onDismiss={() => setStatus(null)} />

        <MasterDataToolbar
          searchValue={filterText}
          onSearchChange={setFilterText}
          searchPlaceholder="Filter skill clusters…"
          onRefresh={() => refetch()}
          isRefreshing={isFetching && !isLoading}
          createLabel="Create skill cluster"
          onCreate={openCreate}
        />

        {isError ? (
          <div className="rounded-xl border border-border">
            <MasterDataErrorState error={error} onRetry={() => refetch()} entityLabelPlural="skill clusters" />
          </div>
        ) : (
          <MasterDataTable
            columns={getSkillClusterColumns(domainNameById)}
            rows={clusters}
            rowActions={rowActions}
            isLoading={isLoading}
            emptyState={emptyState}
            getRowLabel={(cluster) => cluster.name}
          />
        )}
      </div>

      <MasterDataDrawer
        isOpen={drawer !== null}
        title={drawer?.kind === 'edit' ? 'Edit skill cluster' : 'Create skill cluster'}
        onClose={closeDrawer}
      >
        {drawer && (
          <MasterDataForm<SkillClusterFormValues>
            fields={getSkillClusterFields(domainOptions)}
            initialValues={drawer.kind === 'edit' ? skillClusterToFormValues(drawer.cluster) : EMPTY_SKILL_CLUSTER_FORM_VALUES}
            fieldErrors={fieldErrors}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
            submitLabel={drawer.kind === 'edit' ? 'Save changes' : 'Create skill cluster'}
            onSubmit={handleSubmit}
            onCancel={closeDrawer}
          />
        )}
      </MasterDataDrawer>

      <MasterDataDeleteDialog
        isOpen={pendingArchive !== null}
        recordLabel={pendingArchive?.name ?? ''}
        entityLabel="skill cluster"
        isSubmitting={deleteMutation.isPending}
        onConfirm={confirmArchive}
        onCancel={() => setPendingArchive(null)}
      />
    </PageShell>
  );
}
