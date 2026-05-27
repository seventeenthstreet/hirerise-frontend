'use client';

/**
 * components/dashboard/layout/DashboardLayout.tsx
 *
 * Dashboard layout primitives.
 *
 * EXTRACTED FROM (Phase C):
 *  - dashboard/page.tsx: inline mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8
 *  - dashboard/page.tsx: inline header block
 *  - dashboard/page.tsx: inline grid patterns
 *
 * RESPONSIBILITIES:
 *  - Normalize dashboard spacing and max-width
 *  - Provide a composable section + grid + card structure
 *  - Support consistent widget placement
 *
 * DOES NOT OWN:
 *  - Data fetching
 *  - Widget business logic
 *  - Auth gating
 *  - Analytics widget implementations
 *
 * USAGE:
 *   <DashboardShell>
 *     <DashboardHeader title="Welcome back" subtitle="Your career snapshot" />
 *     <DashboardGrid cols={3}>
 *       <DashboardCard span={2}>
 *         <CHIScoreWidget ... />
 *       </DashboardCard>
 *       <DashboardCard>
 *         <ResumeScoreWidget ... />
 *       </DashboardCard>
 *     </DashboardGrid>
 *   </DashboardShell>
 */

import type { ReactNode } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD SHELL
// Max-width container + consistent page padding.
// Replaces the inline <div className="mx-auto max-w-7xl px-4 py-8..."> pattern.
// ─────────────────────────────────────────────────────────────────────────────

interface DashboardShellProps {
  children: ReactNode;
  className?: string;
}

export function DashboardShell({ children, className = '' }: DashboardShellProps) {
  return (
    <div className={`mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD HEADER
// Page-level heading + subtitle. Replaces inline <header> blocks.
// ─────────────────────────────────────────────────────────────────────────────

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  /** Optional right-side content (date range picker, CTA, etc). */
  actions?: ReactNode;
  className?: string;
}

export function DashboardHeader({ title, subtitle, actions, className = '' }: DashboardHeaderProps) {
  return (
    <header className={`mb-8 flex items-start justify-between gap-4 ${className}`}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="shrink-0">{actions}</div>
      )}
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD SECTION
// Groups related widgets with an optional section title.
// ─────────────────────────────────────────────────────────────────────────────

interface DashboardSectionProps {
  /** Optional section heading (e.g. "Career Health"). */
  title?: string;
  /** Optional section subtitle. */
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export function DashboardSection({ title, subtitle, children, className = '' }: DashboardSectionProps) {
  return (
    <section className={`mb-8 ${className}`}>
      {title && (
        <div className="mb-4">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD GRID
// Responsive widget grid. Replaces inline grid patterns.
// ─────────────────────────────────────────────────────────────────────────────

interface DashboardGridProps {
  /** Number of columns on desktop. Default: 3 */
  cols?: 1 | 2 | 3 | 4;
  /** Gap between cells. Default: 'md' */
  gap?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  className?: string;
}

const colsClass: Record<NonNullable<DashboardGridProps['cols']>, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
};

const gapClass: Record<NonNullable<DashboardGridProps['gap']>, string> = {
  sm: 'gap-4',
  md: 'gap-6',
  lg: 'gap-8',
};

export function DashboardGrid({
  cols = 3,
  gap = 'md',
  children,
  className = '',
}: DashboardGridProps) {
  return (
    <div className={`grid ${colsClass[cols]} ${gapClass[gap]} ${className}`}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD CARD
// Widget container with consistent border/shadow/padding.
// Optionally spans multiple grid columns.
// ─────────────────────────────────────────────────────────────────────────────

interface DashboardCardProps {
  /** Number of columns this card spans. Default: 1 */
  span?: 1 | 2 | 3;
  /** Disable default card padding (widget handles its own). */
  noPadding?: boolean;
  children: ReactNode;
  className?: string;
}

const spanClass: Record<NonNullable<DashboardCardProps['span']>, string> = {
  1: '',
  2: 'md:col-span-2',
  3: 'md:col-span-3',
};

export function DashboardCard({ span = 1, noPadding = false, children, className = '' }: DashboardCardProps) {
  return (
    <div
      className={[
        'rounded-xl border border-border bg-card shadow-sm',
        noPadding ? '' : 'p-5',
        spanClass[span],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}