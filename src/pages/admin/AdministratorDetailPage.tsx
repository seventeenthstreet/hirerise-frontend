/**
 * @file src/pages/admin/AdministratorDetailPage.tsx
 * @description WP-ADMIN-05A — Enterprise Administrator detail + lifecycle actions.
 *
 * Route: /admin/administrators/:uid
 *
 * Displays identity, lifecycle state, verification, audit summary, and
 * lifecycle history exactly as returned by the certified Administrator
 * Lifecycle repository (via administrators.service.js) — nothing here is
 * derived or inferred client-side.
 *
 * Lifecycle actions (Suspend/Reactivate/Revoke) are gated in this UI only
 * by the same from-state rules the certified state machine enforces
 * (adminLifecycle.states.js#ACTIONS) — purely to avoid offering a button
 * that would 409, never to allow anything the backend itself wouldn't.
 * Grant is offered whenever the principal is not already 'active' (its
 * `from` set is the widest — none|revoked|expired|suspended). The backend
 * is always the final authority: every mutation still goes through
 * useGrantAdministrator/useSuspendAdministrator/etc., which call the
 * server, which calls the certified repository.
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, PageShell, Spinner, Button } from '@/components/ui';
import { MasterDataErrorState, MasterDataStatusBanner, type MasterDataStatus } from '@/components/master-data';
import { AdministratorLifecycleConfirmDialog, type AdministratorLifecycleAction } from '@/components/administrators';
import {
  useAdministratorDetail,
  useGrantAdministrator,
  useSuspendAdministrator,
  useReactivateAdministrator,
  useRevokeAdministrator,
} from '@/hooks/admin/useAdministrators';
import { ADMINISTRATOR_ROLES, type AdministratorRole } from '@/lib/api/administrators';
import { isApiClientError } from '@/lib/api/core';
import { ROUTES } from '@/routes/routes.constants';
import { AdministratorStatusBadge } from './administrators.config';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  super_admin: 'Super Admin',
  MASTER_ADMIN: 'Master Admin',
};

// Mirrors domain/admin/lifecycle/adminLifecycle.states.js#ACTIONS exactly —
// UI-only pre-check so buttons aren't offered for a transition the
// certified state machine would reject with a 409. Never the actual
// authority; see file header.
const CAN_SUSPEND = new Set(['active']);
const CAN_REACTIVATE = new Set(['suspended']);
const CAN_REVOKE = new Set(['active', 'suspended']);
const CAN_GRANT = new Set(['suspended', 'revoked', 'expired']);

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">
        {value === null || value === '' ? <span className="italic text-muted-foreground">Unavailable</span> : value}
      </dd>
    </div>
  );
}

function describeError(err: unknown, fallback: string): string {
  if (!isApiClientError(err)) return fallback;
  switch (err.category) {
    case 'conflict':
      return 'That action is no longer available for this Administrator — their status may have just changed. Refresh and try again.';
    case 'not_found':
      return 'This Administrator could not be found.';
    case 'auth':
      return 'You are not authorized to make this change.';
    case 'validation':
      return err.message || 'That request is invalid.';
    default:
      return fallback;
  }
}

export default function AdministratorDetailPage() {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();

  const { data: administrator, isLoading, isError, error, refetch } = useAdministratorDetail(uid ?? null);

  const [status, setStatus] = useState<MasterDataStatus | null>(null);
  const [pendingAction, setPendingAction] = useState<AdministratorLifecycleAction | null>(null);
  const [grantRole, setGrantRole] = useState<AdministratorRole>('admin');

  const grantMutation = useGrantAdministrator();
  const suspendMutation = useSuspendAdministrator();
  const reactivateMutation = useReactivateAdministrator();
  const revokeMutation = useRevokeAdministrator();

  const isMutating =
    grantMutation.isPending || suspendMutation.isPending || reactivateMutation.isPending || revokeMutation.isPending;

  function handleGrant() {
    if (!uid) return;
    setStatus(null);
    grantMutation.mutate(
      { uid, role: grantRole },
      {
        onSuccess: () => setStatus({ kind: 'success', message: `Granted ${ROLE_LABELS[grantRole] ?? grantRole} access.` }),
        onError: (err) => setStatus({ kind: 'error', message: describeError(err, 'Could not grant access. Please try again.') }),
      },
    );
  }

  function handleConfirmLifecycleAction() {
    if (!uid || !pendingAction) return;
    setStatus(null);

    const onSettled = () => setPendingAction(null);

    if (pendingAction === 'suspend') {
      suspendMutation.mutate(
        { uid },
        {
          onSuccess: () => setStatus({ kind: 'success', message: 'Administrator suspended.' }),
          onError: (err) => setStatus({ kind: 'error', message: describeError(err, 'Could not suspend this Administrator.') }),
          onSettled,
        },
      );
    } else if (pendingAction === 'reactivate') {
      reactivateMutation.mutate(
        { uid },
        {
          onSuccess: () => setStatus({ kind: 'success', message: 'Administrator reactivated.' }),
          onError: (err) => setStatus({ kind: 'error', message: describeError(err, 'Could not reactivate this Administrator.') }),
          onSettled,
        },
      );
    } else if (pendingAction === 'revoke') {
      revokeMutation.mutate(
        { uid },
        {
          onSuccess: () => setStatus({ kind: 'success', message: 'Administrator revoked.' }),
          onError: (err) => setStatus({ kind: 'error', message: describeError(err, 'Could not revoke this Administrator.') }),
          onSettled,
        },
      );
    }
  }

  const administratorLabel = administrator?.displayName ?? administrator?.email ?? uid ?? '';

  return (
    <PageShell>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={() => navigate(ROUTES.ADMIN_ADMINISTRATORS)}>
            ← Back to Administrators
          </Button>
        </div>

        <div>
          <h1 className="text-xl font-semibold text-foreground">Administrator Detail</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lifecycle actions call the certified Administrator Lifecycle directly — every transition, audit event,
            and validity check is decided server-side.
          </p>
        </div>

        {status && <MasterDataStatusBanner status={status} onDismiss={() => setStatus(null)} />}

        {isLoading && (
          <Card className="flex items-center justify-center p-12">
            <Spinner />
          </Card>
        )}

        {isError && (
          <Card>
            <MasterDataErrorState error={error} onRetry={() => refetch()} entityLabelPlural="administrators" />
          </Card>
        )}

        {!isLoading && !isError && administrator && (
          <div className="flex flex-col gap-6">
            <Card>
              <CardContent>
                <div className="mb-2 flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-foreground">Identity</h2>
                  <AdministratorStatusBadge status={administrator.status} />
                </div>
                <dl>
                  <Field label="Administrator ID" value={administrator.uid} />
                  <Field label="Email" value={administrator.email} />
                  <Field label="Name" value={administrator.displayName} />
                  <Field label="Role" value={ROLE_LABELS[administrator.role] ?? administrator.role} />
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <h2 className="mb-2 text-sm font-semibold text-foreground">Lifecycle</h2>
                <dl>
                  <Field label="Granted By" value={administrator.grantedBy} />
                  <Field label="Granted At" value={formatDateTime(administrator.grantedAt)} />
                  <Field label="Verified At" value={formatDateTime(administrator.verifiedAt)} />
                  <Field label="Last Activity" value={formatDateTime(administrator.lastActionAt)} />
                  <Field label="Expires At" value={administrator.expiresAt ? formatDateTime(administrator.expiresAt) : null} />
                  {administrator.status === 'suspended' && (
                    <>
                      <Field label="Suspended By" value={administrator.suspendedBy} />
                      <Field label="Suspended At" value={formatDateTime(administrator.suspendedAt)} />
                      <Field label="Suspension Reason" value={administrator.suspensionReason} />
                    </>
                  )}
                  {administrator.status === 'revoked' && (
                    <>
                      <Field label="Revoked By" value={administrator.revokedBy} />
                      <Field label="Revoked At" value={formatDateTime(administrator.revokedAt)} />
                    </>
                  )}
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <h2 className="mb-3 text-sm font-semibold text-foreground">Lifecycle Actions</h2>
                <div className="flex flex-wrap items-center gap-3">
                  {CAN_GRANT.has(administrator.status) && (
                    <div className="flex items-center gap-2">
                      <select
                        aria-label="Role to grant"
                        value={grantRole}
                        onChange={(e) => setGrantRole(e.target.value as AdministratorRole)}
                        disabled={isMutating}
                        className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        {ADMINISTRATOR_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role] ?? role}
                          </option>
                        ))}
                      </select>
                      <Button type="button" variant="primary" size="sm" onClick={handleGrant} disabled={isMutating}>
                        {grantMutation.isPending ? 'Granting…' : 'Grant'}
                      </Button>
                    </div>
                  )}
                  {CAN_SUSPEND.has(administrator.status) && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setPendingAction('suspend')} disabled={isMutating}>
                      Suspend
                    </Button>
                  )}
                  {CAN_REACTIVATE.has(administrator.status) && (
                    <Button type="button" variant="primary" size="sm" onClick={() => setPendingAction('reactivate')} disabled={isMutating}>
                      Reactivate
                    </Button>
                  )}
                  {CAN_REVOKE.has(administrator.status) && (
                    <Button type="button" variant="destructive" size="sm" onClick={() => setPendingAction('revoke')} disabled={isMutating}>
                      Revoke
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <h2 className="mb-3 text-sm font-semibold text-foreground">Audit Summary</h2>
                {administrator.lifecycleHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No lifecycle events recorded yet.</p>
                ) : (
                  <ul className="flex flex-col gap-0">
                    {administrator.lifecycleHistory.map((event, idx) => (
                      <li
                        key={`${event.action}-${event.createdAt}-${idx}`}
                        className="flex flex-col gap-1 border-b border-border py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="text-sm font-medium text-foreground">{event.action}</span>
                        <span className="text-sm text-muted-foreground">
                          {event.actorId ?? 'system'} · {formatDateTime(event.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <AdministratorLifecycleConfirmDialog
          isOpen={pendingAction !== null}
          action={pendingAction}
          administratorLabel={administratorLabel}
          isSubmitting={isMutating}
          onConfirm={handleConfirmLifecycleAction}
          onCancel={() => setPendingAction(null)}
        />
      </div>
    </PageShell>
  );
}
