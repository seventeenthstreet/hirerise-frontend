/**
 * components/admin-dashboard/DashboardSection.tsx
 *
 * Section wrapper for the Enterprise Dashboard (Executive Overview,
 * AI Operations, Master Data, CMS, Operations, System Health, ...).
 *
 * WP-ADMIN-03 Phase 2 — Enterprise Dashboard.
 *
 * Purely structural — heading + optional description + optional trailing
 * slot (e.g. a "View all" link) above whatever content the caller passes
 * (typically a DashboardGrid).
 */

import type { ReactNode } from 'react';

interface DashboardSectionProps {
  title: string;
  description?: string;
  /** Right-aligned slot next to the heading (e.g. a link or badge). */
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function DashboardSection({
  title,
  description,
  trailing,
  children,
  className = '',
}: DashboardSectionProps) {
  return (
    <section className={`mb-8 ${className}`} aria-label={title}>
      <div className="mb-3 flex items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {trailing && <div className="shrink-0">{trailing}</div>}
      </div>
      {children}
    </section>
  );
}
