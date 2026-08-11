/**
 * components/admin-dashboard/StatusBadge.tsx
 *
 * Small status pill used across dashboard cards and widgets.
 *
 * WP-ADMIN-03 Phase 2 — Enterprise Dashboard.
 *
 * Variants map to the same semantics used elsewhere in the app (healthy /
 * degraded / down from SystemHealthResponse) plus two dashboard-specific
 * states:
 *  - 'unavailable' — backing API/data does not exist yet. Never a color
 *    implying success or failure; a neutral, factual label.
 *  - 'coming-soon' — route exists but the page behind it is a placeholder
 *    stub (e.g. CmsPage). Never invents functionality, just labels it.
 *
 * Intentionally lightweight — no new design tokens, reuses existing
 * border/bg/text utility classes already used across the admin shell.
 */

export type StatusBadgeVariant =
  | 'healthy'
  | 'degraded'
  | 'down'
  | 'unavailable'
  | 'coming-soon'
  | 'neutral';

const VARIANT_CLASSES: Record<StatusBadgeVariant, string> = {
  healthy:      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  degraded:     'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  down:         'bg-destructive/10 text-destructive',
  unavailable:  'bg-muted text-muted-foreground',
  'coming-soon': 'bg-primary/10 text-primary',
  neutral:      'bg-muted text-muted-foreground',
};

const VARIANT_LABELS: Record<StatusBadgeVariant, string> = {
  healthy:      'Healthy',
  degraded:     'Degraded',
  down:         'Down',
  unavailable:  'Unavailable',
  'coming-soon': 'Coming Soon',
  neutral:      '',
};

interface StatusBadgeProps {
  variant: StatusBadgeVariant;
  /** Overrides the default label text for the variant. */
  label?: string;
  className?: string;
}

export function StatusBadge({ variant, label, className = '' }: StatusBadgeProps) {
  const text = label ?? VARIANT_LABELS[variant];

  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-4',
        VARIANT_CLASSES[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {text}
    </span>
  );
}
