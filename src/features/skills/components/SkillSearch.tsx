'use client';

// features/skills/components/SkillSearch.tsx
//
// Controlled search + category filter bar for the skill catalog.
// Parent owns the state; this component is purely presentational + event-driven.

import { useRef } from 'react';
import { SKILL_CATEGORIES, type SkillCategory } from '@/types/skills';
import { cn } from '@/utils/cn';

interface SkillSearchProps {
  search:       string;
  category:     string;
  onSearch:     (value: string) => void;
  onCategory:   (value: string) => void;
  resultCount?: number;
  isLoading?:   boolean;
}

export function SkillSearch({
  search,
  category,
  onSearch,
  onCategory,
  resultCount,
  isLoading,
}: SkillSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          placeholder="Search skills by name, alias, or description…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className={cn(
            'h-10 w-full rounded-xl border bg-white py-2 pl-10 pr-10 text-sm text-surface-900',
            'placeholder:text-surface-300 transition-all',
            'focus:border-hr-400 focus:outline-none focus:ring-2 focus:ring-hr-100',
            search ? 'border-hr-300' : 'border-surface-200 hover:border-surface-300',
          )}
        />
        {search && (
          <button
            onClick={() => { onSearch(''); inputRef.current?.focus(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-300 hover:text-surface-600 transition-colors"
            aria-label="Clear search"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Category chips + result count */}
      <div className="flex flex-wrap items-center gap-2">
        {/* All chip */}
        <button
          onClick={() => onCategory('')}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-semibold transition-all',
            !category
              ? 'border-hr-500 bg-hr-500 text-white shadow-sm'
              : 'border-surface-200 bg-white text-surface-600 hover:border-hr-300 hover:text-hr-600',
          )}
        >
          All
        </button>

        {SKILL_CATEGORIES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onCategory(category === value ? '' : value)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-semibold transition-all',
              category === value
                ? 'border-hr-500 bg-hr-500 text-white shadow-sm'
                : 'border-surface-200 bg-white text-surface-600 hover:border-hr-300 hover:text-hr-600',
            )}
          >
            {label}
          </button>
        ))}

        {/* Result count */}
        <span className="ml-auto text-xs text-surface-400">
          {isLoading ? (
            <span className="inline-block h-3 w-16 animate-skeleton rounded bg-surface-100" />
          ) : resultCount != null ? (
            `${resultCount.toLocaleString()} result${resultCount !== 1 ? 's' : ''}`
          ) : null}
        </span>
      </div>
    </div>
  );
}