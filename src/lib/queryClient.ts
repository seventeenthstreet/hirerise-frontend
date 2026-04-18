// lib/queryClient.ts
// Singleton QueryClient shared across the app.
// Configured with sensible defaults for the HireRise use case.

import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/types/api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't refetch on window focus — avoids hammering the API
      refetchOnWindowFocus: false,
      // 60 seconds before a query is considered stale
      staleTime: 60 * 1000,
      // Don't retry on 4xx errors — only on network/5xx failures
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      // Don't retry mutations automatically
      retry: false,
    },
  },
});
