/**
 * components/master-data/MasterDataPagination.tsx
 *
 * Server-side offset pagination footer. Never simulates pagination
 * client-side — `total` and the current page's row count always come
 * from the backend response.
 */

import { Button } from '@/components/ui';

interface MasterDataPaginationProps {
  offset: number;
  limit: number;
  total: number;
  /** Number of rows actually returned for the current page. */
  currentPageCount: number;
  onOffsetChange: (nextOffset: number) => void;
  isLoading?: boolean;
}

export function MasterDataPagination({
  offset,
  limit,
  total,
  currentPageCount,
  onOffsetChange,
  isLoading = false,
}: MasterDataPaginationProps) {
  if (total === 0) return null;

  const start = total === 0 ? 0 : offset + 1;
  const end = offset + currentPageCount;
  const canPrevious = offset > 0;
  const canNext = offset + limit < total;

  return (
    <div
      className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row"
      aria-live="polite"
    >
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-foreground">{start}</span>–
        <span className="font-medium text-foreground">{end}</span> of{' '}
        <span className="font-medium text-foreground">{total}</span>
      </p>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canPrevious || isLoading}
          onClick={() => onOffsetChange(Math.max(0, offset - limit))}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canNext || isLoading}
          onClick={() => onOffsetChange(offset + limit)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
