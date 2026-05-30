/**
 * src/components/devtools/TimelineFilters.types.ts
 *
 * Types and constants for TimelineFilters.
 * Extracted from TimelineFilters.tsx for Vite Fast Refresh compatibility.
 */

import type { ObservabilityEventType } from '@/lib/observability';

export interface TimelineFilterState {
  errorsOnly: boolean;
  slowOnly:   boolean;
  typeFilter: ObservabilityEventType | 'all';
  nameSearch: string;
}

export const DEFAULT_FILTERS: TimelineFilterState = {
  errorsOnly: false,
  slowOnly:   false,
  typeFilter: 'all',
  nameSearch: '',
};