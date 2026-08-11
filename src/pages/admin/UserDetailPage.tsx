/**
 * @file src/pages/admin/UserDetailPage.tsx
 * @description WP-ADMIN-04 Phase 1B — Enterprise User Directory detail view.
 * Profile fields (WP-ADMIN-04C) added below the original identity/account fields.
 * Administration placeholder section (WP-ADMIN-04D) added below Profile.
 * Manage Roles (WP-ADMIN-04E) is now the one functional Administration entry;
 * all other entries remain disabled "Coming Soon" placeholders.
 *
 * Route: /admin/users/:userId (unchanged)
 *
 * Rule (per WP-ADMIN-04 Phase 1B, reaffirmed by WP-ADMIN-04C): if the backend
 * returns a value, display it; otherwise display "Unavailable". Never infer
 * or derive a value client-side — authenticationProvider, accountStatus,
 * mfaStatus, and lastLogin remain `null` from the API because no existing
 * backend capability exposes them, and WP-ADMIN-04C explicitly keeps
 * Supabase Admin Auth lookups out of scope. userType, careerGoal,
 * targetRole, experienceYears, industry, location, and updatedAt are new in
 * WP-ADMIN-04C, sourced from pre-existing public.users columns, and follow
 * the same null-→-"Unavailable" contract.
 *
 * WP-ADMIN-04D — Administration section is presentation-only: every entry
 * uses StatusBadge's existing 'coming-soon' variant (see
 * components/admin-dashboard/StatusBadge.tsx, already used this way on
 * CmsPage per that component's own doc comment) and a disabled Button.
 *
 * WP-ADMIN-04E — RoleManagementRow replaces the "Manage Roles" placeholder
 * with a real Current Role / role selector / Save flow, wired to
 * useUpdateAdminUserRole(). Success/error feedback reuses
 * MasterDataStatusBanner (the same banner SkillsPage already uses for its
 * create/update mutations) — no new notification component. The <select>
 * reuses MasterDataForm's existing `inputClassName()` styling convention so
 * it looks identical to every other admin form field in the app.
 *
 * WP-ADMIN-COMP-04 — three more Administration entries become functional:
 *   - Edit Profile: an inline form (ProfileEditForm) over the same
 *     application-level public.users fields already shown read-only on the
 *     Profile card, wired to useUpdateAdminUserProfile().
 *   - Enable/Disable Account (AccountStatusRow): the single account-status
 *     mutation this codebase supports, backed by Supabase Auth's
 *     banned_until (see adminUsers.repository.js). Reuses the same
 *     confirm-dialog chrome as
 *     components/administrators/AdministratorLifecycleConfirmDialog.tsx.
 *     There is no separate "Lock Account" action — see that repository
 *     file's doc comment and the WP-ADMIN-COMP-04 Completion Report for
 *     why a second status concept was not built.
 *   - View Audit History (AuditHistorySection): a read-only list from the
 *     existing admin_logs table via useAdminUserAuditHistory().
 * Reset Password, Reset MFA, and Session Management remain disabled
 * "Coming Soon" placeholders — the Repository Reconciliation found no
 * password-reset flow, no user-facing MFA system, and no session-listing
 * capability anywhere in this codebase to build on.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, PageShell, Spinner, Button } from '@/components/ui';
import { MasterDataErrorState, MasterDataStatusBanner, type MasterDataStatus } from '@/components/master-data';
import { StatusBadge } from '@/components/admin-dashboard';
import {
  useAdminUserDetail,
  useUpdateAdminUserRole,
  useUpdateAdminUserProfile,
  useUpdateAdminUserAccountStatus,
  useAdminUserAuditHistory,
} from '@/hooks/admin/useAdminUsers';
import {
  ADMIN_USER_ROLES,
  type AdminUserRole,
  type AdminUserDetail,
  type AdminUserAccountAction,
} from '@/lib/api/adminUsers';
import { isApiClientError } from '@/lib/api/core';
import { ROUTES, adminPermissionAssignmentsPath } from '@/routes/routes.constants';

const ROLE_LABELS: Record<string, string> = {
  user: 'User',
  admin: 'Admin',
  super_admin: 'Super Admin',
  MASTER_ADMIN: 'Master Admin',
  contributor: 'Contributor',
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Formats a numeric years-of-experience value for display; null stays null (renders "Unavailable"). */
function formatExperience(years: number | null): string | null {
  if (years === null) return null;
  return `${years} ${years === 1 ? 'year' : 'years'}`;
}

/** Renders a value, or "Unavailable" (muted, italic) when the field is null. */
function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">
        {value === null || value === '' ? (
          <span className="italic text-muted-foreground">Unavailable</span>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

/**
 * WP-ADMIN-COMP-04 — 'Edit Profile' is now functional (ProfileEditForm,
 * defined below) and rendered in its original position, so it is removed
 * from this placeholder list rather than duplicated. 'Manage Roles' was
 * already excluded the same way in WP-ADMIN-04E.
 *
 * Reset Password, Reset MFA, and Session Management remain placeholders —
 * per the WP-ADMIN-COMP-04 Repository Reconciliation, this codebase has no
 * password-reset flow (self-service or admin), no user-facing MFA system,
 * and no session-listing capability to build any of these three on. 'Lock
 * Account' also remains a placeholder — Supabase Auth's banned_until is
 * this codebase's only authoritative account-status mechanism, and
 * Enable/Disable Account (AccountStatusRow, below) is that mechanism, so a
 * separate Lock action would only be a second, redundant control over the
 * same underlying state. Labels only; no route, permission, or backend
 * capability is implied to exist yet by these entries.
 */
const ADMIN_ACTIONS_AFTER_STATUS = ['Reset Password', 'Reset MFA', 'Lock Account', 'Session Management'] as const;

/**
 * A single non-interactive Administration row: label + StatusBadge
 * ('coming-soon' variant, same one CmsPage already uses) + a disabled
 * Button for visual consistency with the rest of the admin console's
 * button patterns. No onClick — this component performs no action.
 */
function AdministrationRow({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-2 border-b border-border py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <StatusBadge variant="coming-soon" />
      </div>
      <Button type="button" variant="outline" size="sm" disabled>
        {label}
      </Button>
    </div>
  );
}

/**
 * WP-ADMIN-04F-09 — 'Manage Permissions' is now functional: it links to
 * the Permission Assignment UI, pre-filtered to this user as principal
 * (adminPermissionAssignmentsPath(userId)). This is the only change this
 * WP makes to UserDetailPage.tsx — everything else on this certified page
 * (Profile fields, Manage Roles, every other Administration placeholder)
 * is untouched. No role/permission logic lives here — navigating to the
 * Assignment UI is all this row does; the Assignment UI itself owns
 * fetching and rendering that user's actual Assignments.
 */
function PermissionsManagementRow({ userId }: { userId: string }) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-2 border-b border-border py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">Manage Permissions</span>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => navigate(adminPermissionAssignmentsPath(userId))}
      >
        Manage Permissions
      </Button>
    </div>
  );
}

// Mirrors MasterDataForm.tsx's private inputClassName() convention (not
// exported from that file, so reproduced here rather than modifying a
// certified file to export an internal helper) so this <select> looks
// identical to every other admin form field in the app.
const SELECT_CLASSNAME =
  'h-10 w-full max-w-xs rounded-lg border border-border bg-background px-3 text-sm text-foreground ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

/**
 * WP-ADMIN-04E — Current Role → role selector → Save. The only functional
 * entry in the Administration section; every other row remains a disabled
 * placeholder. Reuses useUpdateAdminUserRole() (React Query mutation),
 * ADMIN_USER_ROLES (mirrors the backend's ROLES / users_role_check), and
 * MasterDataStatusBanner for success/error feedback (same banner
 * SkillsPage's own create/update mutations use).
 */
function RoleManagementRow({ userId, currentRole }: { userId: string; currentRole: string }) {
  const [selectedRole, setSelectedRole] = useState<string>(currentRole);
  const [status, setStatus] = useState<MasterDataStatus | null>(null);
  const updateRole = useUpdateAdminUserRole();

  const isValidRole = (ADMIN_USER_ROLES as readonly string[]).includes(selectedRole);
  const isUnchanged = selectedRole === currentRole;

  function handleSave() {
    if (!isValidRole || isUnchanged) return;

    setStatus(null);
    updateRole.mutate(
      { userId, role: selectedRole as AdminUserRole },
      {
        onSuccess: () => {
          setStatus({ kind: 'success', message: `Role updated to "${ROLE_LABELS[selectedRole] ?? selectedRole}".` });
        },
        onError: (err) => {
          const message =
            isApiClientError(err) && err.category === 'auth'
              ? 'You cannot change your own role.'
              : isApiClientError(err) && err.category === 'validation'
                ? 'That role is not valid.'
                : isApiClientError(err) && err.category === 'not_found'
                  ? 'This user could not be found.'
                  : 'Could not update the role. Please try again.';
          setStatus({ kind: 'error', message });
        },
      }
    );
  }

  return (
    <div className="flex flex-col gap-3 border-b border-border py-3 last:border-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Manage Roles</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Current: {ROLE_LABELS[currentRole] ?? currentRole}</span>
          <select
            aria-label="Select role"
            value={selectedRole}
            onChange={(e) => {
              setStatus(null);
              setSelectedRole(e.target.value);
            }}
            className={SELECT_CLASSNAME}
            disabled={updateRole.isPending}
          >
            {ADMIN_USER_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role] ?? role}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={isUnchanged || !isValidRole || updateRole.isPending}
          >
            {updateRole.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
      {status && <MasterDataStatusBanner status={status} onDismiss={() => setStatus(null)} />}
    </div>
  );
}

// Mirrors MasterDataForm.tsx's inputClassName() precedent, non-multiline
// variant — same reuse rationale as SELECT_CLASSNAME above.
const TEXT_INPUT_CLASSNAME =
  'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground ' +
  'placeholder:text-muted-foreground ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

interface ProfileFormState {
  displayName: string;
  careerGoal: string;
  targetRole: string;
  experienceYears: string;
  industry: string;
  location: string;
}

function toFormState(user: AdminUserDetail): ProfileFormState {
  return {
    displayName: user.displayName ?? '',
    careerGoal: user.careerGoal ?? '',
    targetRole: user.targetRole ?? '',
    experienceYears: user.experienceYears === null ? '' : String(user.experienceYears),
    industry: user.industry ?? '',
    location: user.location ?? '',
  };
}

/**
 * WP-ADMIN-COMP-04 — Edit Profile. A plain inline form (no MasterDataForm
 * reuse — that component is schema-driven for the CMS entities and doesn't
 * fit a fixed six-field form well) over exactly the application-level
 * public.users columns adminUsers.repository.js's PROFILE_FIELDS allows,
 * wired to useUpdateAdminUserProfile(). Empty string is sent as `null`
 * (clearing the field), matching the backend's `optional({ nullable: true })`
 * validators — see adminUsers.routes.js.
 */
function ProfileEditForm({ user }: { user: AdminUserDetail }) {
  const [form, setForm] = useState<ProfileFormState>(() => toFormState(user));
  const [status, setStatus] = useState<MasterDataStatus | null>(null);
  const updateProfile = useUpdateAdminUserProfile();

  // Keep the form in sync if the user record changes underneath it (e.g.
  // after a role change refetch) and no edit is in flight.
  useEffect(() => {
    if (!updateProfile.isPending) setForm(toFormState(user));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, user.updatedAt]);

  function handleChange(field: keyof ProfileFormState, value: string) {
    setStatus(null);
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSave() {
    setStatus(null);

    const experienceYears = form.experienceYears.trim() === '' ? null : Number(form.experienceYears);
    if (experienceYears !== null && (Number.isNaN(experienceYears) || experienceYears < 0 || experienceYears > 80)) {
      setStatus({ kind: 'error', message: 'Experience must be a number of years between 0 and 80.' });
      return;
    }

    updateProfile.mutate(
      {
        userId: user.id,
        fields: {
          displayName: form.displayName.trim(),
          careerGoal: form.careerGoal.trim() === '' ? null : form.careerGoal.trim(),
          targetRole: form.targetRole.trim() === '' ? null : form.targetRole.trim(),
          experienceYears,
          industry: form.industry.trim() === '' ? null : form.industry.trim(),
          location: form.location.trim() === '' ? null : form.location.trim(),
        },
      },
      {
        onSuccess: () => setStatus({ kind: 'success', message: 'Profile updated.' }),
        onError: (err) => {
          const message =
            isApiClientError(err) && err.category === 'not_found'
              ? 'This user could not be found.'
              : isApiClientError(err) && err.category === 'validation'
                ? 'One or more fields are invalid. Please check the values and try again.'
                : 'Could not update the profile. Please try again.';
          setStatus({ kind: 'error', message });
        },
      }
    );
  }

  const fields: Array<{ key: keyof ProfileFormState; label: string; maxLength: number }> = [
    { key: 'displayName', label: 'Display Name', maxLength: 200 },
    { key: 'careerGoal', label: 'Career Goal', maxLength: 500 },
    { key: 'targetRole', label: 'Target Role', maxLength: 200 },
    { key: 'industry', label: 'Industry', maxLength: 200 },
    { key: 'location', label: 'Location', maxLength: 200 },
  ];

  return (
    <div className="flex flex-col gap-3 border-b border-border py-3 last:border-0">
      <span className="text-sm font-medium text-foreground">Edit Profile</span>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map(({ key, label, maxLength }) => (
          <div key={key} className="flex flex-col gap-1.5">
            <label htmlFor={`profile-${key}`} className="text-sm font-medium text-muted-foreground">
              {label}
            </label>
            <input
              id={`profile-${key}`}
              type="text"
              value={form[key]}
              maxLength={maxLength}
              onChange={(e) => handleChange(key, e.target.value)}
              className={TEXT_INPUT_CLASSNAME}
              disabled={updateProfile.isPending}
            />
          </div>
        ))}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="profile-experienceYears" className="text-sm font-medium text-muted-foreground">
            Experience (years)
          </label>
          <input
            id="profile-experienceYears"
            type="number"
            min={0}
            max={80}
            step={0.5}
            value={form.experienceYears}
            onChange={(e) => handleChange('experienceYears', e.target.value)}
            className={TEXT_INPUT_CLASSNAME}
            disabled={updateProfile.isPending}
          />
        </div>
      </div>
      <div className="flex items-center justify-end">
        <Button type="button" variant="primary" size="sm" onClick={handleSave} disabled={updateProfile.isPending}>
          {updateProfile.isPending ? 'Saving…' : 'Save Profile'}
        </Button>
      </div>
      {status && <MasterDataStatusBanner status={status} onDismiss={() => setStatus(null)} />}
    </div>
  );
}

/**
 * WP-ADMIN-COMP-04 — confirmation dialog for Enable/Disable Account.
 * Modeled directly on
 * components/administrators/AdministratorLifecycleConfirmDialog.tsx's
 * chrome (overlay, focus trap, ESC-to-cancel, button layout) rather than
 * introducing new dialog mechanics, since the shape is identical and only
 * the copy/severity differs.
 */
function AccountStatusConfirmDialog({
  isOpen,
  action,
  userLabel,
  isSubmitting,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  action: AdminUserAccountAction | null;
  userLabel: string;
  isSubmitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    panelRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen || !action) return null;

  const isDisable = action === 'disable';
  const title = isDisable ? 'Disable this account?' : 'Enable this account?';
  const body = isDisable
    ? `${userLabel} will immediately lose access — this signs them out of every active session and blocks future sign-in. This is reversible; you can enable the account again later.`
    : `${userLabel} will regain sign-in access immediately.`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" onClick={() => !isSubmitting && onCancel()} />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="account-status-confirm-title"
        aria-describedby="account-status-confirm-desc"
        tabIndex={-1}
        className="relative w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-xl focus:outline-none"
      >
        <h2 id="account-status-confirm-title" className="text-base font-semibold text-foreground">
          {title}
        </h2>
        <p id="account-status-confirm-desc" className="mt-2 text-sm text-muted-foreground">
          {body}
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" size="md" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={isDisable ? 'destructive' : 'primary'}
            size="md"
            onClick={onConfirm}
            isLoading={isSubmitting}
          >
            {isDisable ? 'Disable' : 'Enable'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * WP-ADMIN-COMP-04 — Enable/Disable Account. Backed by Supabase Auth's
 * banned_until (see adminUsers.repository.js#setAccountStatus). Renders
 * whichever of Enable/Disable is the valid next action for the current
 * accountStatus, rather than both buttons at once — accountStatus is
 * `null` (Unavailable) when this user has no corresponding Supabase Auth
 * record, in which case neither action is offered.
 */
function AccountStatusRow({ user }: { user: AdminUserDetail }) {
  const [pendingAction, setPendingAction] = useState<AdminUserAccountAction | null>(null);
  const [status, setStatus] = useState<MasterDataStatus | null>(null);
  const updateStatus = useUpdateAdminUserAccountStatus();

  const label = user.displayName || user.email;
  const nextAction: AdminUserAccountAction | null =
    user.accountStatus === 'disabled' ? 'enable' : user.accountStatus === 'active' ? 'disable' : null;

  function handleConfirm() {
    if (!pendingAction) return;
    setStatus(null);
    updateStatus.mutate(
      { userId: user.id, action: pendingAction },
      {
        onSuccess: (updated) => {
          setStatus({
            kind: 'success',
            message: updated.accountStatus === 'disabled' ? 'Account disabled.' : 'Account enabled.',
          });
          setPendingAction(null);
        },
        onError: (err) => {
          const message =
            isApiClientError(err) && err.category === 'auth'
              ? 'You cannot change your own account status.'
              : isApiClientError(err) && err.category === 'not_found'
                ? 'This user has no corresponding authentication record; account status cannot be changed.'
                : 'Could not update the account status. Please try again.';
          setStatus({ kind: 'error', message });
          setPendingAction(null);
        },
      }
    );
  }

  return (
    <div className="flex flex-col gap-2 border-b border-border py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">
          {user.accountStatus === 'disabled' ? 'Enable Account' : 'Disable Account'}
        </span>
        <span className="text-sm text-muted-foreground">
          Status: {user.accountStatus === null ? 'Unavailable' : user.accountStatus === 'disabled' ? 'Disabled' : 'Active'}
        </span>
      </div>
      <div className="flex flex-col items-end gap-2">
        <Button
          type="button"
          variant={nextAction === 'disable' ? 'destructive' : 'primary'}
          size="sm"
          onClick={() => nextAction && setPendingAction(nextAction)}
          disabled={!nextAction || updateStatus.isPending}
        >
          {nextAction === 'disable' ? 'Disable Account' : nextAction === 'enable' ? 'Enable Account' : 'Unavailable'}
        </Button>
        {status && <MasterDataStatusBanner status={status} onDismiss={() => setStatus(null)} />}
      </div>
      <AccountStatusConfirmDialog
        isOpen={pendingAction !== null}
        action={pendingAction}
        userLabel={label}
        isSubmitting={updateStatus.isPending}
        onConfirm={handleConfirm}
        onCancel={() => !updateStatus.isPending && setPendingAction(null)}
      />
    </div>
  );
}

/**
 * WP-ADMIN-COMP-04 — View User Audit History. Read-only list sourced from
 * the existing admin_logs table (see adminUsers.repository.js#listAuditHistory).
 * Rendered as its own card below Administration, not as a row inside it,
 * since a history list doesn't fit the label+action row shape every other
 * Administration entry uses.
 */
function AuditHistorySection({ userId }: { userId: string }) {
  const { data, isLoading, isError, error, refetch } = useAdminUserAuditHistory(userId);

  return (
    <Card>
      <CardContent>
        <h2 className="mb-2 text-sm font-semibold text-foreground">User Audit History</h2>
        {isLoading && (
          <div className="flex items-center justify-center p-6">
            <Spinner />
          </div>
        )}
        {isError && <MasterDataErrorState error={error} onRetry={() => refetch()} entityLabelPlural="audit events" />}
        {!isLoading && !isError && (
          data?.items.length ? (
            <ul className="flex flex-col">
              {data.items.map((event) => (
                <li
                  key={String(event.id ?? `${event.action}-${event.createdAt}`)}
                  className="flex flex-col gap-1 border-b border-border py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-sm font-medium text-foreground">{event.action}</span>
                  <span className="text-sm text-muted-foreground">{formatDateTime(event.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm italic text-muted-foreground">No audit history for this user yet.</p>
          )
        )}
      </CardContent>
    </Card>
  );
}

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const { data: user, isLoading, isError, error, refetch } = useAdminUserDetail(userId ?? null);

  return (
    <PageShell>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={() => navigate(ROUTES.ADMIN_USERS)}>
            ← Back to Users
          </Button>
        </div>

        <div>
          <h1 className="text-xl font-semibold text-foreground">User Detail</h1>
          <p className="mt-1 text-sm text-muted-foreground">Fields not yet available from the platform are shown as "Unavailable".</p>
        </div>

        {isLoading && (
          <Card className="flex items-center justify-center p-12">
            <Spinner />
          </Card>
        )}

        {isError && (
          <Card>
            <MasterDataErrorState error={error} onRetry={() => refetch()} entityLabelPlural="users" />
          </Card>
        )}

        {!isLoading && !isError && user && (
          <div className="flex flex-col gap-6">
            <Card>
              <CardContent>
                <h2 className="mb-2 text-sm font-semibold text-foreground">Identity</h2>
                <dl>
                  <Field label="User ID" value={user.id} />
                  <Field label="Email" value={user.email} />
                  <Field label="Display Name" value={user.displayName} />
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <h2 className="mb-2 text-sm font-semibold text-foreground">Account</h2>
                <dl>
                  <Field label="Role" value={ROLE_LABELS[user.role] ?? user.role} />
                  <Field label="User Type" value={user.userType} />
                  <Field label="Created Date" value={formatDateTime(user.createdAt)} />
                  <Field label="Updated Date" value={user.updatedAt ? formatDateTime(user.updatedAt) : null} />
                  <Field label="Authentication Provider" value={user.authenticationProvider} />
                  <Field label="Account Status" value={user.accountStatus} />
                  <Field label="MFA Status" value={user.mfaStatus} />
                  <Field label="Last Login" value={user.lastLogin} />
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <h2 className="mb-2 text-sm font-semibold text-foreground">Profile</h2>
                <dl>
                  <Field label="Career Goal" value={user.careerGoal} />
                  <Field label="Target Role" value={user.targetRole} />
                  <Field label="Experience" value={formatExperience(user.experienceYears)} />
                  <Field label="Industry" value={user.industry} />
                  <Field label="Location" value={user.location} />
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <h2 className="mb-2 text-sm font-semibold text-foreground">Administration</h2>
                <p className="mb-3 text-sm text-muted-foreground">
                  Reset Password, Reset MFA, Lock Account, and Session Management are not yet supported by the
                  platform and will be introduced in later certified work packages, if the underlying capability
                  becomes available.
                </p>
                <div>
                  <ProfileEditForm user={user} />
                  <RoleManagementRow userId={user.id} currentRole={user.role} />
                  <PermissionsManagementRow userId={user.id} />
                  <AccountStatusRow user={user} />
                  {ADMIN_ACTIONS_AFTER_STATUS.map((action) => (
                    <AdministrationRow key={action} label={action} />
                  ))}
                </div>
              </CardContent>
            </Card>

            <AuditHistorySection userId={user.id} />
          </div>
        )}
      </div>
    </PageShell>
  );
}
