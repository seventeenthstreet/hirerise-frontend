/**
 * src/providers/QueryProvider.tsx
 *
 * HireRise — React Query Provider component.
 *
 * Non-component exports (STALE, queryClient, setQueryClientErrorHandler)
 * live in QueryProvider.client.ts to satisfy Vite Fast Refresh module boundaries.
 *
 * Devtools: rendered only in development to avoid bundle bloat in production.
 */

import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './QueryProvider.client';

// ─────────────────────────────────────────────────────────────────────────────
// DEVTOOLS — tree-shaken in production builds
// ─────────────────────────────────────────────────────────────────────────────

// Lazy import so the devtools bundle is excluded from production chunks.
const ReactQueryDevtools =
  process.env.NODE_ENV === 'development'
    ? React.lazy(() =>
        import('@tanstack/react-query-devtools').then((m) => ({
          default: m.ReactQueryDevtools,
        })),
      )
    : null;

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && ReactQueryDevtools && (
        <React.Suspense fallback={null}>
          <ReactQueryDevtools
            initialIsOpen={false}
            buttonPosition="bottom-right"
          />
        </React.Suspense>
      )}
    </QueryClientProvider>
  );
}