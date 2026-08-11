/**
 * components/master-data/MasterDataToolbar.tsx
 *
 * Reusable toolbar: search + refresh + create action. Composes
 * MasterDataSearch and Button — no Skills-specific knowledge, so Roles
 * and Career Domains reuse it unchanged by swapping the label/handlers.
 */

import { Button } from '@/components/ui';
import { MasterDataSearch } from './MasterDataSearch';

interface MasterDataToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  onRefresh: () => void;
  isRefreshing?: boolean;
  createLabel: string;
  onCreate: () => void;
}

export function MasterDataToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search…',
  onRefresh,
  isRefreshing = false,
  createLabel,
  onCreate,
}: MasterDataToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1 sm:max-w-sm">
        <MasterDataSearch
          value={searchValue}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
        />
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={onRefresh}
          isLoading={isRefreshing}
          aria-label="Refresh list"
        >
          Refresh
        </Button>
        <Button type="button" variant="primary" size="md" onClick={onCreate}>
          {createLabel}
        </Button>
      </div>
    </div>
  );
}
