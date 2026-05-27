'use client';

/**
 * components/app-shell/AppNavItem.tsx
 *
 * Single navigation item in the app sidebar.
 * Highlights the active route via usePathname().
 *
 * Does NOT own:
 *  - sidebar open/close state
 *  - navigation data (caller passes items)
 *  - auth logic
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export interface NavItemDef {
  label: string;
  href: string;
  /** Icon node — any SVG or lucide element. */
  icon?: ReactNode;
  /** Badge count (notifications, etc). */
  badge?: number;
  /** If true, active match is exact (default: prefix match). */
  exact?: boolean;
  /** Insertion point for future AI/notification slots. */
  slot?: 'default' | 'bottom';
}

interface AppNavItemProps extends NavItemDef {
  /** Collapse to icon-only (sidebar collapsed mode). */
  iconOnly?: boolean;
  onClick?: () => void;
}

export function AppNavItem({
  label,
  href,
  icon,
  badge,
  exact = false,
  iconOnly = false,
  onClick,
}: AppNavItemProps) {
  const pathname = usePathname();
  const isActive = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(href + '/');

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={[
        'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        iconOnly ? 'justify-center px-2' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {icon && (
        <span
          className={[
            'flex h-5 w-5 shrink-0 items-center justify-center',
            isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
          ].join(' ')}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}

      {!iconOnly && <span className="truncate">{label}</span>}

      {!iconOnly && badge != null && badge > 0 && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}