/**
 * pages/admin/master-data/SkillsPage.tsx
 *
 * WP-ADMIN-02A — Skills Management. Reference implementation for the
 * Master Data CRUD framework: this file only wires state + the reusable
 * components together. All Skills-specific knowledge lives in
 * skills.config.tsx; all generic CRUD behavior lives in components/master-data.
 */

import { useMemo, useState } from 'react';
import {
  MasterDataTable,
  MasterDataToolbar,
  MasterDataPagination,
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
import type { AdminSkill } from '@/lib/api/adminCmsSkills';
import {
  useAdminSkillsList,
  useCreateAdminSkill,
  useUpdateAdminSkill,
  useDeleteAdminSkill,
} from '@/hooks/admin/useAdminCmsSkills';
import {
  SKILL_COLUMNS,
  SKILL_FIELDS,
  EMPTY_SKILL_FORM_VALUES,
  skillToFormValues,
  type SkillFormValues,
} from './skills.config';

const PAGE_SIZE = 20;

type DrawerMode = { kind: 'create' } | { kind: 'edit'; skill: AdminSkill } | null;

export default function SkillsPage() {
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [drawer, setDrawer] = useState<DrawerMode>(null);
  const [pendingArchive, setPendingArchive] = useState<AdminSkill | null>(null);
  const [status, setStatus] = useState<MasterDataStatus | null>(null);
  const [fieldErrors, setFieldErrors] = useState<MasterDataFieldErrors>({});

  const listParams = useMemo(
    () => ({ limit: PAGE_SIZE, offset, search: search || undefined }),
    [offset, search],
  );

  const { data, isLoading, isFetching, isError, error, refetch } = useAdminSkillsList(listParams);

  const createMutation = useCreateAdminSkill();
  const updateMutation = useUpdateAdminSkill();
  const deleteMutation = useDeleteAdminSkill();

  const skills = data?.items ?? [];
  const total = data?.total ?? 0;

  // ── Handlers ────────────────────────────────────────────────────────────

  function handleSearchChange(next: string) {
    setSearch(next);
    setOffset(0); // reset to first page on new search
  }

  function openCreate() {
    setFieldErrors({});
    setDrawer({ kind: 'create' });
  }

  function openEdit(skill: AdminSkill) {
    setFieldErrors({});
    setDrawer({ kind: 'edit', skill });
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

  function handleSubmit(values: SkillFormValues) {
    const payload = {
      name: values.name.trim(),
      category: values.category || undefined,
      aliases: values.aliases,
      description: values.description || undefined,
      demandScore: values.demandScore,
    };

    if (drawer?.kind === 'create') {
      createMutation.mutate(
        { name: payload.name, category: payload.category, aliases: payload.aliases, description: payload.description, demandScore: payload.demandScore },
        {
          onSuccess: () => {
            setStatus({ kind: 'success', message: `"${payload.name}" was created.` });
            closeDrawer();
          },
          onError: (err) => {
            setFieldErrors(extractFieldErrors(err));
            const message =
              isApiClientError(err) && err.category === 'conflict'
                ? `A skill named "${payload.name}" already exists.`
                : isApiClientError(err) && err.category === 'validation'
                  ? 'Please fix the highlighted fields.'
                  : 'Could not create the skill. Please try again.';
            setStatus({ kind: 'error', message });
          },
        },
      );
    } else if (drawer?.kind === 'edit') {
      updateMutation.mutate(
        { skillId: drawer.skill.id, input: payload },
        {
          onSuccess: () => {
            setStatus({ kind: 'success', message: `"${payload.name}" was updated.` });
            closeDrawer();
          },
          onError: (err) => {
            setFieldErrors(extractFieldErrors(err));
            const message =
              isApiClientError(err) && err.category === 'conflict'
                ? `A skill named "${payload.name}" already exists.`
                : isApiClientError(err) && err.category === 'validation'
                  ? 'Please fix the highlighted fields.'
                  : 'Could not update the skill. Please try again.';
            setStatus({ kind: 'error', message });
          },
        },
      );
    }
  }

  function confirmArchive() {
    if (!pendingArchive) return;
    const skill = pendingArchive;
    deleteMutation.mutate(skill.id, {
      onSuccess: () => {
        setStatus({ kind: 'success', message: `"${skill.name}" was archived.` });
        setPendingArchive(null);
      },
      onError: () => {
        setStatus({ kind: 'error', message: `Could not archive "${skill.name}". Please try again.` });
        setPendingArchive(null);
      },
    });
  }

  // ── Row actions ─────────────────────────────────────────────────────────

  const rowActions: MasterDataRowAction<AdminSkill>[] = [
    { key: 'edit', label: 'Edit', onClick: openEdit },
    { key: 'archive', label: 'Archive', variant: 'destructive', onClick: (skill) => setPendingArchive(skill) },
  ];

  // ── Empty state selection ──────────────────────────────────────────────

  const emptyState =
    total === 0 && !isLoading ? (
      <MasterDataEmptyState
        reason={search ? 'no-search-results' : 'no-records'}
        entityLabelPlural="skills"
        searchTerm={search}
        onClearSearch={() => handleSearchChange('')}
        onCreate={openCreate}
        createLabel="Create skill"
      />
    ) : undefined;

  return (
    <PageShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Skills</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the CMS skills catalog used across role matching and search.
          </p>
        </div>

        <MasterDataStatusBanner status={status} onDismiss={() => setStatus(null)} />

        <MasterDataToolbar
          searchValue={search}
          onSearchChange={handleSearchChange}
          searchPlaceholder="Search skills…"
          onRefresh={() => refetch()}
          isRefreshing={isFetching && !isLoading}
          createLabel="Create skill"
          onCreate={openCreate}
        />

        {isError ? (
          <div className="rounded-xl border border-border">
            <MasterDataErrorState error={error} onRetry={() => refetch()} entityLabelPlural="skills" />
          </div>
        ) : (
          <>
            <MasterDataTable
              columns={SKILL_COLUMNS}
              rows={skills}
              rowActions={rowActions}
              isLoading={isLoading}
              emptyState={emptyState}
              getRowLabel={(skill) => skill.name}
            />
            <MasterDataPagination
              offset={offset}
              limit={PAGE_SIZE}
              total={total}
              currentPageCount={skills.length}
              onOffsetChange={setOffset}
              isLoading={isFetching}
            />
          </>
        )}
      </div>

      <MasterDataDrawer
        isOpen={drawer !== null}
        title={drawer?.kind === 'edit' ? 'Edit skill' : 'Create skill'}
        onClose={closeDrawer}
      >
        {drawer && (
          <MasterDataForm<SkillFormValues>
            fields={SKILL_FIELDS}
            initialValues={drawer.kind === 'edit' ? skillToFormValues(drawer.skill) : EMPTY_SKILL_FORM_VALUES}
            fieldErrors={fieldErrors}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
            submitLabel={drawer.kind === 'edit' ? 'Save changes' : 'Create skill'}
            onSubmit={handleSubmit}
            onCancel={closeDrawer}
          />
        )}
      </MasterDataDrawer>

      <MasterDataDeleteDialog
        isOpen={pendingArchive !== null}
        recordLabel={pendingArchive?.name ?? ''}
        entityLabel="skill"
        isSubmitting={deleteMutation.isPending}
        onConfirm={confirmArchive}
        onCancel={() => setPendingArchive(null)}
      />
    </PageShell>
  );
}
