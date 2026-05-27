/**
 * components/ui/PageLoading.tsx — Shared full-page loading primitive.
 *
 * Composes: Spinner + centered layout (replaces ad-hoc implementations).
 *
 * REPLACES these inline patterns scattered across pages:
 *
 *   <div className="flex min-h-screen items-center justify-center bg-background">
 *     <div className="flex flex-col items-center gap-3">
 *       <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
 *       <p className="text-sm text-muted-foreground">Loading…</p>
 *     </div>
 *   </div>
 *
 * USAGE:
 *   // Full-page loading (loading.tsx files, hydration states)
 *   <PageLoading />
 *   <PageLoading label="Loading dashboard…" />
 *
 * Used by:
 *  - (auth)/loading.tsx — Next.js route loading boundary
 *  - Pages still in migration (incrementally replacing inline spinners)
 */

import { Spinner } from './Spinner';

interface PageLoadingProps {
  label?: string;
}

export function PageLoading({ label = 'Loading…' }: PageLoadingProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" label={label} />
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
