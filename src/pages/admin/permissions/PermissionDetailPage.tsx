/**
 * @file src/pages/admin/permissions/PermissionDetailPage.tsx
 * @description WP-ADMIN-04F-09 — Enterprise Permission Management UI.
 *
 * Route: /admin/permissions/registry/:identity
 *
 * Mirrors pages/admin/UserDetailPage.tsx's loading/error/detail structure.
 * Metadata rendering itself lives in components/permissions/PermissionDetailCard
 * (reused, not duplicated, in case a future page needs the same card).
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, PageShell, Spinner, Button } from '@/components/ui';
import { MasterDataErrorState, MasterDataEmptyState } from '@/components/master-data';
import { PermissionDetailCard, GovernanceActionPanel, PermissionHistoryTimeline } from '@/components/permissions';
import { useAdminPermissionDetail, useAdminPermissionHistory } from '@/hooks/admin/usePermissionsAdmin';
import { ROUTES, adminPermissionAssignmentsPath } from '@/routes/routes.constants';

const HISTORY_PAGE_LIMIT = 20;

export default function PermissionDetailPage() {
  const { identity: encodedIdentity } = useParams<{ identity: string }>();
  const identity = encodedIdentity ? decodeURIComponent(encodedIdentity) : null;
  const navigate = useNavigate();

  const { data: permission, isLoading, isError, error, refetch } = useAdminPermissionDetail(identity);

  // WP-ADMIN-05D — the History API is keyed by the Registry's internal
  // id (`GET /permissions/:id/history`), not the Identity this page's
  // own route uses — resolved server-side by the Integration Service,
  // so this page only needs `permission.id` once the detail has loaded.
  const [historyOffset, setHistoryOffset] = useState(0);

  // Resets pagination when navigating from one Permission's Detail page
  // to another (route param changes without unmounting this component) —
  // otherwise a deep offset from the previous Permission's timeline
  // would carry over and could request a page past the new Permission's
  // total.
  useEffect(() => {
    setHistoryOffset(0);
  }, [permission?.id]);

  const {
    data: historyData,
    isLoading: isLoadingHistory,
    isError: isHistoryError,
    error: historyError,
    refetch: refetchHistory,
  } = useAdminPermissionHistory(permission?.id ?? null, { limit: HISTORY_PAGE_LIMIT, offset: historyOffset });

  return (
    <PageShell>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={() => navigate(ROUTES.ADMIN_PERMISSIONS)}>
            ← Back to Permissions
          </Button>
        </div>

        <div>
          <h1 className="text-xl font-semibold text-foreground">Permission Detail</h1>
          <p className="mt-1 text-sm text-muted-foreground">Registry metadata and Governance Lifecycle actions for this Permission.</p>
        </div>

        {isLoading && (
          <Card className="flex items-center justify-center p-12">
            <Spinner />
          </Card>
        )}

        {isError && (
          <Card>
            <MasterDataErrorState error={error} onRetry={() => refetch()} entityLabelPlural="permissions" />
          </Card>
        )}

        {!isLoading && !isError && permission && (
          <div className="flex flex-col gap-4">
            <PermissionDetailCard permission={permission} />
            <GovernanceActionPanel permission={permission} />
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">
                To see or change who holds this Permission, open the{' '}
                <button
                  type="button"
                  onClick={() => navigate(adminPermissionAssignmentsPath())}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  Assignments
                </button>{' '}
                view.
              </p>
            </Card>

            <div>
              <h2 className="mb-3 text-sm font-semibold text-foreground">History</h2>
              <p className="mb-3 text-sm text-muted-foreground">
                Every Assignment and Governance change made to this Permission, most recent first.
              </p>
              {isHistoryError ? (
                <MasterDataErrorState error={historyError} onRetry={() => refetchHistory()} entityLabelPlural="history events" />
              ) : (
                <PermissionHistoryTimeline
                  events={historyData?.items ?? []}
                  isLoading={isLoadingHistory}
                  emptyState={
                    !isLoadingHistory && (historyData?.items.length ?? 0) === 0 ? (
                      <MasterDataEmptyState reason="no-records" entityLabelPlural="history events" />
                    ) : undefined
                  }
                  pagination={{
                    offset: historyOffset,
                    limit: HISTORY_PAGE_LIMIT,
                    total: historyData?.total ?? 0,
                    onOffsetChange: setHistoryOffset,
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
