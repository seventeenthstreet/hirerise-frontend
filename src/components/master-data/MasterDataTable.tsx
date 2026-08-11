/**
 * components/master-data/MasterDataTable.tsx
 *
 * Reusable, configuration-driven table for every Master Data module.
 * Skills-specific concerns live entirely in the `columns` prop passed by
 * the caller — this component has no knowledge of skill fields.
 *
 * Handles: configurable columns, row actions, loading skeleton rows,
 * empty state passthrough, keyboard-accessible action buttons.
 * Pagination footer is a separate component (MasterDataPagination) so
 * callers can place it outside a scrolling table body on small screens.
 */

import { Skeleton } from '@/components/ui';
import type { MasterDataColumn, MasterDataRowAction } from './types';

interface MasterDataTableProps<T extends { id: string }> {
  columns: MasterDataColumn<T>[];
  rows: T[];
  rowActions?: MasterDataRowAction<T>[];
  isLoading?: boolean;
  /** Number of skeleton rows to show while loading. */
  skeletonRowCount?: number;
  /** Rendered instead of the table body when rows is empty and not loading. */
  emptyState?: React.ReactNode;
  getRowLabel?: (row: T) => string;
}

const alignClass = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

export function MasterDataTable<T extends { id: string }>({
  columns,
  rows,
  rowActions = [],
  isLoading = false,
  skeletonRowCount = 6,
  emptyState,
  getRowLabel,
}: MasterDataTableProps<T>) {
  const hasActions = rowActions.length > 0;

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={[
                  'px-4 py-3 font-medium text-muted-foreground',
                  alignClass[col.align ?? 'left'],
                  col.widthClassName ?? '',
                ].join(' ')}
              >
                {col.header}
              </th>
            ))}
            {hasActions && (
              <th scope="col" className="px-4 py-3 text-right font-medium text-muted-foreground">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>

        <tbody>
          {isLoading &&
            Array.from({ length: skeletonRowCount }).map((_, i) => (
              <tr key={`skeleton-${i}`} className="border-b border-border last:border-0">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <Skeleton className="h-4 w-full max-w-[160px]" />
                  </td>
                ))}
                {hasActions && (
                  <td className="px-4 py-3">
                    <Skeleton className="ml-auto h-4 w-16" />
                  </td>
                )}
              </tr>
            ))}

          {!isLoading &&
            rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-border last:border-0 hover:bg-muted/30 focus-within:bg-muted/30"
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 text-foreground ${alignClass[col.align ?? 'left']}`}>
                    {col.render(row)}
                  </td>
                ))}
                {hasActions && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {rowActions
                        .filter((action) => !action.hidden?.(row))
                        .map((action) => (
                          <button
                            key={action.key}
                            type="button"
                            onClick={() => action.onClick(row)}
                            aria-label={`${action.label}${getRowLabel ? `: ${getRowLabel(row)}` : ''}`}
                            className={[
                              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                              action.variant === 'destructive'
                                ? 'text-destructive hover:bg-destructive/10'
                                : 'text-primary hover:bg-primary/10',
                            ].join(' ')}
                          >
                            {action.label}
                          </button>
                        ))}
                    </div>
                  </td>
                )}
              </tr>
            ))}
        </tbody>
      </table>

      {!isLoading && rows.length === 0 && emptyState && (
        <div className="border-t border-border">{emptyState}</div>
      )}
    </div>
  );
}
