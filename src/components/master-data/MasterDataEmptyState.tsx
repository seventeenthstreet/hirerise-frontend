/**
 * components/master-data/MasterDataEmptyState.tsx
 *
 * Distinct empty-state UI for the different "no rows" conditions
 * (WP-ADMIN-02A §21): no records at all, no search results, and
 * permission denied. "Unable to load" is a distinct error state,
 * handled by MasterDataErrorState instead.
 */

import { Button } from '@/components/ui';

type MasterDataEmptyReason = 'no-records' | 'no-search-results' | 'permission-denied';

interface MasterDataEmptyStateProps {
  reason: MasterDataEmptyReason;
  entityLabelPlural: string;
  searchTerm?: string;
  onClearSearch?: () => void;
  onCreate?: () => void;
  createLabel?: string;
  /**
   * Optional copy override for the 'no-records' reason, for entities that
   * don't support manual creation (e.g. Jobs, which is read-only and
   * populated only via sync). Defaults to the generic "creating the first
   * one" copy used by entities that do support create.
   */
  noRecordsTitle?: string;
  noRecordsDescription?: string;
}

export function MasterDataEmptyState({
  reason,
  entityLabelPlural,
  searchTerm,
  onClearSearch,
  onCreate,
  createLabel,
  noRecordsTitle,
  noRecordsDescription,
}: MasterDataEmptyStateProps) {
  if (reason === 'permission-denied') {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
        <p className="text-sm font-medium text-foreground">You don't have access to view {entityLabelPlural}</p>
        <p className="text-sm text-muted-foreground">Ask an administrator to grant you the required role.</p>
      </div>
    );
  }

  if (reason === 'no-search-results') {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
        <p className="text-sm font-medium text-foreground">
          No {entityLabelPlural} match{searchTerm ? ` "${searchTerm}"` : ' your search'}
        </p>
        <p className="text-sm text-muted-foreground">Try a different search term.</p>
        {onClearSearch && (
          <Button type="button" variant="outline" size="sm" onClick={onClearSearch}>
            Clear search
          </Button>
        )}
      </div>
    );
  }

  // reason === 'no-records'
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <p className="text-sm font-medium text-foreground">
        {noRecordsTitle ?? `No ${entityLabelPlural} yet`}
      </p>
      <p className="text-sm text-muted-foreground">
        {noRecordsDescription ?? 'Get started by creating the first one.'}
      </p>
      {onCreate && createLabel && (
        <Button type="button" variant="primary" size="sm" onClick={onCreate}>
          {createLabel}
        </Button>
      )}
    </div>
  );
}
