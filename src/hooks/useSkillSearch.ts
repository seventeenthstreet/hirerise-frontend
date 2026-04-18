'use client';

/**
 * hooks/useSkillSearch.ts
 *
 * Debounced skill catalog search hook.
 * Exposes query state + live results from GET /api/v1/skills?search=<query>
 *
 * Usage:
 *   const { query, setQuery, results, isSearching, noResults, isEnabled, clear } = useSkillSearch();
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery }                                  from '@tanstack/react-query';
import { skillsService }                             from '@/services/skillsService';

const MIN_CHARS   = 2;   // minimum characters before firing a request
const DEBOUNCE_MS = 300; // ms to wait after typing stops

export interface SkillSearchResult {
  id:       string;
  name:     string;
  category: string;
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function useSkillSearch() {
  const [query, setQuery] = useState('');
  const debouncedQuery    = useDebouncedValue(query.trim(), DEBOUNCE_MS);

  const isEnabled = debouncedQuery.length >= MIN_CHARS;

  const { data, isFetching: isSearching } = useQuery({
    queryKey: ['skill-search', debouncedQuery],
    queryFn:  () => skillsService.listSkills({ search: debouncedQuery, limit: 20 }),
    enabled:  isEnabled,
    staleTime: 30 * 1000, // 30 s — search results are fairly stable
  });

  const results: SkillSearchResult[] = (data?.items ?? []).map(s => ({
    id:       s.id,
    name:     s.name,
    category: (s as any).category ?? '',
  }));

  const hasResults = results.length > 0;
  const noResults  = isEnabled && !isSearching && !hasResults;

  const clear = useCallback(() => setQuery(''), []);

  return {
    query,
    setQuery,
    results,
    isSearching: isEnabled && isSearching,
    hasResults,
    noResults,
    isEnabled,
    clear,
  };
}