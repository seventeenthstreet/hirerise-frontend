/**
 * components/master-data/MasterDataLoadingState.tsx
 *
 * Loading placeholder for non-table contexts — e.g. the edit drawer while
 * a skill's detail is being fetched. Table loading uses MasterDataTable's
 * own skeleton rows instead of this component.
 */

import { Skeleton } from '@/components/ui';

interface MasterDataLoadingStateProps {
  label?: string;
  rows?: number;
}

export function MasterDataLoadingState({ label = 'Loading…', rows = 4 }: MasterDataLoadingStateProps) {
  return (
    <div className="flex flex-col gap-3 px-1 py-2" role="status" aria-label={label}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}
