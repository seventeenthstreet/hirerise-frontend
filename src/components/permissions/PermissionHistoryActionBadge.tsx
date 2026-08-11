/**
 * components/permissions/PermissionHistoryActionBadge.tsx
 *
 * WP-ADMIN-05D — Enterprise Permission Audit & Governance History.
 *
 * Small pill for one Permission audit action (the 7 certified actions
 * in permissionAudit.constants.js's ACTIONS — 2 Assignment + 5
 * Governance). Copies PermissionStatusBadge's pill shape/CSS exactly
 * (same "no new design tokens" convention that component's own header
 * documents) but is NOT that component reused: a Permission's
 * *lifecycle status* (proposed/approved/.../retired, a point-in-time
 * state) and an *audit action* (PERMISSION_APPROVED, an event that
 * happened) are different vocabularies with different value sets — the
 * Governance actions happen to share 5 names with 5 lifecycle statuses,
 * but PERMISSION_ASSIGNED and PERMISSION_REVOKED have no status
 * counterpart at all, so folding this into PermissionStatusBadge would
 * either crash on those two values or require it to secretly understand
 * two different domains.
 */

import type { PermissionHistoryAction } from '@/lib/api/adminPermissions';

const VARIANT_CLASSES: Record<PermissionHistoryAction, string> = {
  PERMISSION_ASSIGNED: 'bg-primary/10 text-primary',
  PERMISSION_REVOKED: 'bg-destructive/10 text-destructive',
  PERMISSION_APPROVED: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  PERMISSION_PUBLISHED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  PERMISSION_ADOPTED: 'bg-primary/10 text-primary',
  PERMISSION_DEPRECATED: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  PERMISSION_RETIRED: 'bg-destructive/10 text-destructive',
};

const VARIANT_LABELS: Record<PermissionHistoryAction, string> = {
  PERMISSION_ASSIGNED: 'Assigned',
  PERMISSION_REVOKED: 'Revoked',
  PERMISSION_APPROVED: 'Approved',
  PERMISSION_PUBLISHED: 'Published',
  PERMISSION_ADOPTED: 'Adopted',
  PERMISSION_DEPRECATED: 'Deprecated',
  PERMISSION_RETIRED: 'Retired',
};

interface PermissionHistoryActionBadgeProps {
  action: string;
  className?: string;
}

export function PermissionHistoryActionBadge({ action, className = '' }: PermissionHistoryActionBadgeProps) {
  const isKnown = (a: string): a is PermissionHistoryAction => a in VARIANT_CLASSES;
  const variantClasses = isKnown(action) ? VARIANT_CLASSES[action] : 'bg-muted text-muted-foreground';
  const label = isKnown(action) ? VARIANT_LABELS[action] : action;

  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-4',
        variantClasses,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {label}
    </span>
  );
}
