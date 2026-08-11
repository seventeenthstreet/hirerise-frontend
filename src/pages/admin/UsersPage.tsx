/**
 * @file src/pages/admin/UsersPage.tsx
 * @description WP-ADMIN-04 Phase 1B — Enterprise User Directory (read-only).
 *
 * Route: /admin/users
 *
 * Replaces the WP-ADMIN-03 Phase 2 placeholder. Built entirely on the
 * existing Master Data CRUD framework (components/master-data) — this file
 * only wires state + the reusable components together, same structure as
 * SkillsPage.tsx. All user-directory-specific column knowledge lives in
 * users.config.tsx.
 *
 * Read-only: no create/edit/delete affordances anywhere on this page.
 * Row navigation is exposed as a "View" row action (rather than a bare
 * `onClick` on <tr>) so the shared MasterDataTable component — also used
 * by Skills/Roles — doesn't need a new prop just for this module.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MasterDataTable,
  MasterDataSearch,
  MasterDataPagination,
  MasterDataEmptyState,
  MasterDataErrorState,
  type MasterDataRowAction,
} from '@/components/master-data';
import { PageShell } from '@/components/ui';
import type { AdminUserListItem } from '@/lib/api/adminUsers';
import { useAdminUsersList } from '@/hooks/admin/useAdminUsers';
import { adminUserDetailPath } from '@/routes/routes.constants';
import { USER_COLUMNS } from './users.config';

const PAGE_SIZE = 20;

export default function UsersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);

  const listParams = useMemo(
    () => ({ limit: PAGE_SIZE, offset, search: search || undefined }),
    [offset, search],
  );

  const { data, isLoading, isFetching, isError, error, refetch } = useAdminUsersList(listParams);

  const users = data?.items ?? [];
  const total = data?.total ?? 0;

  function handleSearchChange(next: string) {
    setSearch(next);
    setOffset(0); // reset to first page on new search
  }

  function openDetail(user: AdminUserListItem) {
    navigate(adminUserDetailPath(user.id));
  }

  const rowActions: MasterDataRowAction<AdminUserListItem>[] = [
    { key: 'view', label: 'View', onClick: openDetail },
  ];

  const emptyState =
    total === 0 && !isLoading ? (
      <MasterDataEmptyState
        reason={search ? 'no-search-results' : 'no-records'}
        entityLabelPlural="users"
        searchTerm={search}
        onClearSearch={() => handleSearchChange('')}
      />
    ) : undefined;

  return (
    <PageShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enterprise User Directory. Select a user to edit their profile, manage roles and permissions, enable or disable their account, or review their audit history.
          </p>
        </div>

        <div className="max-w-sm">
          <MasterDataSearch
            value={search}
            onChange={handleSearchChange}
            placeholder="Search by email or name…"
          />
        </div>

        {isError ? (
          <div className="rounded-xl border border-border">
            <MasterDataErrorState error={error} onRetry={() => refetch()} entityLabelPlural="users" />
          </div>
        ) : (
          <>
            <MasterDataTable
              columns={USER_COLUMNS}
              rows={users}
              rowActions={rowActions}
              isLoading={isLoading}
              emptyState={emptyState}
              getRowLabel={(user) => user.email}
            />
            <MasterDataPagination
              offset={offset}
              limit={PAGE_SIZE}
              total={total}
              currentPageCount={users.length}
              onOffsetChange={setOffset}
              isLoading={isFetching}
            />
          </>
        )}
      </div>
    </PageShell>
  );
}
