/**
 * @file src/pages/admin/permissions/PermissionsCatalogPage.tsx
 * @description WP-ADMIN-04F-09 — Enterprise Permission Management UI.
 *
 * Route: /admin/permissions
 *
 * Built on the existing Master Data CRUD framework (components/master-data),
 * same structure as UsersPage.tsx/SkillsPage.tsx — this file only wires
 * state + reusable components together. Column knowledge lives in
 * permissions.config.tsx.
 *
 * AUDIT NOTE (see WP-ADMIN-04F-09 audit): the certified Registry
 * Discovery API has no free-text search or sort parameter — only
 * pagination plus three separate single-dimension lookup endpoints
 * (by resource / action / category). This page therefore offers three
 * mutually-exclusive filter dropdowns instead of a MasterDataSearch box;
 * it never fabricates client-side search/sort over what the API returns.
 *
 * Read-only: no create/edit/delete affordances. Row navigation is a
 * "View" row action, same convention as UsersPage.tsx.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MasterDataTable,
  MasterDataPagination,
  MasterDataEmptyState,
  MasterDataErrorState,
  type MasterDataRowAction,
} from '@/components/master-data';
import { PageShell } from '@/components/ui';
import type { AdminPermission } from '@/lib/api/adminPermissions';
import { useAdminPermissionsList, useAdminPermissionVocabulary } from '@/hooks/admin/usePermissionsAdmin';
import { adminPermissionDetailPath } from '@/routes/routes.constants';
import { PERMISSION_COLUMNS } from './permissions.config';

const PAGE_SIZE = 20;

type FilterDimension = 'resource' | 'action' | 'category' | null;

const selectClassName = [
  'h-10 rounded-lg border border-border bg-background px-3 text-sm',
  'text-foreground',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
].join(' ');

export default function PermissionsCatalogPage() {
  const navigate = useNavigate();
  const [offset, setOffset] = useState(0);
  const [filterDimension, setFilterDimension] = useState<FilterDimension>(null);
  const [filterValue, setFilterValue] = useState<string>('');

  const listParams = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset,
      resource: filterDimension === 'resource' ? filterValue : undefined,
      action: filterDimension === 'action' ? filterValue : undefined,
      category: filterDimension === 'category' ? filterValue : undefined,
    }),
    [offset, filterDimension, filterValue],
  );

  const { data, isLoading, isFetching, isError, error, refetch } = useAdminPermissionsList(listParams);

  // WP-ADMIN-04F-13B — Registry-driven filter vocabulary (replaces the
  // removed PERMISSION_RESOURCES/PERMISSION_ACTIONS/PERMISSION_CATEGORIES
  // constants). Unfiltered by assignability on purpose: this catalog is a
  // read-only view of the whole Registry, including Proposed/Deprecated/
  // Retired entries, not just what could currently be newly assigned.
  const { vocabulary: filterVocabulary } = useAdminPermissionVocabulary();

  const permissions = data?.items ?? [];
  const total = data?.total ?? 0;
  const isFiltered = filterDimension !== null && filterValue !== '';

  function handleFilterChange(dimension: Exclude<FilterDimension, null>, value: string) {
    setFilterDimension(value ? dimension : null);
    setFilterValue(value);
    setOffset(0);
  }

  function clearFilter() {
    setFilterDimension(null);
    setFilterValue('');
    setOffset(0);
  }

  function openDetail(permission: AdminPermission) {
    navigate(adminPermissionDetailPath(permission.identity));
  }

  const rowActions: MasterDataRowAction<AdminPermission>[] = [
    { key: 'view', label: 'View', onClick: openDetail },
  ];

  const emptyState =
    total === 0 && !isLoading ? (
      <MasterDataEmptyState
        reason={isFiltered ? 'no-search-results' : 'no-records'}
        entityLabelPlural="permissions"
        searchTerm={isFiltered ? filterValue : undefined}
        onClearSearch={isFiltered ? clearFilter : undefined}
      />
    ) : undefined;

  return (
    <PageShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Permissions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enterprise Permission Registry — read-only. Filter by resource, action, or category. Free-text search
            isn't available yet — the Registry Discovery API doesn't currently support it.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="filter-resource" className="mb-1 block text-xs font-medium text-muted-foreground">
              Resource
            </label>
            <select
              id="filter-resource"
              className={selectClassName}
              value={filterDimension === 'resource' ? filterValue : ''}
              onChange={(e) => handleFilterChange('resource', e.target.value)}
            >
              <option value="">All resources</option>
              {filterVocabulary.resources.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-action" className="mb-1 block text-xs font-medium text-muted-foreground">
              Action
            </label>
            <select
              id="filter-action"
              className={selectClassName}
              value={filterDimension === 'action' ? filterValue : ''}
              onChange={(e) => handleFilterChange('action', e.target.value)}
            >
              <option value="">All actions</option>
              {filterVocabulary.actions.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-category" className="mb-1 block text-xs font-medium text-muted-foreground">
              Category
            </label>
            <select
              id="filter-category"
              className={selectClassName}
              value={filterDimension === 'category' ? filterValue : ''}
              onChange={(e) => handleFilterChange('category', e.target.value)}
            >
              <option value="">All categories</option>
              {filterVocabulary.categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {isFiltered && (
            <button
              type="button"
              onClick={clearFilter}
              className="h-10 rounded-lg px-3 text-sm font-medium text-primary hover:bg-primary/10"
            >
              Clear filter
            </button>
          )}
        </div>

        {isError ? (
          <div className="rounded-xl border border-border">
            <MasterDataErrorState error={error} onRetry={() => refetch()} entityLabelPlural="permissions" />
          </div>
        ) : (
          <>
            <MasterDataTable
              columns={PERMISSION_COLUMNS}
              rows={permissions}
              rowActions={rowActions}
              isLoading={isLoading}
              emptyState={emptyState}
              getRowLabel={(permission) => permission.identity}
            />
            <MasterDataPagination
              offset={offset}
              limit={PAGE_SIZE}
              total={total}
              currentPageCount={permissions.length}
              onOffsetChange={setOffset}
              isLoading={isFetching}
            />
          </>
        )}
      </div>
    </PageShell>
  );
}
