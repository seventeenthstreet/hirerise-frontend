// hooks/useAvaMemory.ts

'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback }              from 'react';
import {
  fetchAvaMemory,
  trackAvaEvent,
  type AvaMemoryContext,
  type AvaEventType,
} from '@/services/avaMemoryService';

export const AVA_MEMORY_KEY = ['ava-memory'] as const;

export const EMPTY_MEMORY: AvaMemoryContext = {
  weeklySummary: '',
  reminder:      null,
  nextStep:      { action: '', href: '/', type: 'explore' },
  scoreDelta:    null,
  stats: {
    skillsAddedThisWeek: 0,
    jobsAppliedThisWeek: 0,
    resumeImproved:      false,
    weeklyProgress:      0,
    currentScore:        0,
    lastScore:           0,
    daysSinceActive:     null,
    isNewUser:           true,
  },
};

export function useAvaMemory(currentScore?: number | null) {
  const qc = useQueryClient();

  // Normalise null → undefined so the query key is always ['ava-memory']
  // regardless of whether scores have loaded yet. This prevents the
  // ["ava-memory", null] key that caused the "query data cannot be undefined" error.
  const score = currentScore ?? undefined;

  const query = useQuery<AvaMemoryContext>({
    queryKey: AVA_MEMORY_KEY,   // stable key — score is only a fetch hint, not cache discriminator
    queryFn:  async () => {
      try {
        const result = await fetchAvaMemory(score);
        // Guard against undefined/null from the API — TanStack Query forbids undefined
        return result ?? EMPTY_MEMORY;
      } catch {
        // API not reachable yet (e.g. ava-memory route not deployed) — return safe default
        return EMPTY_MEMORY;
      }
    },
    staleTime:   5 * 60 * 1000,
    retry:       false,          // don't retry — failures return EMPTY_MEMORY gracefully
    initialData: EMPTY_MEMORY,   // prevents undefined during first render (fixes the console error)
  });

  const trackEvent = useCallback(
    async (eventType: AvaEventType, payload?: { count?: number; score?: number }) => {
      await trackAvaEvent(eventType, payload);
      qc.invalidateQueries({ queryKey: AVA_MEMORY_KEY });
    },
    [qc],
  );

  return {
    memory:    query.data,       // always defined — initialData guarantees it
    isLoading: query.isLoading,
    isError:   query.isError,
    trackEvent,
    refetch:   query.refetch,
  };
}