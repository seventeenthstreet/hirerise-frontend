import { cn } from '@/utils/cn';

// ─── Base pulse unit ──────────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-md bg-surface-100', className)} />
  );
}

// ─── Dashboard stat card skeleton ─────────────────────────────────────────────

export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border border-surface-100 bg-white p-5 shadow-card animate-pulse', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
      </div>
    </div>
  );
}

// ─── Intelligence / intel card skeleton ───────────────────────────────────────

export function IntelCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border border-surface-100 bg-white p-5 shadow-card animate-pulse overflow-hidden', className)}>
      <Skeleton className="h-1 w-full rounded-none absolute top-0 left-0" />
      <div className="flex items-start justify-between gap-3 mt-1">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
      </div>
      <Skeleton className="h-8 w-16 mt-3" />
      <Skeleton className="h-3 w-full mt-2" />
      <Skeleton className="h-3 w-3/4 mt-1" />
      <Skeleton className="h-4 w-20 mt-4 rounded-full" />
    </div>
  );
}

// ─── List row skeleton ────────────────────────────────────────────────────────

export function ListRowSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-surface-100 bg-white p-4 animate-pulse">
      <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-48" />
        <Skeleton className="h-3 w-28" />
      </div>
      <Skeleton className="h-6 w-20 rounded-full flex-shrink-0" />
      <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <ListRowSkeleton key={i} />
      ))}
    </div>
  );
}

// ─── Table skeleton ───────────────────────────────────────────────────────────

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-xl border border-surface-100 bg-white overflow-hidden animate-pulse">
      {/* Header */}
      <div className="flex gap-4 border-b border-surface-100 bg-surface-50 px-5 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className={cn('h-3', i === 0 ? 'w-32' : 'flex-1')} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 border-b border-surface-50 px-5 py-4 last:border-0">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className={cn('h-3.5', j === 0 ? 'w-36' : 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Form skeleton ────────────────────────────────────────────────────────────

export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-5 animate-pulse">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ))}
      <div className="flex gap-3 pt-2">
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-20 rounded-lg" />
      </div>
    </div>
  );
}

// ─── Profile skeleton ─────────────────────────────────────────────────────────

export function ProfileSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Avatar card */}
      <div className="rounded-xl border border-surface-100 bg-white p-5 shadow-card">
        <div className="flex items-start gap-5">
          <Skeleton className="h-16 w-16 rounded-2xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-5 w-20 rounded-full mt-1" />
          </div>
        </div>
      </div>
      {/* Form sections */}
      {[4, 3, 2].map((fields, i) => (
        <div key={i} className="rounded-xl border border-surface-100 bg-white p-5 shadow-card">
          <Skeleton className="h-4 w-36 mb-5" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {Array.from({ length: fields }).map((_, j) => (
              <div key={j} className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Dashboard page skeleton ──────────────────────────────────────────────────

export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Welcome banner */}
      <div className="rounded-2xl border border-surface-100 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-3.5 w-72" />
          </div>
          <Skeleton className="h-20 w-24 rounded-2xl flex-shrink-0 hidden sm:block" />
        </div>
      </div>
      {/* Stat row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <StatCardSkeleton key={i} />)}
      </div>
      {/* Intel cards */}
      <div>
        <Skeleton className="h-3 w-32 mb-4" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <StatCardSkeleton key={i} />)}
        </div>
      </div>
    </div>
  );
}

// ─── Resumes page skeleton ────────────────────────────────────────────────────

export function ResumesSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3.5 w-64" />
        </div>
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>
      {/* Upload zone */}
      <Skeleton className="h-44 w-full rounded-2xl" />
      {/* List */}
      <ListSkeleton rows={2} />
    </div>
  );
}
