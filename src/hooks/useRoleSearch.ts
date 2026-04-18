'use client';

/**
 * hooks/useRoleSearch.ts
 *
 * TanStack Query hook for hybrid role search.
 * Debounces input, calls search_roles_hybrid via roleSearchService.
 *
 * Usage:
 *   const { query, setQuery, results, total, isSearching, noResults } = useRoleSearch({ agency });
 */

import { useState, useEffect } from 'react';
import { useQuery }            from '@tanstack/react-query';
import { roleSearchService, type HybridRoleResult } from '@/services/roleSearchService';

const MIN_CHARS   = 2;
const DEBOUNCE_MS = 400;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export interface UseRoleSearchOptions {
  agency:      string;
  limit?:      number;
  offset?:     number;
  minSemantic?: number;
  minFts?:     number;
}

export function useRoleSearch(options: UseRoleSearchOptions) {
  const { agency, limit = 20, offset = 0, minSemantic = 0.65, minFts = 0.1 } = options;

  const [query, setQuery] = useState('');
  const debouncedQuery    = useDebouncedValue(query.trim(), DEBOUNCE_MS);
  const isEnabled         = debouncedQuery.length >= MIN_CHARS && !!agency;

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ['role-search', 'hybrid', debouncedQuery, agency, limit, offset],
    queryFn:  () => roleSearchService.hybridSearch({
      query:       debouncedQuery,
      agency,
      limit,
      offset,
      minSemantic,
      minFts,
    }),
    enabled:   isEnabled,
    staleTime: 60 * 1000,   // 1 min — search results stable for short periods
    retry:     1,
  });

  const results: HybridRoleResult[] = data?.roles ?? [];
  const total                        = data?.total ?? 0;
  const isSearching                  = isEnabled && isFetching;
  const noResults                    = isEnabled && !isFetching && results.length === 0;

  return {
    query,
    setQuery,
    results,
    total,
    isSearching,
    noResults,
    isEnabled,
    isError,
    error,
  };
}