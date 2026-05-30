/**
 * src/services/academicQueryProvider.tsx
 *
 * ACADEMIC QUERY CLIENT CONFIGURATION
 * ─────────────────────────────────────
 * Exports a pre-configured QueryClient instance and a React context helper
 * for accessing the invalidation service anywhere in the tree.
 *
 * This module does NOT create a new QueryClient on every render — it exports
 * a singleton factory for use in the existing Providers.tsx.
 *
 * INTEGRATION:
 *   Import `createAcademicQueryClient` and pass the result to <QueryClientProvider>.
 *   The existing QueryProvider.tsx can use this factory or these defaults can be
 *   merged into the platform's existing QueryClient configuration.
 *
 * DEFAULT POLICIES applied:
 *  - queries: 3 retries with the RPC-aware predicate
 *  - mutations: 0 retries (mutations are idempotent; retry is the UI's decision)
 *  - staleTime: 0 (hooks set their own per-category staleTime)
 */

import { QueryClient }             from '@tanstack/react-query';
import { academicRpcRetryPredicate } from '../hooks/utils/rpcExecutor';

/**
 * Creates a QueryClient configured for the HireRise Academic platform.
 *
 * Call this ONCE at app startup (e.g. in Providers.tsx) — not per render.
 *
 * @example
 *   // In Providers.tsx
 *   const [queryClient] = useState(() => createAcademicQueryClient());
 */
export function createAcademicQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry:      academicRpcRetryPredicate,
        staleTime:  0,
        gcTime:     5 * 60 * 1000, // 5 minutes default; hooks override per-category
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
