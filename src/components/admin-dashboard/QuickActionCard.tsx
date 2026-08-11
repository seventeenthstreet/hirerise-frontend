/**
 * components/admin-dashboard/QuickActionCard.tsx
 *
 * Shortcut card linking to an existing admin route (CMS, Jobs, Intelligence,
 * Graph, Weights, Master Data modules, AI Operations, ...).
 *
 * WP-ADMIN-03 Phase 2 — Enterprise Dashboard.
 *
 * NAVIGATION RULE: this component never links to a route that isn't
 * actually mounted in src/routes/index.tsx. If a module ever ships with no
 * route yet, the caller omits `href` and the card renders as a
 * non-interactive, visually disabled tile instead of a link that would
 * 404 — see "no orphan pages" in the WP-ADMIN-03 spec. As of WP-ADMIN-COMP-05
 * every Master Data and Administration module has a mounted page, so no
 * caller currently omits `href`; the disabled-tile path remains available
 * for any future module that ships its backend ahead of its admin page.
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { DashboardCard } from './DashboardCard';
import { StatusBadge, type StatusBadgeVariant } from './StatusBadge';

interface QuickActionCardProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  /** Destination route. Omit when the module has no mounted page yet. */
  href?: string;
  /** Optional badge, e.g. { variant: 'coming-soon' } for placeholder pages. */
  badge?: { variant: StatusBadgeVariant; label?: string };
}

export function QuickActionCard({ title, description, icon, href, badge }: QuickActionCardProps) {
  const content = (
    <DashboardCard
      title={title}
      icon={icon}
      trailing={badge && <StatusBadge variant={badge.variant} label={badge.label} />}
      className={href ? 'transition-colors hover:border-primary/40 hover:bg-accent/40' : 'opacity-60'}
    >
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {!href && (
        <p className="mt-2 text-xs text-muted-foreground/70">Not yet available</p>
      )}
    </DashboardCard>
  );

  if (!href) {
    return (
      <div aria-disabled="true" role="group" aria-label={`${title} (not yet available)`}>
        {content}
      </div>
    );
  }

  return (
    <Link to={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
      {content}
    </Link>
  );
}
