/**
 * @file src/pages/admin/permissions/PermissionAssignmentsPage.tsx
 * @description WP-ADMIN-04F-09 — Enterprise Permission Management UI.
 *
 * Route: /admin/permissions/assignments
 * Optional query param: ?principalId=<uuid> — pre-selects a principal when
 * arriving from UserDetailPage's "Manage Permissions" row
 * (adminPermissionAssignmentsPath(userId)).
 *
 * Consumes only the certified Assignment Administration API
 * (assignAdminPermission / revokeAdminPermission /
 * getAdminAssignmentsForPrincipal, via hooks/admin/usePermissionsAdmin.ts).
 * No assignment logic lives here — "can this Permission be granted",
 * duplicate/lifecycle checks, etc. are all decided server-side; this page
 * only renders whatever the API returns and surfaces its errors.
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, PageShell } from '@/components/ui';
import { MasterDataStatusBanner, MasterDataEmptyState, MasterDataErrorState, type MasterDataStatus } from '@/components/master-data';
import { PrincipalPicker, AssignmentTable, RevokeConfirmDialog } from '@/components/permissions';
import { useAdminUserDetail } from '@/hooks/admin/useAdminUsers';
import {
  useAdminAssignmentsForPrincipal,
  useAssignAdminPermission,
  useRevokeAdminPermission,
  useAdminPermissionVocabulary,
} from '@/hooks/admin/usePermissionsAdmin';
import type { AdminPermissionAssignment } from '@/lib/api/adminPermissions';
import { isApiClientError } from '@/lib/api/core';
import type { AdminUserListItem } from '@/lib/api/adminUsers';

const selectClassName = [
  'h-10 rounded-lg border border-border bg-background px-3 text-sm',
  'text-foreground',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
].join(' ');

export default function PermissionAssignmentsPage() {
  const [searchParams] = useSearchParams();
  const deepLinkedPrincipalId = searchParams.get('principalId');

  // Explicit selection (via the picker's search) always wins. Until one is
  // made, and only when we arrived via ?principalId=, resolve that user's
  // display name so PrincipalPicker never shows a bare uuid when it
  // doesn't have to — disabled the moment an explicit pick is made.
  const [explicitPrincipal, setExplicitPrincipal] = useState<AdminUserListItem | null>(null);
  const { data: resolvedUser } = useAdminUserDetail(explicitPrincipal ? null : deepLinkedPrincipalId);

  const principal: AdminUserListItem | null = explicitPrincipal ?? resolvedUser ?? null;
  const principalId = principal?.id ?? deepLinkedPrincipalId ?? null;

  const [resource, setResource] = useState('');
  const [action, setAction] = useState('');
  const [status, setStatus] = useState<MasterDataStatus | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<AdminPermissionAssignment | null>(null);

  // WP-ADMIN-04F-13B — Registry-driven, assignable-only vocabulary. This
  // page never renders a Resource/Action combination the Registry
  // doesn't actually have, and never renders one the certified
  // Assignment Policy wouldn't currently allow (see the hook's own docs).
  const {
    vocabulary: permissionVocabulary,
    isLoading: isLoadingVocabulary,
    isError: isVocabularyError,
    error: vocabularyError,
    refetch: refetchVocabulary,
  } = useAdminPermissionVocabulary({ assignableOnly: true });

  const availableResources = permissionVocabulary.resources;
  const availableActions = resource ? permissionVocabulary.actionsForResource(resource) : [];
  const isRegistryEmpty = !isLoadingVocabulary && !isVocabularyError && availableResources.length === 0;

  function handleResourceChange(nextResource: string) {
    setResource(nextResource);
    // The certified Registry positions Action underneath Resource
    // (Phase 3's "administration" → view/create/delete example) — a
    // previously-selected Action almost never survives a Resource
    // change, so this never leaves an invalid combination selected.
    setAction('');
  }

  const {
    data: assignmentsData,
    isLoading: isLoadingAssignments,
    isError: isAssignmentsError,
    error: assignmentsError,
    refetch: refetchAssignments,
  } = useAdminAssignmentsForPrincipal(principalId);

  const assignMutation = useAssignAdminPermission();
  const revokeMutation = useRevokeAdminPermission();

  function describeError(err: unknown, fallback: string): string {
    if (!isApiClientError(err)) return fallback;
    switch (err.category) {
      case 'conflict':
        return 'This Permission is already assigned to that principal.';
      case 'not_found':
        return 'That principal or Permission could not be found.';
      case 'validation':
        return err.message || 'That assignment request is invalid.';
      case 'auth':
        return 'You are not authorized to make this change.';
      default:
        return fallback;
    }
  }

  function handleAssign() {
    if (!principalId || !resource || !action) return;
    setStatus(null);
    assignMutation.mutate(
      { principalId, resource, action },
      {
        onSuccess: () => {
          setStatus({ kind: 'success', message: `Assigned ${resource}:${action}.` });
          setResource('');
          setAction('');
        },
        onError: (err) => {
          setStatus({ kind: 'error', message: describeError(err, 'Could not assign this Permission. Please try again.') });
        },
      },
    );
  }

  function handleConfirmRevoke() {
    if (!pendingRevoke || !principalId) return;
    setStatus(null);
    revokeMutation.mutate(
      { principalId, resource: pendingRevoke.resource, action: pendingRevoke.action },
      {
        onSuccess: () => {
          setStatus({ kind: 'success', message: `Revoked ${pendingRevoke.permissionIdentity}.` });
          setPendingRevoke(null);
        },
        onError: (err) => {
          setStatus({ kind: 'error', message: describeError(err, 'Could not revoke this Permission. Please try again.') });
          setPendingRevoke(null);
        },
      },
    );
  }

  const assignments = assignmentsData?.assignments ?? [];

  return (
    <PageShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Permission Assignments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Grant or revoke Permissions for a principal. Every grant/revoke decision — including whether a
            Permission can currently be assigned — is made by the certified Assignment API, never in this UI.
          </p>
        </div>

        <Card>
          <CardContent>
            <PrincipalPicker
              value={principalId}
              onChange={(_id, user) => setExplicitPrincipal(user)}
              selectedUserFallbackLabel={principal?.displayName ?? principal?.email ?? deepLinkedPrincipalId ?? undefined}
            />
          </CardContent>
        </Card>

        {status && <MasterDataStatusBanner status={status} onDismiss={() => setStatus(null)} />}

        {principalId && (
          <>
            <Card>
              <CardContent>
                <h2 className="mb-3 text-sm font-semibold text-foreground">Assign a Permission</h2>
                {isVocabularyError ? (
                  <MasterDataErrorState error={vocabularyError} onRetry={() => refetchVocabulary()} entityLabelPlural="permissions" />
                ) : isRegistryEmpty ? (
                  <MasterDataEmptyState reason="no-records" entityLabelPlural="assignable permissions" />
                ) : (
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label htmlFor="assign-resource" className="mb-1 block text-xs font-medium text-muted-foreground">
                        Resource
                      </label>
                      <select
                        id="assign-resource"
                        className={selectClassName}
                        value={resource}
                        onChange={(e) => handleResourceChange(e.target.value)}
                        disabled={assignMutation.isPending || isLoadingVocabulary}
                      >
                        <option value="">{isLoadingVocabulary ? 'Loading resources…' : 'Select a resource'}</option>
                        {availableResources.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="assign-action" className="mb-1 block text-xs font-medium text-muted-foreground">
                        Action
                      </label>
                      <select
                        id="assign-action"
                        className={selectClassName}
                        value={action}
                        onChange={(e) => setAction(e.target.value)}
                        disabled={assignMutation.isPending || !resource}
                      >
                        <option value="">{resource ? 'Select an action' : 'Select a resource first'}</option>
                        {availableActions.map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={handleAssign}
                      disabled={!resource || !action || assignMutation.isPending}
                      className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {assignMutation.isPending ? 'Assigning…' : 'Assign'}
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>

            <div>
              <h2 className="mb-3 text-sm font-semibold text-foreground">Current Assignments</h2>
              {isAssignmentsError ? (
                <MasterDataErrorState error={assignmentsError} onRetry={() => refetchAssignments()} entityLabelPlural="assignments" />
              ) : (
                <AssignmentTable
                  assignments={assignments}
                  isLoading={isLoadingAssignments}
                  onRevoke={setPendingRevoke}
                  emptyState={
                    !isLoadingAssignments && assignments.length === 0 ? (
                      <MasterDataEmptyState reason="no-records" entityLabelPlural="assignments" />
                    ) : undefined
                  }
                />
              )}
            </div>
          </>
        )}

        <RevokeConfirmDialog
          isOpen={pendingRevoke !== null}
          permissionLabel={pendingRevoke?.permissionIdentity ?? ''}
          principalLabel={principal?.displayName ?? principal?.email ?? principalId ?? ''}
          isSubmitting={revokeMutation.isPending}
          onConfirm={handleConfirmRevoke}
          onCancel={() => setPendingRevoke(null)}
        />
      </div>
    </PageShell>
  );
}
