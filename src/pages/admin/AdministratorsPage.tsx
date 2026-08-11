/**
 * @file src/pages/admin/AdministratorsPage.tsx
 * @description WP-ADMIN-05A — Enterprise Administrator Directory.
 *
 * Route: /admin/administrators
 *
 * Built on the same Master Data CRUD framework as UsersPage.tsx — this
 * file only wires state + the reusable components together. All
 * directory-specific column knowledge lives in administrators.config.tsx.
 *
 * Search, filter, and pagination are all server-side (see
 * administrators.repository.js#listPrincipals) — this page never fetches
 * the full admin_principals table client-side.
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
import {
  ADMINISTRATOR_STATUSES,
  type AdministratorListItem,
  type AdministratorStatus,
} from '@/lib/api/administrators';
import { useAdministratorsList } from '@/hooks/admin/useAdministrators';
import { adminAdministratorDetailPath } from '@/routes/routes.constants';
import { ADMINISTRATOR_COLUMNS } from './administrators.config';

const PAGE_SIZE = 20;

const STATUS_FILTER_LABELS: Record<AdministratorStatus, string> = {
  active: 'Active',
  suspended: 'Suspended',
  revoked: 'Revoked',
  expired: 'Expired',
};

export default function AdministratorsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AdministratorStatus | ''>('');
  const [offset, setOffset] = useState(0);

  const listParams = useMemo(
    () => ({ limit: PAGE_SIZE, offset, search: search || undefined, status: status || undefined }),
    [offset, search, status],
  );

  const { data, isLoading, isFetching, isError, error, refetch } = useAdministratorsList(listParams);

  const administrators = data?.items ?? [];
  const total = data?.total ?? 0;

  function handleSearchChange(next: string) {
    setSearch(next);
    setOffset(0);
  }

  function handleStatusChange(next: AdministratorStatus | '') {
    setStatus(next);
    setOffset(0);
  }

  function openDetail(administrator: AdministratorListItem) {
    navigate(adminAdministratorDetailPath(administrator.uid));
  }

  const rowActions: MasterDataRowAction<AdministratorListItem>[] = [
    { key: 'view', label: 'View', onClick: openDetail },
  ];

  const emptyState =
    total === 0 && !isLoading ? (
      <MasterDataEmptyState
        reason={search || status ? 'no-search-results' : 'no-records'}
        entityLabelPlural="administrators"
        searchTerm={search}
        onClearSearch={() => {
          handleSearchChange('');
          handleStatusChange('');
        }}
      />
    ) : undefined;

  return (
    <PageShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Administrators</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enterprise Administrator directory. Grant, suspend, reactivate, and revoke actions are performed via the
            certified Administrator Lifecycle — every decision is made server-side.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="max-w-sm flex-1">
            <MasterDataSearch
              value={search}
              onChange={handleSearchChange}
              placeholder="Search by email or name…"
            />
          </div>
          <div>
            <label htmlFor="administrator-status-filter" className="mb-1 block text-xs font-medium text-muted-foreground">
              Status
            </label>
            <select
              id="administrator-status-filter"
              value={status}
              onChange={(e) => handleStatusChange(e.target.value as AdministratorStatus | '')}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <option value="">All statuses</option>
              {ADMINISTRATOR_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_FILTER_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isError ? (
          <div className="rounded-xl border border-border">
            <MasterDataErrorState error={error} onRetry={() => refetch()} entityLabelPlural="administrators" />
          </div>
        ) : (
          <>
            <MasterDataTable
              columns={ADMINISTRATOR_COLUMNS}
              rows={administrators}
              rowActions={rowActions}
              isLoading={isLoading}
              emptyState={emptyState}
              getRowLabel={(row) => row.email ?? row.uid}
            />
            <MasterDataPagination
              offset={offset}
              limit={PAGE_SIZE}
              total={total}
              currentPageCount={administrators.length}
              onOffsetChange={setOffset}
              isLoading={isFetching}
            />
          </>
        )}
      </div>
    </PageShell>
  );
}
