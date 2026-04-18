// components/ui/Pagination.tsx
import { cn } from '@/utils/cn';
import { Button } from './Button';

interface PaginationProps {
  page:     number;
  total:    number;
  limit:    number;
  onChange: (page: number) => void;
}

export function Pagination({ page, total, limit, onChange }: PaginationProps) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  const from = (page - 1) * limit + 1;
  const to   = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between border-t border-surface-100 pt-4">
      <p className="text-sm text-surface-500">
        Showing <span className="font-medium text-surface-800">{from}–{to}</span> of{' '}
        <span className="font-medium text-surface-800">{total}</span> results
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </Button>
        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
          const p = i + 1;
          return (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={cn(
                'h-8 w-8 rounded-lg text-sm font-medium transition-colors',
                p === page
                  ? 'bg-hr-600 text-white'
                  : 'text-surface-600 hover:bg-surface-100',
              )}
            >
              {p}
            </button>
          );
        })}
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
