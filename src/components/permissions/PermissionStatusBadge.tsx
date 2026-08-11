/**
 * components/permissions/PermissionStatusBadge.tsx
 *
 * Small status pill for a Permission's lifecycle status
 * (core/src/domain/permission/permission.constants.js's PERMISSION_STATUS,
 * 6 stages: proposed → approved → published → adopted → deprecated → retired).
 *
 * A new component, not a duplicate of components/admin-dashboard/StatusBadge —
 * that component's variants model system/API health and "coming soon"
 * placeholders, an unrelated domain to a Permission's lifecycle stage.
 * Copies StatusBadge's pill shape/CSS exactly (WP-ADMIN-04F-09 audit: no
 * new design tokens) so the two read as the same visual language.
 */

import type { PermissionStatus } from '@/lib/api/adminPermissions';

const VARIANT_CLASSES: Record<PermissionStatus, string> = {
  proposed:   'bg-muted text-muted-foreground',
  approved:   'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  published:  'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  adopted:    'bg-primary/10 text-primary',
  deprecated: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  retired:    'bg-destructive/10 text-destructive',
};

const VARIANT_LABELS: Record<PermissionStatus, string> = {
  proposed:   'Proposed',
  approved:   'Approved',
  published:  'Published',
  adopted:    'Adopted',
  deprecated: 'Deprecated',
  retired:    'Retired',
};

interface PermissionStatusBadgeProps {
  status: string;
  className?: string;
}

export function PermissionStatusBadge({ status, className = '' }: PermissionStatusBadgeProps) {
  const isKnown = (s: string): s is PermissionStatus => s in VARIANT_CLASSES;
  const variantClasses = isKnown(status) ? VARIANT_CLASSES[status] : 'bg-muted text-muted-foreground';
  const label = isKnown(status) ? VARIANT_LABELS[status] : status;

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
