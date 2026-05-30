/**
 * @file src/lib/query/index.ts
 * @description Barrel export for the React Query infrastructure.
 *
 * All consumers import from '@/lib/query' — never from individual files.
 */

export { queryClient, shouldRetry, retryDelay, QUERY_STALE_TIME, QUERY_GC_TIME } from './queryClient';
export { queryKeys } from './queryKeys';
export type { MetricSection } from './queryKeys';