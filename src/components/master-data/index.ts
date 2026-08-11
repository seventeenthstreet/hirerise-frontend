/**
 * components/master-data/index.ts — barrel export.
 * Import from '@/components/master-data' in every Master Data module page.
 */

export { MasterDataTable } from './MasterDataTable';
export { MasterDataToolbar } from './MasterDataToolbar';
export { MasterDataSearch } from './MasterDataSearch';
export { MasterDataPagination } from './MasterDataPagination';
export { MasterDataDrawer } from './MasterDataDrawer';
export { MasterDataForm } from './MasterDataForm';
export { MasterDataDeleteDialog } from './MasterDataDeleteDialog';
export { MasterDataLoadingState } from './MasterDataLoadingState';
export { MasterDataEmptyState } from './MasterDataEmptyState';
export { MasterDataErrorState } from './MasterDataErrorState';
export { MasterDataStatusBanner } from './MasterDataStatusBanner';
export type { MasterDataStatus } from './MasterDataStatusBanner';

export type {
  MasterDataColumn,
  MasterDataRowAction,
  MasterDataFieldType,
  MasterDataFieldConfig,
  MasterDataFieldErrors,
} from './types';
