/**
 * @file src/pages/admin/JobsPage.tsx
 * @description WP-ADMIN-COMP-06 — Enterprise Jobs Administration.
 *
 * Route: /admin/jobs
 *
 * Replaces the WP-ADMIN-COMP-01-era placeholder stub. Built on the same
 * reusable Master Data UI primitives (MasterDataTable/Search/Pagination/
 * Empty/Error) UsersPage.tsx uses — these are generic presentation
 * components, not the Master Data *backend* CRUD framework. Jobs is
 * intentionally NOT forced into that backend abstraction (see
 * job.repository.js's header comment): the "jobs" table has no
 * status/lifecycle field and no single-job write API, only bulk sync
 * writes to it, so this page is read-only + a sync trigger, not CRUD.
 *
 * Capabilities implemented here (see WP-ADMIN-COMP-06 completion report
 * for the full capability matrix):
 *   - List Jobs        — server-paginated, server-searched (title/company/location)
 *   - Filter by source
 *   - View Job         — row action → JobDetailPage
 *   - Trigger Sync      — admin supplies sourceType + sourceUrl
 *   - Sync status       — disables Trigger while a sync is already running
 *   - Sync history      — recent sync_logs entries
 *
 * NOT implemented (repository evidence shows no backend support):
 *   - Create/Edit/Delete a single job — no write endpoint exists beyond
 *     bulk sync
 *   - Publish/Unpublish/Archive — no status/lifecycle column exists on
 *     the "jobs" table
 *   - Source management (enable/disable a persisted source entity) — no
 *     "sources" table exists; sync accepts an ad-hoc source per request
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
import { PageShell, Button } from '@/components/ui';
import { StatusBadge } from '@/components/admin-dashboard';
import type { AdminJob } from '@/lib/api/adminJobs';
import {
  useAdminJobsList,
  useAdminJobSyncStatus,
  useAdminJobSyncLogs,
} from '@/hooks/admin/useAdminJobs';
import { adminJobDetailPath } from '@/routes/routes.constants';
import { JOB_COLUMNS } from './jobs.config';
import { JobSyncPanel } from './JobSyncPanel';

const PAGE_SIZE = 20;

export default function JobsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [offset, setOffset] = useState(0);

  const listParams = useMemo(
    () => ({ limit: PAGE_SIZE, offset, search: search || undefined, source: source || undefined }),
    [offset, search, source],
  );

  const { data, isLoading, isFetching, isError, error, refetch } = useAdminJobsList(listParams);
  const syncStatus = useAdminJobSyncStatus();
  const syncLogs = useAdminJobSyncLogs(5);

  const jobs = data?.items ?? [];
  const total = data?.total ?? 0;

  function handleSearchChange(next: string) {
    setSearch(next);
    setOffset(0);
  }

  function handleSourceChange(next: string) {
    setSource(next);
    setOffset(0);
  }

  function openDetail(job: AdminJob) {
    navigate(adminJobDetailPath(job.id));
  }

  const rowActions: MasterDataRowAction<AdminJob>[] = [
    { key: 'view', label: 'View', onClick: openDetail },
  ];

  const emptyState =
    total === 0 && !isLoading ? (
      <MasterDataEmptyState
        reason={search || source ? 'no-search-results' : 'no-records'}
        entityLabelPlural="jobs"
        searchTerm={search}
        onClearSearch={() => {
          handleSearchChange('');
          handleSourceChange('');
        }}
        noRecordsTitle="No jobs have been ingested yet."
        noRecordsDescription="Use Trigger Sync below to import job listings."
      />
    ) : undefined;

  const isSyncRunning = syncStatus.data?.status === 'running';

  return (
    <PageShell>
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Jobs</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Job listings ingested from admin-triggered sync sources. Read-only —
              jobs are written only via Trigger Sync below; there is no
              single-job create/edit/publish workflow.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {syncStatus.isLoading ? null : (
              <StatusBadge
                variant={isSyncRunning ? 'degraded' : 'healthy'}
                label={isSyncRunning ? 'Sync running' : 'Sync idle'}
              />
            )}
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              Refresh
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="max-w-sm flex-1">
            <MasterDataSearch
              value={search}
              onChange={handleSearchChange}
              placeholder="Search by title, company, or location…"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="job-source-filter" className="text-xs font-medium text-muted-foreground">
              Source
            </label>
            <input
              id="job-source-filter"
              type="text"
              value={source}
              onChange={(e) => handleSourceChange(e.target.value)}
              placeholder="e.g. json, csv"
              className="h-10 w-40 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {isError ? (
          <div className="rounded-xl border border-border">
            <MasterDataErrorState error={error} onRetry={() => refetch()} entityLabelPlural="jobs" />
          </div>
        ) : (
          <>
            <MasterDataTable
              columns={JOB_COLUMNS}
              rows={jobs}
              rowActions={rowActions}
              isLoading={isLoading}
              emptyState={emptyState}
              getRowLabel={(job) => job.title}
            />
            <MasterDataPagination
              offset={offset}
              limit={PAGE_SIZE}
              total={total}
              currentPageCount={jobs.length}
              onOffsetChange={setOffset}
              isLoading={isFetching}
            />
          </>
        )}

        <JobSyncPanel syncStatus={syncStatus} syncLogs={syncLogs} />
      </div>
    </PageShell>
  );
}
