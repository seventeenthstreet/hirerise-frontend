'use client';

/**
 * hooks/useRoleAutocomplete.ts
 *
 * TanStack Query hook for fast role autocomplete.
 * Debounces input, calls autocomplete_roles via roleSearchService.
 * No embedding needed — pure prefix + fuzzy matching.
 *
 * Usage:
 *   const { query, setQuery, items, isLoading, clear } = useRoleAutocomplete({ agency });
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery }                          from '@tanstack/react-query';
import { roleSearchService, type AutocompleteItem } from '@/services/roleSearchService';

const MIN_CHARS   = 2;
const DEBOUNCE_MS = 200; // faster than hybrid search — no embedding roundtrip

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export interface UseRoleAutocompleteOptions {
  agency:  string;
  limit?:  number;
}

export function useRoleAutocomplete(options: UseRoleAutocompleteOptions) {
  const { agency, limit = 10 } = options;

  const [query, setQuery] = useState('');
  const debouncedQuery    = useDebouncedValue(query.trim(), DEBOUNCE_MS);
  const isEnabled         = debouncedQuery.length >= MIN_CHARS && !!agency;

  const { data, isFetching, isError } = useQuery({
    queryKey: ['role-autocomplete', debouncedQuery, agency, limit],
    queryFn:  () => roleSearchService.autocomplete({
      query:  debouncedQuery,
      agency,
      limit,
    }),
    enabled:   isEnabled,
    staleTime: 30 * 1000,  // 30 s — autocomplete results are very stable
    retry:     false,       // don't retry autocomplete — stale is fine
  });

  const items: AutocompleteItem[] = data?.items ?? [];
  const isLoading                  = isEnabled && isFetching;
  const noResults                  = isEnabled && !isFetching && items.length === 0;

  const clear = useCallback(() => setQuery(''), []);

  return {
    query,
    setQuery,
    items,
    isLoading,
    noResults,
    isEnabled,
    isError,
    clear,
  };
}