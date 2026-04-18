import { cn } from '@/utils/cn';

// ─── ErrorState ───────────────────────────────────────────────────────────────

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

export function ErrorState({
  title = 'Something went wrong',
  message = "We couldn't load this data. Please try again.",
  onRetry,
  className,
  compact = false,
}: ErrorStateProps) {
  if (compact) {
    return (
      <div className={cn('flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3', className)}>
        <span className="shrink-0 text-red-400">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </span>
        <p className="flex-1 text-sm text-red-600">{message}</p>
        {onRetry && (
          <button onClick={onRetry} className="shrink-0 text-sm font-semibold text-red-600 underline hover:text-red-700 transition-colors">
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col items-center justify-center rounded-2xl border border-red-100 bg-red-50 py-14 text-center px-6', className)}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-400">
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-red-700">{title}</h3>
      <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-red-500">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-5 inline-flex h-8 items-center justify-center rounded-lg border border-red-200 bg-white px-4 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors">
          Try again
        </button>
      )}
    </div>
  );
}

// ─── NetworkErrorBanner ───────────────────────────────────────────────────────

export function NetworkErrorBanner({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
      <span className="shrink-0 text-red-400">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
            d="M18.364 5.636a9 9 0 010 12.728m-3.536-3.536a4 4 0 010-5.656M6.343 6.343a9 9 0 000 12.728m3.536-3.536a4 4 0 000-5.656M12 12h.01" />
        </svg>
      </span>
      <p className="flex-1 text-sm text-red-600">
        <span className="font-semibold">Network error</span> — check your connection and try again.
      </p>
      {onRetry && (
        <button onClick={onRetry} className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors">
          Retry
        </button>
      )}
    </div>
  );
}

// ─── QueryError ───────────────────────────────────────────────────────────────

function parseErrorMessage(error: unknown): string {
  if (!error) return 'An unexpected error occurred.';
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  const e = error as any;
  if (e?.message) return e.message;
  if (e?.status === 401) return 'You are not authorised to view this content.';
  if (e?.status === 403) return 'Access denied.';
  if (e?.status === 404) return 'This resource was not found.';
  if (e?.status >= 500) return 'Server error — our team has been notified.';
  return 'Something went wrong. Please try again.';
}

interface QueryErrorProps {
  error?: unknown;
  onRetry?: () => void;
  compact?: boolean;
  className?: string;
}

export function QueryError({ error, onRetry, compact, className }: QueryErrorProps) {
  return (
    <ErrorState
      message={parseErrorMessage(error)}
      onRetry={onRetry}
      compact={compact}
      className={className}
    />
  );
}