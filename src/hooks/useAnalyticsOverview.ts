'use client';

/**
 * hooks/useAnalyticsOverview.ts
 *
 * Calls GET /api/v1/analytics/overview — all five macro metrics in one round trip.
 *
 * Returns:
 *   careerDemand   — ranked careers by demand + salary growth
 *   skillDemand    — ranked skills by market demand + growth velocity
 *   educationROI   — ranked education paths by ROI score
 *   careerGrowth   — 10-year salary forecast per top career
 *   industryTrends — emerging sectors by growth signal
 *
 * Cached 10 min (matches backend in-memory TTL).
 * Enabled only when explicitly requested — does not fire on mount.
 */

import { useQuery } from '@tanstack/react-query';
import {
  getOverview,
  type OverviewResponse,
} from '@/modules/career-intelligence/services/analytics.api';

export type { OverviewResponse };

export const ANALYTICS_OVERVIEW_KEY = ['analytics', 'overview'] as const;

export function useAnalyticsOverview(enabled = true) {
  return useQuery<OverviewResponse>({
    queryKey: ANALYTICS_OVERVIEW_KEY,
    queryFn:  getOverview,
    enabled,
    staleTime: 10 * 60 * 1000,   // 10 min — matches backend MEM_TTL_MS
    retry:     1,
  });
}