import { cn } from '@/utils/cn';

// ─── EmptyState ───────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-50 text-surface-300">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-surface-700">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-surface-400">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ─── LoadingSkeleton ──────────────────────────────────────────────────────────

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-surface-100', className)}
    />
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border border-surface-100 bg-white p-5 shadow-card', className)}>
      <Skeleton className="h-3 w-20 mb-3" />
      <Skeleton className="h-6 w-32 mb-2" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-xl border border-surface-100 bg-white p-4">
          <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ─── NoResumesEmpty ───────────────────────────────────────────────────────────
// Pre-configured empty state for the resume list page.

export function NoResumesEmpty({ onUpload }: { onUpload?: () => void }) {
  return (
    <EmptyState
      icon={
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      }
      title="No resumes yet"
      description="Upload a CV to unlock your Career Health Index, skill gap analysis, and salary benchmark."
      action={
        onUpload ? (
          <button
            onClick={onUpload}
            className="rounded-lg bg-hr-500 px-4 py-2 text-xs font-semibold text-white hover:bg-hr-600 transition-colors"
          >
            Upload Resume
          </button>
        ) : undefined
      }
    />
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-5">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ))}
      <Skeleton className="h-9 w-24 rounded-lg mt-2" />
    </div>
  );
}