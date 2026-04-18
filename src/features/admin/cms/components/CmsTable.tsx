'use client';

// features/admin/cms/components/CmsTable.tsx
// Generic table shell reused by every CMS page.
// Callers pass typed columns + rows; this component owns toolbar, empty states, pagination.

import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export interface Column<T> {
  key:        string;
  label:      string;
  className?: string;
  hidden?:    'sm' | 'md' | 'lg'; // hide below this breakpoint
  render:     (row: T) => React.ReactNode;
}

interface CmsTableProps<T> {
  // Data
  data:          T[] | undefined;
  total:         number;
  page:          number;
  limit:         number;
  isLoading:     boolean;
  isError:       boolean;
  // Config
  columns:       Column<T>[];
  addLabel:      string;
  emptyMessage?: string;
  // State
  search:        string;
  filterSlot?:   React.ReactNode;  // extra filter controls (dropdowns etc.)
  // Callbacks
  onAdd:         () => void;
  onSearch:      (v: string) => void;
  onPageChange:  (p: number) => void;
}

const hiddenClass = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' };

export function CmsTable<T extends { id: string }>({
  data, total, page, limit, isLoading, isError,
  columns, addLabel, emptyMessage,
  search, filterSlot,
  onAdd, onSearch, onPageChange,
}: CmsTableProps<T>) {
  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[180px] flex-1">
          <Input
            placeholder="Search…"
            value={search}
            onChange={e => onSearch(e.target.value)}
          />
        </div>
        {filterSlot}
        <Button
          size="sm"
          onClick={onAdd}
          leftIcon={
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }
        >
          {addLabel}
        </Button>
      </div>

      {/* ── Table card ── */}
      <div className="overflow-hidden rounded-xl border border-surface-100 bg-white shadow-card">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : isError ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
              <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-surface-700">Failed to load data</p>
            <p className="text-xs text-surface-400">Check your connection and try again.</p>
          </div>
        ) : !data?.length ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-100">
              <svg className="h-5 w-5 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-surface-700">
                {search ? 'No results match your search' : (emptyMessage ?? 'No records yet')}
              </p>
              {!search && (
                <p className="mt-0.5 text-xs text-surface-400">
                  Click &quot;{addLabel}&quot; to add the first one.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 bg-surface-50">
                  {columns.map(col => (
                    <th
                      key={col.key}
                      className={cn(
                        'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-surface-500',
                        col.hidden && hiddenClass[col.hidden],
                        col.className,
                      )}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50">
                {data.map(row => (
                  <tr key={row.id} className="transition-colors hover:bg-surface-50/60">
                    {columns.map(col => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-4 py-3',
                          col.hidden && hiddenClass[col.hidden],
                          col.className,
                        )}
                      >
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {!!data?.length && total > limit && (
        <Pagination page={page} total={total} limit={limit} onChange={onPageChange} />
      )}
    </div>
  );
}