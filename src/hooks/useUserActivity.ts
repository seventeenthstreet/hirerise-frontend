// hooks/useUserActivity.ts
//
// Fetches the user's real career activity summary from the backend.
// Returns streak count, weekly completed actions, and 7-day activity map.
//
// Used by:
//   - ImprovementStreak (dashboard) — replaces hardcoded "4 day streak"
//   - Intelligence header — replaces hardcoded "+4% this month" trend
//
// Endpoint: GET /api/v1/user-activity/summary

'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/services/apiClient';

export interface UserActivitySummary {
  /** Number of consecutive days with at least one career action */
  streakDays:    number;
  /** Unique action labels completed this week e.g. ['Resume', 'CHI Score'] */
  weeklyActions: string[];
  /** Map of last 7 ISO dates → boolean (had activity that day) */
  dailyMap:      Record<string, boolean>;
  /** ISO string of most recent activity */
  lastActiveAt:  string | null;
}

const EMPTY: UserActivitySummary = {
  streakDays:    0,
  weeklyActions: [],
  dailyMap:      {},
  lastActiveAt:  null,
};

export function useUserActivity() {
  return useQuery<UserActivitySummary>({
    queryKey: ['user-activity-summary'],
    queryFn:  async () => {
      try {
        const res = await apiFetch<{ data: UserActivitySummary }>('/user-activity/summary');
        return res?.data ?? EMPTY;
      } catch {
        return EMPTY;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 min — activity doesn't change that fast
    retry:     1,
  });
}